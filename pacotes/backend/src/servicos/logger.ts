/**
 * Logger Centralizado - Elyon CRM
 * 
 * Sistema de logging estruturado em JSON para rastreamento
 * de decisões da IA, transições de FSM e eventos do sistema.
 * 
 * Uso:
 *   import { logger, SDRLogger } from './servicos/logger';
 *   logger.info('Mensagem simples');
 *   SDRLogger.transicaoFSM(conversaId, 'SITUACAO', 'PROBLEMA', 'Lead demonstrou interesse');
 */

import { randomUUID } from 'crypto';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  traceId?: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface SDRLogData {
  conversaId?: string;
  leadId?: string;
  telefone?: string;
  fase?: string;
  faseAnterior?: string;
  decisao?: string;
  confianca?: number;
  toolCalled?: string;
  toolParams?: Record<string, unknown>;
  toolResult?: unknown;
  promptTokens?: number;
  completionTokens?: number;
  latenciaMs?: number;
  erro?: string;
}

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const MIN_LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const LOG_TO_CONSOLE = process.env.LOG_TO_CONSOLE !== 'false';
const LOG_TO_FILE = process.env.LOG_TO_FILE === 'true';
const LOG_PRETTY = process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV !== 'production';

// Trace ID global por requisição (pode ser setado via middleware)
let currentTraceId: string | undefined;

// ============================================================================
// LOGGER BASE
// ============================================================================

class Logger {
  private service: string;
  
  constructor(service: string) {
    this.service = service;
  }

  /**
   * Define o trace ID para correlacionar logs de uma mesma requisição
   */
  setTraceId(traceId: string): void {
    currentTraceId = traceId;
  }

  /**
   * Gera um novo trace ID
   */
  generateTraceId(): string {
    const traceId = randomUUID().slice(0, 8);
    this.setTraceId(traceId);
    return traceId;
  }

  /**
   * Limpa o trace ID atual
   */
  clearTraceId(): void {
    currentTraceId = undefined;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
  }

  private formatEntry(entry: LogEntry): string {
    if (LOG_PRETTY) {
      return this.formatPretty(entry);
    }
    return JSON.stringify(entry);
  }

  private formatPretty(entry: LogEntry): string {
    const levelColors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m'  // Red
    };
    
    const reset = '\x1b[0m';
    const dim = '\x1b[2m';
    const bright = '\x1b[1m';
    
    const color = levelColors[entry.level];
    const time = entry.timestamp.split('T')[1].replace('Z', '');
    const trace = entry.traceId ? `${dim}[${entry.traceId}]${reset} ` : '';
    const level = `${color}${entry.level.toUpperCase().padEnd(5)}${reset}`;
    const service = `${bright}[${entry.service}]${reset}`;
    
    let output = `${dim}${time}${reset} ${level} ${trace}${service} ${entry.message}`;
    
    if (entry.data && Object.keys(entry.data).length > 0) {
      const dataStr = JSON.stringify(entry.data, null, 2)
        .split('\n')
        .map(line => `  ${dim}${line}${reset}`)
        .join('\n');
      output += `\n${dataStr}`;
    }
    
    if (entry.error) {
      output += `\n  ${color}Error: ${entry.error.message}${reset}`;
      if (entry.error.stack) {
        const stackLines = entry.error.stack.split('\n').slice(1, 4);
        output += `\n${stackLines.map(l => `  ${dim}${l.trim()}${reset}`).join('\n')}`;
      }
    }
    
    return output;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      traceId: currentTraceId,
      message,
      data
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    const formatted = this.formatEntry(entry);

    if (LOG_TO_CONSOLE) {
      if (level === 'error') {
        console.error(formatted);
      } else if (level === 'warn') {
        console.warn(formatted);
      } else {
        console.log(formatted);
      }
    }

    // TODO: Implementar gravação em arquivo ou envio para serviço externo
    // if (LOG_TO_FILE) { ... }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const err = error instanceof Error ? error : undefined;
    const extraData = error instanceof Error ? data : { ...(error as object), ...data };
    this.log('error', message, extraData, err);
  }

  /**
   * Cria um logger filho com um sub-serviço
   */
  child(subService: string): Logger {
    return new Logger(`${this.service}:${subService}`);
  }
}

// ============================================================================
// SDR LOGGER ESPECIALIZADO
// ============================================================================

