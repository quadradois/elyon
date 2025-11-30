/**
 * RATE LIMITER COM AGRUPAMENTO
 * 
 * Em vez de bloquear mensagens, agrupa várias mensagens
 * em uma única resposta após período de silêncio.
 * 
 * Benefícios:
 * - Não irrita o cliente com bloqueios
 * - Resposta mais contextualizada
 * - Economia de tokens (1 resposta para várias mensagens)
 * - Proteção contra spam e bots
 */

import { prisma } from '../servidor';

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface MensagemPendente {
  conteudo: string;
  tipo: 'TEXTO' | 'AUDIO' | 'IMAGEM';
  recebidaEm: Date;
}

export interface FilaMensagens {
  leadId: string;
  mensagens: MensagemPendente[];
  primeiraRecebidaEm: Date;
  ultimaRecebidaEm: Date;
  timeoutId?: NodeJS.Timeout;
}

export interface ConfiguracaoRateLimiter {
  // Janela de agrupamento
  janelaAgrupamentoMs: number;     // Tempo de silêncio antes de responder (default: 30s)
  
  // Limites
  maxMensagensPorConversa: number; // Máximo antes de escalar (default: 50)
  maxMensagensPorMinuto: number;   // Limite de flood (default: 15)
  maxTokensDiaTenant: number;      // Proteção de custo (default: 100000)
  
  // Alertas
  alertaTokensEm: number;          // Porcentagem para alertar (default: 80)
}

const CONFIG_PADRAO: ConfiguracaoRateLimiter = {
  janelaAgrupamentoMs: 30000,      // 30 segundos
  maxMensagensPorConversa: 50,
  maxMensagensPorMinuto: 15,
  maxTokensDiaTenant: 100000,
  alertaTokensEm: 80
};

// ============================================
// CLASSE PRINCIPAL
// ============================================

type CallbackProcessar = (leadId: string, mensagensAgrupadas: string) => Promise<void>;

class RateLimiter {
  private config: ConfiguracaoRateLimiter;
  private filas: Map<string, FilaMensagens> = new Map();
  private contadorPorMinuto: Map<string, { count: number; resetEm: Date }> = new Map();
  private contadorMensagensConversa: Map<string, number> = new Map();
  private callbackProcessar?: CallbackProcessar;
  
  constructor(config?: Partial<ConfiguracaoRateLimiter>) {
    this.config = { ...CONFIG_PADRAO, ...config };
  }
  
  /**
   * Define callback a ser chamado quando fila estiver pronta
   */
  setCallback(callback: CallbackProcessar): void {
    this.callbackProcessar = callback;
  }
  
  /**
   * Adiciona mensagem à fila de um lead
   * Retorna status indicando o que fazer
   */
  async adicionarMensagem(
    leadId: string,
    mensagem: MensagemPendente
  ): Promise<{
    status: 'AGUARDANDO' | 'PROCESSAR' | 'LIMITE_CONVERSA' | 'FLOOD';
    mensagensAgrupadas?: string;
    motivoLimite?: string;
  }> {
    // 1. Verificar limite de flood (muitas mensagens por minuto)
    const floodCheck = this.verificarFlood(leadId);
    if (floodCheck.isFlood) {
      console.log(`[RATE-LIMITER] 🚫 Flood detectado para lead ${leadId}`);
      return {
        status: 'FLOOD',
        motivoLimite: floodCheck.motivo
      };
    }
    
    // 2. Verificar limite de mensagens na conversa
    const contadorConversa = this.contadorMensagensConversa.get(leadId) || 0;
    if (contadorConversa >= this.config.maxMensagensPorConversa) {
      console.log(`[RATE-LIMITER] 📋 Limite de conversa atingido para lead ${leadId}`);
      return {
        status: 'LIMITE_CONVERSA',
        motivoLimite: `Máximo de ${this.config.maxMensagensPorConversa} mensagens atingido`
      };
    }
    
    // 3. Incrementar contadores
    this.incrementarContadorMinuto(leadId);
    this.contadorMensagensConversa.set(leadId, contadorConversa + 1);
    
    // 4. Adicionar à fila
    let fila = this.filas.get(leadId);
    
    if (!fila) {
      // Nova fila
      fila = {
        leadId,
        mensagens: [],
        primeiraRecebidaEm: new Date(),
        ultimaRecebidaEm: new Date()
      };
      this.filas.set(leadId, fila);
    }
    
    // Adicionar mensagem
    fila.mensagens.push(mensagem);
    fila.ultimaRecebidaEm = new Date();
    
    // 5. Resetar timeout existente
    if (fila.timeoutId) {
      clearTimeout(fila.timeoutId);
    }
    
    // 6. Criar novo timeout
    fila.timeoutId = setTimeout(() => {
      this.processarFila(leadId);
    }, this.config.janelaAgrupamentoMs);
    
    console.log(`[RATE-LIMITER] 📥 Mensagem adicionada à fila do lead ${leadId} (total: ${fila.mensagens.length})`);
    
    return { status: 'AGUARDANDO' };
  }
  
  /**
   * Processa a fila quando timeout expira
   */
  private async processarFila(leadId: string): Promise<void> {
    const fila = this.filas.get(leadId);
    
    if (!fila || fila.mensagens.length === 0) {
      return;
    }
    
    console.log(`[RATE-LIMITER] ⏱️ Processando fila do lead ${leadId} (${fila.mensagens.length} mensagens)`);
    
    // Agrupar mensagens em texto único
    const mensagensAgrupadas = this.agruparMensagens(fila.mensagens);
    
    // Limpar fila
    this.filas.delete(leadId);
    
    // Chamar callback se definido
    if (this.callbackProcessar) {
      await this.callbackProcessar(leadId, mensagensAgrupadas);
    }
  }
  
