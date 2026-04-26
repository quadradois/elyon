import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import { gerarHashContexto, normalizarContextoAprendizado, type PadraoAcao } from '../servicos/banco-aprendizados';

export type PaolModoExecucao = 'SHADOW' | 'AB_VARIANT' | 'CONTROL';

export interface PaolContexto {
  tenantId: string;
  faseFluxo: string;
  statusLead?: string;
  agenteInicial?: string;
  sentimento?: string | null;
}

export interface PaolCandidateAction {
  acao: string;
  fonte: 'HISTORICO' | 'HEURISTICA';
  prior: number;
  scorePolitica: number;
  scoreFinal: number;
  amostraPolitica: number;
}

export interface PaolDecision {
  contextoNormalizado: string;
  contextoHash: string;
  modo: PaolModoExecucao;
  acaoBaseline: string;
  acaoEscolhida: string;
  divergencia: boolean;
  ganhoPotencial: number;
  custoPotencialExtraUsd: number;
  candidatos: PaolCandidateAction[];
  aplicouNaResposta: boolean;
}

const FASE_ACTIONS: Record<string, string[]> = {
  MEIO_CAMPO: ['resposta:sdr', 'tool:registrar_indicacao', 'tool:registrar_optout'],
  DESCOBERTA: ['tool:qualificar_lead', 'tool:converter_para_lead', 'resposta:sdr'],
  DIAGNOSTICO_SPIN: ['tool:qualificar_lead', 'tool:atualizar_dados_lead', 'resposta:sdr'],
  PITCH: ['tool:mover_para_fase', 'resposta:sdr', 'tool:qualificar_lead'],
  AGENDAMENTO: ['tool:agendar_reuniao_closer', 'tool:enviar_link_agendamento', 'tool:agendar_followup'],
  FOLLOW_UP: ['tool:agendar_followup', 'resposta:admin', 'resposta:sdr'],
  RECUO: ['tool:registrar_optout', 'tool:agendar_followup', 'resposta:admin'],
};

function parseFloatEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function scoreFromPrior(value: number): number {
  return clamp(value, -1, 1);
}

function estimateActionCost(acao: string): number {
  if (acao.startsWith('tool:agendar_reuniao_closer')) return 0.002;
  if (acao.startsWith('tool:')) return 0.001;
  return 0.0002;
}

function getEmaAlpha(): number {
  return parseFloatEnv('PAOL_EMA_ALPHA', 0.2, 0.01, 1);
}

function getMinExplorationBonus(): number {
  return parseFloatEnv('PAOL_EXPLORATION_BONUS', 0.05, 0, 0.5);
}

function normalizeOutcomeSuccess(outcome: string): number {
  const o = String(outcome || 'SUCESSO').toUpperCase();
  if (o === 'SUCESSO') return 1;
  if (o === 'HANDOFF_HUMANO') return 0.7;
  if (o === 'PERDA') return 0;
  if (o === 'OPTOUT') return 0;
  if (o === 'ERRO') return 0;
  return 0.4;
}

export function gerarInstrucaoPaol(decision: PaolDecision): string {
  return `[PAOL-ACT]
Acao prioritaria para este turno: ${decision.acaoEscolhida}
Contexto-hash: ${decision.contextoHash}
Regra: priorize esta acao como primeiro passo, respeitando guardrails e politicas de compliance.`; 
}

class PaolPolicyService {
  async decidirAcao(params: {
    contexto: PaolContexto;
    padroesHistoricos: PadraoAcao[];
    modo: PaolModoExecucao;
    aplicar: boolean;
  }): Promise<PaolDecision> {
    const contextoNormalizado = normalizarContextoAprendizado({
      faseFluxo: params.contexto.faseFluxo,
      statusLead: params.contexto.statusLead,
      agenteInicial: params.contexto.agenteInicial,
      sentimento: params.contexto.sentimento || 'NEUTRO',
    });
    const contextoHash = gerarHashContexto(contextoNormalizado);

    const candidatosBase = this.gerarCandidatosBase(params.contexto.faseFluxo, params.padroesHistoricos);
    const acoes = candidatosBase.map((c) => c.acao);

    const politicas = acoes.length > 0
      ? await (prisma as any).paolPolitica.findMany({
          where: {
            tenantId: params.contexto.tenantId,
            contextoHash,
            acao: { in: acoes },
          },
          select: {
            acao: true,
            emaRecompensa: true,
            emaSucesso: true,
            amostra: true,
          },
        })
      : [];

    const mapPolitica = new Map<string, { emaRecompensa: number; emaSucesso: number; amostra: number }>();
    for (const row of politicas as any[]) {
      mapPolitica.set(String(row.acao), {
        emaRecompensa: Number(row.emaRecompensa || 0),
        emaSucesso: Number(row.emaSucesso || 0),
        amostra: Number(row.amostra || 0),
      });
    }

    const explorationBonus = getMinExplorationBonus();
    const candidatos: PaolCandidateAction[] = candidatosBase.map((base) => {
      const p = mapPolitica.get(base.acao);
      const amostra = p?.amostra || 0;
      const scorePolitica = p
        ? Number(((p.emaRecompensa * 0.65) + (p.emaSucesso * 0.35)).toFixed(4))
        : 0;

      const bonus = amostra === 0 ? explorationBonus : 0;
      const scoreFinal = Number((((scoreFromPrior(base.prior) * 0.45) + (scorePolitica * 0.55)) + bonus).toFixed(4));

      return {
        acao: base.acao,
        fonte: base.fonte,
        prior: base.prior,
        scorePolitica,
        scoreFinal,
        amostraPolitica: amostra,
      };
    });

    candidatos.sort((a, b) => b.scoreFinal - a.scoreFinal);

    const baseline = candidatosBase[0]?.acao || 'resposta:sdr';
    const escolhida = candidatos[0]?.acao || baseline;

    const scoreEscolhida = candidatos.find((c) => c.acao === escolhida)?.scoreFinal || 0;
    const scoreBaseline = candidatos.find((c) => c.acao === baseline)?.scoreFinal || 0;

    return {
      contextoNormalizado,
      contextoHash,
      modo: params.modo,
      acaoBaseline: baseline,
      acaoEscolhida: escolhida,
      divergencia: escolhida !== baseline,
      ganhoPotencial: Number((scoreEscolhida - scoreBaseline).toFixed(4)),
      custoPotencialExtraUsd: Number(Math.max(0, estimateActionCost(escolhida) - estimateActionCost(baseline)).toFixed(6)),
      candidatos: candidatos.slice(0, 3),
      aplicouNaResposta: params.aplicar,
    };
  }

