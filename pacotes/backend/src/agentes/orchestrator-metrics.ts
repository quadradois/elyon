import type { TipoAgente } from './agent-chain';

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
}

export function shortId(valor?: string): string | null {
  if (!valor) return null;
  return valor.length > 8 ? `${valor.substring(0, 8)}...` : valor;
}

export function logMetricaOrchestrator(params: LogMetricaOrchestratorParams): void {
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
  };

  console.log(`[ORCH-METRICS] ${JSON.stringify(payload)}`);
}