  /**
   * Agrupa mensagens em texto único para o agente
   */
  private agruparMensagens(mensagens: MensagemPendente[]): string {
    if (mensagens.length === 1) {
      return mensagens[0].conteudo;
    }
    
    // Se múltiplas mensagens, formatar de forma clara
    const partes = mensagens.map((m, i) => {
      if (m.tipo === 'AUDIO') {
        return `[Áudio ${i + 1}]: ${m.conteudo}`;
      }
      if (m.tipo === 'IMAGEM') {
        return `[Imagem ${i + 1}]: ${m.conteudo}`;
      }
      return m.conteudo;
    });
    
    // Juntar com quebra de linha
    return partes.join('\n');
  }
  
  /**
   * Verifica se há flood de mensagens
   */
  private verificarFlood(leadId: string): { isFlood: boolean; motivo?: string } {
    const agora = new Date();
    let contador = this.contadorPorMinuto.get(leadId);
    
    // Reset se passou 1 minuto
    if (contador && contador.resetEm < agora) {
      contador = undefined;
      this.contadorPorMinuto.delete(leadId);
    }
    
    if (!contador) {
      return { isFlood: false };
    }
    
    if (contador.count >= this.config.maxMensagensPorMinuto) {
      return {
        isFlood: true,
        motivo: `Mais de ${this.config.maxMensagensPorMinuto} mensagens no último minuto`
      };
    }
    
    return { isFlood: false };
  }
  
  /**
   * Incrementa contador de mensagens por minuto
   */
  private incrementarContadorMinuto(leadId: string): void {
    const agora = new Date();
    let contador = this.contadorPorMinuto.get(leadId);
    
    // Reset se passou 1 minuto
    if (contador && contador.resetEm < agora) {
      contador = undefined;
    }
    
    if (!contador) {
      contador = {
        count: 0,
        resetEm: new Date(agora.getTime() + 60000) // 1 minuto
      };
    }
    
    contador.count++;
    this.contadorPorMinuto.set(leadId, contador);
  }
  
  /**
   * Força processamento imediato da fila (para testes ou casos especiais)
   */
  async forcarProcessamento(leadId: string): Promise<void> {
    const fila = this.filas.get(leadId);
    if (fila?.timeoutId) {
      clearTimeout(fila.timeoutId);
    }
    await this.processarFila(leadId);
  }
  
  /**
   * Retorna status atual da fila de um lead
   */
  getStatusFila(leadId: string): {
    temFila: boolean;
    quantidadeMensagens: number;
    tempoEsperaRestante?: number;
  } {
    const fila = this.filas.get(leadId);
    
    if (!fila) {
      return { temFila: false, quantidadeMensagens: 0 };
    }
    
    const agora = Date.now();
    const tempoDecorrido = agora - fila.ultimaRecebidaEm.getTime();
    const tempoRestante = Math.max(0, this.config.janelaAgrupamentoMs - tempoDecorrido);
    
    return {
      temFila: true,
      quantidadeMensagens: fila.mensagens.length,
      tempoEsperaRestante: tempoRestante
    };
  }
  
  /**
   * Reseta contadores de uma conversa (quando conversa é encerrada)
   */
  resetarConversa(leadId: string): void {
    const fila = this.filas.get(leadId);
    if (fila?.timeoutId) {
      clearTimeout(fila.timeoutId);
    }
    
    this.filas.delete(leadId);
    this.contadorPorMinuto.delete(leadId);
    this.contadorMensagensConversa.delete(leadId);
    
    console.log(`[RATE-LIMITER] 🔄 Contadores resetados para lead ${leadId}`);
  }
  
  /**
   * Gera mensagem para limite de conversa atingido
   */
  gerarMensagemLimiteConversa(): string {
    return `Adorei nossa conversa! 😊 Para continuar te ajudando da melhor forma, vou passar você para um de nossos especialistas.

Ele vai entrar em contato em breve! Enquanto isso, posso ajudar com mais alguma informação rápida?`;
  }
  
  /**
   * Gera mensagem para flood detectado
   */
  gerarMensagemFlood(): string {
    return `Calma, estou aqui! 😅 Recebi suas mensagens e vou responder tudo de uma vez.

Me dá só alguns segundos para ler tudo com atenção...`;
  }
  
  /**
   * Verifica uso de tokens do tenant no dia
   */
  async verificarLimiteTokens(tenantId: string): Promise<{
    dentroDoLimite: boolean;
    tokensUsados: number;
    porcentagemUsada: number;
    alertar: boolean;
  }> {
    // TODO: Implementar busca real do banco
    // Por enquanto, retorna valores mock
    const tokensUsados = 0;
    const porcentagem = (tokensUsados / this.config.maxTokensDiaTenant) * 100;
    
    return {
      dentroDoLimite: porcentagem < 100,
      tokensUsados,
      porcentagemUsada: porcentagem,
      alertar: porcentagem >= this.config.alertaTokensEm
    };
  }
  
  /**
   * Estatísticas do rate limiter (para debug)
   */
  getEstatisticas(): {
    filasAtivas: number;
    leadsComContadorMinuto: number;
    leadsComContadorConversa: number;
  } {
    return {
      filasAtivas: this.filas.size,
      leadsComContadorMinuto: this.contadorPorMinuto.size,
      leadsComContadorConversa: this.contadorMensagensConversa.size
    };
  }
}

// Exportar instância singleton
export const rateLimiter = new RateLimiter();

// Exportar classe para testes
export { RateLimiter };