  async aprender(params: {
    tenantId: string;
    contextoHash: string;
    acaoExecutada: string;
    recompensa: number;
    outcome: string;
    origem: 'ORCHESTRATOR' | 'GUARDRAIL' | 'SYSTEM';
    fallback?: string;
  }): Promise<void> {
    const acao = String(params.acaoExecutada || '').trim();
    if (!acao) return;

    const alpha = getEmaAlpha();

    try {
      const existente = await (prisma as any).paolPolitica.findUnique({
        where: {
          tenantId_contextoHash_acao: {
            tenantId: params.tenantId,
            contextoHash: params.contextoHash,
            acao,
          },
        },
        select: {
          id: true,
          emaRecompensa: true,
          emaSucesso: true,
          amostra: true,
        },
      });

      if (!existente) {
        await (prisma as any).paolPolitica.create({
          data: {
            tenantId: params.tenantId,
            contextoHash: params.contextoHash,
            acao,
            emaRecompensa: Number(params.recompensa.toFixed(4)),
            emaSucesso: normalizeOutcomeSuccess(params.outcome),
            amostra: 1,
            ultimaRecompensa: Number(params.recompensa.toFixed(4)),
            ultimoOutcome: params.outcome,
            ultimaOrigem: params.origem,
            ultimoFallback: params.fallback || null,
          },
        });
        return;
      }

      const emaRecompensa = Number((((1 - alpha) * Number(existente.emaRecompensa || 0)) + (alpha * params.recompensa)).toFixed(4));
      const emaSucesso = Number((((1 - alpha) * Number(existente.emaSucesso || 0)) + (alpha * normalizeOutcomeSuccess(params.outcome))).toFixed(4));

      await (prisma as any).paolPolitica.update({
        where: {
          tenantId_contextoHash_acao: {
            tenantId: params.tenantId,
            contextoHash: params.contextoHash,
            acao,
          },
        },
        data: {
          emaRecompensa,
          emaSucesso,
          amostra: Number(existente.amostra || 0) + 1,
          ultimaRecompensa: Number(params.recompensa.toFixed(4)),
          ultimoOutcome: params.outcome,
          ultimaOrigem: params.origem,
          ultimoFallback: params.fallback || null,
        },
      });
    } catch (error) {
      logger.warn({ err: error, tenantId: params.tenantId }, '[PAOL] Falha ao atualizar politica (nao bloqueante)');
    }
  }

  private gerarCandidatosBase(faseFluxo: string, padroesHistoricos: PadraoAcao[]) {
    const candidatos: Array<{ acao: string; fonte: 'HISTORICO' | 'HEURISTICA'; prior: number }> = [];
    const seen = new Set<string>();

    for (const padrao of padroesHistoricos) {
      const acao = String(padrao.acao || '').trim();
      if (!acao || seen.has(acao)) continue;
      seen.add(acao);
      candidatos.push({
        acao,
        fonte: 'HISTORICO',
        prior: clamp(Number(padrao.score || padrao.recompensaMedia || 0), -1, 1),
      });
      if (candidatos.length >= 3) return candidatos;
    }

    const fase = String(faseFluxo || '').toUpperCase();
    const fallback = FASE_ACTIONS[fase] || ['resposta:sdr', 'tool:qualificar_lead', 'tool:agendar_followup'];
    for (const acao of fallback) {
      if (seen.has(acao)) continue;
      seen.add(acao);
      candidatos.push({ acao, fonte: 'HEURISTICA', prior: 0.15 });
      if (candidatos.length >= 3) break;
    }

    return candidatos;
  }
}

export const paolPolicyService = new PaolPolicyService();
