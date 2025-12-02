/**
 * Serviço de integração com Google Gemini
 * 
 * Alternativa gratuita ao OpenAI GPT-4
 * - 15 requisições/minuto
 * - 1500 requisições/dia
 * - Qualidade similar ao GPT-4
 * 
 * @see https://ai.google.dev/docs
 */

interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

interface GeminiConfig {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

export class GeminiClient {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private defaultModel = 'gemini-1.5-flash'; // Modelo rápido e gratuito

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('[Gemini] ⚠️ GEMINI_API_KEY não configurada');
    }
  }

  /**
   * Verifica se o Gemini está configurado
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Gera texto com o Gemini
   */
  async generateContent(
    prompt: string,
    config: GeminiConfig = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const url = `${this.baseUrl}/models/${this.defaultModel}:generateContent?key=${this.apiKey}`;

    const body = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: config.temperature ?? 0.1,
        maxOutputTokens: config.maxOutputTokens ?? 8192,
        topP: config.topP ?? 0.95,
        topK: config.topK ?? 40,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ]
    };

    try {
      console.log('[Gemini] 🤖 Enviando requisição...');
      
      // Usar AbortController para timeout maior
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Gemini] ❌ Erro na API:', response.status, errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as GeminiResponse;

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('Gemini não retornou candidatos');
      }

      const text = data.candidates[0].content.parts[0].text;
      
      if (data.usageMetadata) {
        console.log(`[Gemini] ✅ Tokens: ${data.usageMetadata.totalTokenCount} (prompt: ${data.usageMetadata.promptTokenCount}, resposta: ${data.usageMetadata.candidatesTokenCount})`);
      }

      return text;

    } catch (error) {
      console.error('[Gemini] ❌ Erro:', error);
      throw error;
    }
  }

  /**
   * Gera JSON estruturado com o Gemini
   * Extrai automaticamente o JSON da resposta
   */
  async generateJSON<T = any>(
    prompt: string,
    config: GeminiConfig = {}
  ): Promise<T> {
    // Adicionar instrução para retornar JSON
    const jsonPrompt = `${prompt}

IMPORTANTE: Retorne APENAS JSON válido, sem markdown, sem \`\`\`json, sem texto antes ou depois.`;

    const response = await this.generateContent(jsonPrompt, {
      ...config,
      temperature: config.temperature ?? 0.1, // Mais determinístico para JSON
    });

    // Limpar resposta (remover possíveis markdown)
    let cleanJson = response.trim();
    
    // Remover blocos de código markdown se presentes
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.slice(7);
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.slice(3);
    }
    
    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.slice(0, -3);
    }
    
    cleanJson = cleanJson.trim();

    try {
      return JSON.parse(cleanJson) as T;
    } catch (error) {
      console.error('[Gemini] ❌ Erro ao parsear JSON:', cleanJson.substring(0, 200));
      throw new Error(`Falha ao parsear JSON do Gemini: ${error}`);
    }
  }

  /**
   * Chat multi-turno com histórico
   */
  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    config: GeminiConfig = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const url = `${this.baseUrl}/models/${this.defaultModel}:generateContent?key=${this.apiKey}`;

    // Converter formato OpenAI para Gemini
    const geminiMessages: GeminiMessage[] = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const body = {
      contents: geminiMessages,
      generationConfig: {
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxOutputTokens ?? 8192,
        topP: config.topP ?? 0.95,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as GeminiResponse;

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('Gemini não retornou candidatos');
      }

      return data.candidates[0].content.parts[0].text;

    } catch (error) {
      console.error('[Gemini] ❌ Erro no chat:', error);
      throw error;
    }
  }
}

// Singleton para uso global
export const gemini = new GeminiClient();

// Função auxiliar para escolher entre OpenAI e Gemini
export function getAIProvider(): 'gemini' | 'openai' | null {
  if (process.env.GEMINI_API_KEY) {
    return 'gemini';
  }
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  return null;
}
