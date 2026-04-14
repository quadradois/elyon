import type { TipoAgente } from './agent-chain';
import { logger } from '../lib/logger';

// ====================================
// LIMITES DE ALERTAS DE TOKENS
// Configuráveis via env para cada tenant ajustar conforme necessidade.
// ====================================
const TOKEN_ALERTA_WARN  = parseInt(process.env.TOKEN_ALERTA_WARN  || '4000', 10);
const TOKEN_ALERTA_CRIT  = parseInt(process.env.TOKEN_ALERTA_CRIT  || '8000', 10);
const TOKEN_CUSTO_INPUT_PER_1K  = parseFloat(process.env.TOKEN_CUSTO_INPUT_1K  || '0.002');  // USD
const TOKEN_CUSTO_OUTPUT_PER_1K = parseFloat(process.env.TOKEN_CUSTO_OUTPUT_1K || '0.008');   // USD

interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

interface TokenAlert {
  level: 'ok' | 'warn' | 'critical';
  totalTokens: number;
  custoEstimadoUSD: number;
}

/**
 * Avalia o consumo de tokens e retorna nível de alerta + custo estimado.
 * Níveis:
 *   - ok:       totalTokens <= TOKEN_ALERTA_WARN (default 4000)
 *   - warn:     totalTokens > TOKEN_ALERTA_WARN e <= TOKEN_ALERTA_CRIT
 *   - critical: totalTokens > TOKEN_ALERTA_CRIT (default 8000)
 */
export function avaliarConsumoTokens(tokens?: TokenUsage): TokenAlert {
  const total = tokens?.totalTokens ?? 0;
  const input = tokens?.inputTokens ?? 0;
  const output = tokens?.outputTokens ?? 0;

  const custoEstimadoUSD = (input / 1000) * TOKEN_CUSTO_INPUT_PER_1K
                         + (output / 1000) * TOKEN_CUSTO_OUTPUT_PER_1K;

  let level: 'ok' | 'warn' | 'critical' = 'ok';
  if (total > TOKEN_ALERTA_CRIT) level = 'critical';
  else if (total > TOKEN_ALERTA_WARN) level = 'warn';

  return { level, totalTokens: total, custoEstimadoUSD };
}

interface LogMetricaOrchestratorParams {
  tenantId: string;
  telefone?: string;
  contatoId?: string;
  leadId?: string;
  statusLead?: string;
  faseFluxo: string;
  agenteInicial?: TipoAgente;
  agenteFinal?: TipoAgente;
  toolCalls: number;
  handoffs: number;
  fallback: string;
  guardrail?: string;
  duracaoMs: number;
  sucesso: boolean;
  erro?: string;
  /** Token usage do SDK (result.usage) */
  tokens?: TokenUsage;
}

export function shortId(valor?: string): string | null {
  if (!valor) return null;
  return valor.length > 8 ? `${valor.substring(0, 8)}...` : valor;
}

export function logMetricaOrchestrator(params: LogMetricaOrchestratorParams): void {
  // Avaliar consumo de tokens (alertas)
  const tokenAlert = avaliarConsumoTokens(params.tokens);

  const payload = {
    ts: new Date().toISOString(),
    tenantId: params.tenantId,
    telefone: params.telefone || null,
    contatoId: shortId(params.contatoId),
    leadId: shortId(params.leadId),
    statusLead: params.statusLead || 'SEM_STATUS',
    faseFluxo: params.faseFluxo,
    agenteInicial: params.agenteInicial || null,
    agenteFinal: params.agenteFinal || null,
    toolCalls: params.toolCalls,
    handoffs: params.handoffs,
    fallback: params.fallback,
    guardrail: params.guardrail || null,
    duracaoMs: params.duracaoMs,
    sucesso: params.sucesso,
    erro: params.erro || null,
    // Token usage (quando disponível via SDK result.usage)
    tokensInput: params.tokens?.inputTokens ?? null,
    tokensOutput: params.tokens?.outputTokens ?? null,
    tokensTotal: params.tokens?.totalTokens ?? null,
    // Alerta de consumo
    tokenAlertLevel: tokenAlert.level,
    custoEstimadoUSD: tokenAlert.custoEstimadoUSD,
  };

  logger.debug(`[ORCH-METRICS] ${JSON.stringify(payload)}`);

  // Emitir alertas de consumo elevado
  if (tokenAlert.level === 'critical') {
    logger.warn(`[ORCH-TOKENS] 🚨 CRITICAL — ${tokenAlert.totalTokens} tokens (custo ~$${tokenAlert.custoEstimadoUSD.toFixed(4)}) | tenant=${params.tenantId} agente=${params.agenteFinal || params.agenteInicial || 'N/A'} telefone=${params.telefone || 'N/A'}`);
  } else if (tokenAlert.level === 'warn') {
    logger.warn(`[ORCH-TOKENS] ⚠️ WARN — ${tokenAlert.totalTokens} tokens (custo ~$${tokenAlert.custoEstimadoUSD.toFixed(4)}) | tenant=${params.tenantId}`);
  }
}