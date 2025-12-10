/**
 * SERVIÇO DE INTEGRAÇÃO COM ANTHROPIC (CLAUDE)
 * 
 * Responsável por:
 * - Atendimento de leads via Claude Haiku 4.5
 * - Conversões e qualificações no SDR Worker
 * 
 * Modelo: claude-haiku-4-5-20251001 (mais rápido e econômico)
 * 
 * Documentação: https://docs.anthropic.com/claude/reference
 */

import Anthropic from '@anthropic-ai/sdk';

// Tipo para mensagens
export interface MensagemClaude {
  role: 'user' | 'assistant';
  content: string;
}

// Tipo para ferramentas (function calling)
export interface FerramentaClaude {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Resultado de chamada de ferramenta
export interface ChamadaFerramenta {
  id: string;
  name: string;
  input: Record<string, any>;
}

// Resposta do Claude
export interface RespostaClaude {
  texto: string;
  ferramentas?: ChamadaFerramenta[];
  stopReason: string;
  tokensUsados: {
    input: number;
    output: number;
  };
}

class AnthropicService {
  private client: Anthropic | null = null;
  private modelo: string = 'claude-haiku-4-5-20251001';

  /**
   * Obtém o cliente Anthropic (lazy init)
   */
  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY não configurada no ambiente');
      }
      this.client = new Anthropic({ apiKey });
      console.log('[ANTHROPIC] ✅ Cliente inicializado com Claude Haiku 4.5');
    }
    return this.client;
  }

  /**
   * Verifica se o serviço está configurado
   */
  estaConfigurado(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Envia mensagem para o Claude e retorna resposta
   */
  async enviarMensagem(
    systemPrompt: string,
    mensagens: MensagemClaude[],
    ferramentas?: FerramentaClaude[],
    opcoes?: {
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<RespostaClaude> {
    const client = this.getClient();

    try {
      const requestParams: Anthropic.MessageCreateParams = {
        model: this.modelo,
        max_tokens: opcoes?.maxTokens || 500,
        system: systemPrompt,
        messages: mensagens,
      };

      // Adicionar ferramentas se fornecidas
      if (ferramentas && ferramentas.length > 0) {
        requestParams.tools = ferramentas;
      }

      const response = await client.messages.create(requestParams);

      // Extrair texto e chamadas de ferramenta
      let texto = '';
      const chamadas: ChamadaFerramenta[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          texto += block.text;
        } else if (block.type === 'tool_use') {
          chamadas.push({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, any>,
          });
        }
      }

      return {
        texto,
        ferramentas: chamadas.length > 0 ? chamadas : undefined,
        stopReason: response.stop_reason || 'end_turn',
        tokensUsados: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      };

    } catch (error: any) {
      console.error('[ANTHROPIC] Erro:', error.message);
      throw error;
    }
  }

  /**
   * Continua conversa após uso de ferramenta
   */
  async continuarAposFerramenta(
    systemPrompt: string,
    mensagens: MensagemClaude[],
    toolUseId: string,
    toolResult: string,
    ferramentas?: FerramentaClaude[],
    opcoes?: {
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<RespostaClaude> {
    const client = this.getClient();

    // Adicionar resultado da ferramenta às mensagens
    const mensagensComResultado = [
      ...mensagens,
      {
        role: 'user' as const,
        content: [
          {
            type: 'tool_result' as const,
            tool_use_id: toolUseId,
            content: toolResult,
          }
        ]
      }
    ];

    try {
      const requestParams: Anthropic.MessageCreateParams = {
        model: this.modelo,
        max_tokens: opcoes?.maxTokens || 500,
        system: systemPrompt,
        messages: mensagensComResultado as any,
      };

      if (ferramentas && ferramentas.length > 0) {
        requestParams.tools = ferramentas;
      }

      const response = await client.messages.create(requestParams);

      let texto = '';
      const chamadas: ChamadaFerramenta[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          texto += block.text;
        } else if (block.type === 'tool_use') {
          chamadas.push({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, any>,
          });
        }
      }

      return {
        texto,
        ferramentas: chamadas.length > 0 ? chamadas : undefined,
        stopReason: response.stop_reason || 'end_turn',
        tokensUsados: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      };

    } catch (error: any) {
      console.error('[ANTHROPIC] Erro ao continuar:', error.message);
      throw error;
    }
  }

  /**
   * Retorna o modelo sendo usado
   */
  getModelo(): string {
    return this.modelo;
  }
}

// Singleton
export const anthropicService = new AnthropicService();