class SDRLoggerClass {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('SDR');
  }

  /**
   * Log de início de processamento de mensagem
   */
  inicioProcessamento(data: Pick<SDRLogData, 'conversaId' | 'leadId' | 'telefone'>): string {
    const traceId = this.logger.generateTraceId();
    this.logger.info('📥 Iniciando processamento de mensagem', {
      conversaId: data.conversaId,
      leadId: data.leadId,
      telefone: data.telefone?.replace(/\d{4}$/, '****')
    });
    return traceId;
  }

  /**
   * Log de transição de fase FSM
   */
  transicaoFSM(
    conversaId: string,
    faseAnterior: string,
    faseNova: string,
    motivo?: string
  ): void {
    this.logger.info('🔄 Transição FSM', {
      conversaId,
      faseAnterior,
      faseNova,
      motivo,
      transicao: `${faseAnterior} → ${faseNova}`
    });
  }

  /**
   * Log de decisão da IA
   */
  decisaoIA(
    conversaId: string,
    decisao: string,
    confianca: number,
    dados?: Record<string, unknown>
  ): void {
    const nivel = confianca >= 0.8 ? 'info' : confianca >= 0.5 ? 'info' : 'warn';
    this.logger[nivel]('🧠 Decisão da IA', {
      conversaId,
      decisao,
      confianca: Math.round(confianca * 100) + '%',
      ...dados
    });
  }

  /**
   * Log de chamada de tool
   */
  toolCall(
    conversaId: string,
    toolName: string,
    params: Record<string, unknown>
  ): void {
    this.logger.info('🔧 Tool chamada', {
      conversaId,
      tool: toolName,
      params: this.sanitizeParams(params)
    });
  }

  /**
   * Log de resultado de tool
   */
  toolResult(
    conversaId: string,
    toolName: string,
    sucesso: boolean,
    resultado?: unknown
  ): void {
    const emoji = sucesso ? '✅' : '❌';
    const nivel = sucesso ? 'info' : 'warn';
    this.logger[nivel](`${emoji} Tool resultado`, {
      conversaId,
      tool: toolName,
      sucesso,
      resultado: typeof resultado === 'object' ? resultado : { valor: resultado }
    });
  }

  /**
   * Log de injeção de conhecimento RAG
   */
  conhecimentoInjetado(
    conversaId: string,
    fonte: 'empreendimento' | 'conversa' | 'curado',
    quantidade: number,
    score?: number
  ): void {
    this.logger.debug('📚 Conhecimento injetado', {
      conversaId,
      fonte,
      quantidade,
      similaridade: score ? Math.round(score * 100) + '%' : undefined
    });
  }

  /**
   * Log de métricas de LLM
   */
  llmMetricas(
    conversaId: string,
    modelo: string,
    promptTokens: number,
    completionTokens: number,
    latenciaMs: number
  ): void {
    this.logger.debug('📊 Métricas LLM', {
      conversaId,
      modelo,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens
      },
      latenciaMs,
      custoEstimado: this.estimarCusto(modelo, promptTokens, completionTokens)
    });
  }

  /**
   * Log de qualificação do lead
   */
  qualificacao(
    conversaId: string,
    leadId: string,
    qualificado: boolean,
    dadosColetados: Record<string, unknown>
  ): void {
    const emoji = qualificado ? '🏆' : '📋';
    this.logger.info(`${emoji} Lead ${qualificado ? 'QUALIFICADO' : 'em progresso'}`, {
      conversaId,
      leadId,
      qualificado,
      dadosColetados
    });
  }

  /**
   * Log de opt-out
   */
  optOut(conversaId: string, leadId: string, motivo?: string): void {
    this.logger.warn('🚫 Lead optou por sair', {
      conversaId,
      leadId,
      motivo
    });
  }

  /**
   * Log de recovery (lead voltou a engajar)
   */
  recovery(conversaId: string, tentativa: number, sucesso: boolean): void {
    const emoji = sucesso ? '🔄' : '⚠️';
    this.logger[sucesso ? 'info' : 'warn'](`${emoji} Tentativa de recovery`, {
      conversaId,
      tentativa,
      sucesso
    });
  }

  /**
   * Log de resposta gerada
   */
  respostaGerada(
    conversaId: string,
    resposta: string,
    fase: string
  ): void {
    this.logger.info('💬 Resposta gerada', {
      conversaId,
      fase,
      tamanho: resposta.length,
      preview: resposta.substring(0, 100) + (resposta.length > 100 ? '...' : '')
    });
  }

  /**
   * Log de erro no processamento
   */
  erro(
    conversaId: string,
    contexto: string,
    error: Error | unknown
  ): void {
    this.logger.error(`❌ Erro: ${contexto}`, error, { conversaId });
  }

  /**
   * Log de fim de processamento
   */
  fimProcessamento(
    conversaId: string,
    sucesso: boolean,
    duracaoMs: number
  ): void {
    const emoji = sucesso ? '✅' : '❌';
    this.logger.info(`${emoji} Processamento finalizado`, {
      conversaId,
      sucesso,
      duracaoMs,
      duracao: duracaoMs > 1000 ? `${(duracaoMs / 1000).toFixed(1)}s` : `${duracaoMs}ms`
    });
    this.logger.clearTraceId();
  }

  // Helpers privados

  private sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...params };
    const sensitiveKeys = ['senha', 'password', 'token', 'apiKey', 'api_key', 'cpf', 'cnpj'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }

  private estimarCusto(modelo: string, promptTokens: number, completionTokens: number): string {
    // Preços aproximados por 1M tokens (Janeiro 2025)
    const precos: Record<string, { input: number; output: number }> = {
      'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
      'claude-3-5-haiku': { input: 0.80, output: 4.00 },
      'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4o': { input: 2.50, output: 10.00 },
    };

    const preco = precos[modelo] || precos['claude-haiku-4-5-20251001'];
    const custoInput = (promptTokens / 1_000_000) * preco.input;
    const custoOutput = (completionTokens / 1_000_000) * preco.output;
    const custoTotal = custoInput + custoOutput;

    return `$${custoTotal.toFixed(6)}`;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Logger genérico para uso geral */
export const logger = new Logger('Elyon');

/** Logger especializado para SDR/Closer */
export const SDRLogger = new SDRLoggerClass();

/** Factory para criar loggers de serviço */
export function createLogger(service: string): Logger {
  return new Logger(service);
}

/** Middleware para Express - adiciona traceId */
export function loggerMiddleware(req: any, res: any, next: () => void): void {
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID().slice(0, 8);
  logger.setTraceId(traceId);
  res.setHeader('x-trace-id', traceId);
  
  const inicio = Date.now();
  const { method, url } = req;
  
  logger.info(`→ ${method} ${url}`);
  
  res.on('finish', () => {
    const duracao = Date.now() - inicio;
    const { statusCode } = res;
    const nivel: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    logger[nivel](`← ${method} ${url} ${statusCode}`, { duracaoMs: duracao });
  });
  
  next();
}

export default logger;
