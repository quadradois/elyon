import { ServicoAuditoria } from '../servicos/servico-auditoria';
import {
  getPaolAbTrafficPercent,
  isAgentCockpitEnabled,
  isPaolAbEnabled,
} from './feature-flags';

export type OutcomeConversa = 'SUCESSO' | 'OPTOUT' | 'HANDOFF_HUMANO' | 'PERDA' | 'ERRO';

type GrupoAA = 'A' | 'B';
type GrupoExperimento = 'CONTROL' | 'VARIANT';

interface BaseTelemetriaParams {
  tenantId: string;
  telefone?: string;
  contatoId?: string;
  leadId?: string;
  statusLead?: string;
  faseFluxo?: string;
}

interface RegistrarTurnoParams extends BaseTelemetriaParams {
  agenteInicial?: string;
  agenteFinal?: string;
  duracaoMs: number;
  sucesso: boolean;
  erro?: string;
  fallback?: string;
  guardrail?: string;
  toolCalls?: number;
  handoffs?: number;
  repeticaoDetectada?: boolean;
  custoEstimadoUSD?: number;
  tokenAlertLevel?: 'ok' | 'warn' | 'critical';
  paolModo?: 'SHADOW' | 'AB_VARIANT' | 'CONTROL';
  paolAplicado?: boolean;
  paolAcao?: string;
  paolDivergencia?: boolean;
  paolGanhoPotencial?: number;
  paolCustoPotencialExtraUSD?: number;
  // Breakdown de latência por fase (ms desde início do turno)
  tFases?: Record<string, number>;
}

interface RegistrarOutcomeParams extends BaseTelemetriaParams {
  outcome: OutcomeConversa;
  origem: 'ORCHESTRATOR' | 'GUARDRAIL' | 'SYSTEM';
  motivo?: string;
  paolModo?: 'SHADOW' | 'AB_VARIANT' | 'CONTROL';
  paolAplicado?: boolean;
  paolAcao?: string;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function resolverSeed(params: BaseTelemetriaParams): string {
  return params.contatoId || params.leadId || params.telefone || 'seed-default';
}

export function calcularGrupoAA(params: BaseTelemetriaParams): GrupoAA {
  const seed = resolverSeed(params);
  return hashString(seed) % 2 === 0 ? 'A' : 'B';
}

export function calcularGrupoExperimento(params: BaseTelemetriaParams): GrupoExperimento {
  if (!isPaolAbEnabled()) return 'CONTROL';
  const seed = resolverSeed(params);
  const bucket = hashString(seed) % 100;
  return bucket < getPaolAbTrafficPercent() ? 'VARIANT' : 'CONTROL';
}

export function registrarTelemetriaTurno(params: RegistrarTurnoParams): void {
  if (!isAgentCockpitEnabled()) return;

  const detalhes = {
    aaGroup: calcularGrupoAA(params),
    experimentGroup: calcularGrupoExperimento(params),
    telefone: params.telefone || null,
    contatoId: params.contatoId || null,
    leadId: params.leadId || null,
    statusLead: params.statusLead || null,
    faseFluxo: params.faseFluxo || null,
    agenteInicial: params.agenteInicial || null,
    agenteFinal: params.agenteFinal || null,
    duracaoMs: params.duracaoMs,
    sucesso: params.sucesso,
    erro: params.erro || null,
    fallback: params.fallback || 'NONE',
    guardrail: params.guardrail || null,
    toolCalls: params.toolCalls ?? 0,
    handoffs: params.handoffs ?? 0,
    repeticaoDetectada: !!params.repeticaoDetectada,
    custoEstimadoUSD: params.custoEstimadoUSD ?? null,
    tokenAlertLevel: params.tokenAlertLevel ?? null,
    paolModo: params.paolModo ?? null,
    paolAplicado: params.paolAplicado ?? false,
    paolAcao: params.paolAcao ?? null,
    paolDivergencia: params.paolDivergencia ?? false,
    paolGanhoPotencial: params.paolGanhoPotencial ?? null,
    paolCustoPotencialExtraUSD: params.paolCustoPotencialExtraUSD ?? null,
    tFases: params.tFases ?? null,
    ts: new Date().toISOString(),
  };

  // Registro primário: agrupado por Conversa (para métricas de IA)
  ServicoAuditoria.registrar({
    tenantId: params.tenantId,
    acao: 'AGENT_TURNO',
    entidade: 'Conversa',
    entidadeId: params.leadId || params.contatoId,
    ip: '127.0.0.1',
    detalhes,
  });

  // Registro secundário: vinculado ao Lead (para cockpit-eventos no painel do corretor)
  if (params.leadId) {
    ServicoAuditoria.registrar({
      tenantId: params.tenantId,
      acao: 'COCKPIT_AGENT_TURNO',
      entidade: 'Lead',
      entidadeId: params.leadId,
      ip: '127.0.0.1',
      detalhes,
    });
  }
}

export function registrarOutcomeConversa(params: RegistrarOutcomeParams): void {
  if (!isAgentCockpitEnabled()) return;

  const detalhes = {
    aaGroup: calcularGrupoAA(params),
    experimentGroup: calcularGrupoExperimento(params),
    telefone: params.telefone || null,
    contatoId: params.contatoId || null,
    leadId: params.leadId || null,
    statusLead: params.statusLead || null,
    faseFluxo: params.faseFluxo || null,
    outcome: params.outcome,
    origem: params.origem,
    motivo: params.motivo || null,
    paolModo: params.paolModo ?? null,
    paolAplicado: params.paolAplicado ?? false,
    paolAcao: params.paolAcao ?? null,
    ts: new Date().toISOString(),
  };

  // Registro primário: agrupado por Conversa (para métricas de IA)
  ServicoAuditoria.registrar({
    tenantId: params.tenantId,
    acao: 'AGENT_OUTCOME',
    entidade: 'Conversa',
    entidadeId: params.leadId || params.contatoId,
    ip: '127.0.0.1',
    detalhes,
  });

  // Registro secundário: vinculado ao Lead (para cockpit-eventos no painel do corretor)
  if (params.leadId) {
    ServicoAuditoria.registrar({
      tenantId: params.tenantId,
      acao: 'COCKPIT_AGENT_OUTCOME',
      entidade: 'Lead',
      entidadeId: params.leadId,
      ip: '127.0.0.1',
      detalhes,
    });
  }
}
