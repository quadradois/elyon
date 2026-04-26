import { createHash } from 'crypto';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';

export interface ContextoAprendizado {
  faseFluxo: string;
  statusLead?: string;
  agenteInicial?: string;
  sentimento?: string | null;
}

export interface RegistrarAprendizadoInput {
  tenantId: string;
  contexto: ContextoAprendizado;
  acao: string;
  resultado: string;
  recompensa: number;
  metadados?: Record<string, any>;
}

export interface PadraoAcao {
  acao: string;
  amostra: number;
  recompensaMedia: number;
  score: number;
}

export interface TopPadraoTenant {
  contexto: string;
  contextoHash: string;
  acao: string;
  amostra: number;
  recompensaMedia: number;
  ultimaOcorrencia: Date;
}

function clampReward(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.max(-1, Math.min(1, Number(valor.toFixed(4))));
}

function sanitizeText(value: string, fallback: string, max = 180): string {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text.length > max ? text.slice(0, max) : text;
}

export function normalizarContextoAprendizado(ctx: ContextoAprendizado): string {
  const faseFluxo = sanitizeText(ctx.faseFluxo, 'FASE_DESCONHECIDA', 80).toUpperCase();
  const statusLead = sanitizeText(ctx.statusLead || 'SEM_STATUS', 'SEM_STATUS', 80).toUpperCase();
  const agenteInicial = sanitizeText(ctx.agenteInicial || 'SEM_AGENTE', 'SEM_AGENTE', 80).toUpperCase();
  const sentimento = sanitizeText(ctx.sentimento || 'NEUTRO', 'NEUTRO', 40).toUpperCase();
  return [faseFluxo, statusLead, agenteInicial, sentimento].join('|');
}

export function gerarHashContexto(contextoNormalizado: string): string {
  return createHash('sha1').update(contextoNormalizado).digest('hex').slice(0, 16);
}

export function calcularRecompensaTurno(params: {
  sucesso: boolean;
  fallback?: string;
  outcome?: 'SUCESSO' | 'OPTOUT' | 'HANDOFF_HUMANO' | 'PERDA' | 'ERRO';
  toolCalls?: number;
  handoffs?: number;
}): number {
  const outcome = params.outcome || (params.sucesso ? 'SUCESSO' : 'ERRO');
  let reward = 0;

  if (outcome === 'SUCESSO') reward = 0.8;
  if (outcome === 'HANDOFF_HUMANO') reward = 0.35;
  if (outcome === 'OPTOUT') reward = -1;
  if (outcome === 'PERDA') reward = -0.8;
  if (outcome === 'ERRO') reward = -0.7;

  const fallback = String(params.fallback || 'NONE').toUpperCase();
  if (fallback !== 'NONE') reward -= 0.2;
  if (fallback === 'ANTI_REPEAT_GUARD') reward -= 0.15;
  if (fallback === 'EXCEPTION') reward -= 0.25;

  const toolCalls = Math.max(0, params.toolCalls || 0);
  const handoffs = Math.max(0, params.handoffs || 0);
  reward += Math.min(0.1, toolCalls * 0.02);
  reward += Math.min(0.05, handoffs * 0.01);

  return clampReward(reward);
}

class BancoDeAprendizadosService {
  async registrar(input: RegistrarAprendizadoInput): Promise<void> {
    try {
      const contexto = normalizarContextoAprendizado(input.contexto);
      const contextoHash = gerarHashContexto(contexto);
      const acao = sanitizeText(input.acao, 'acao_desconhecida', 120);
      const resultado = sanitizeText(input.resultado, 'resultado_desconhecido', 120);
      const recompensa = clampReward(input.recompensa);

      await (prisma as any).aprendizadoAgente.create({
        data: {
          tenantId: input.tenantId,
          contexto,
          contextoHash,
          acao,
          resultado,
          recompensa,
          metadados: input.metadados || {},
        },
      });
    } catch (err) {
      logger.warn({ err }, '[LEARNING-BANK] Falha ao registrar aprendizado (não bloqueante)');
    }
  }

  async consultarPadroes(
    tenantId: string,
    contexto: ContextoAprendizado,
    options?: { limit?: number; diasJanela?: number; minimoAmostra?: number }
  ): Promise<PadraoAcao[]> {
    const limit = Math.max(1, Math.min(20, options?.limit ?? 5));
    const minimoAmostra = Math.max(1, options?.minimoAmostra ?? 2);
    const diasJanela = Math.max(1, options?.diasJanela ?? 90);
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - diasJanela);

    try {
      const contextoNormalizado = normalizarContextoAprendizado(contexto);
      const contextoHash = gerarHashContexto(contextoNormalizado);

      const grouped = await (prisma as any).aprendizadoAgente.groupBy({
        by: ['acao'],
        where: {
          tenantId,
          contextoHash,
          criadoEm: { gte: dataInicial },
        },
        _avg: { recompensa: true },
        _count: { _all: true },
      });

      return grouped
        .map((g: any) => {
          const amostra = Number(g?._count?._all || 0);
          const recompensaMedia = Number((g?._avg?.recompensa || 0).toFixed(4));
          const score = Number((recompensaMedia * Math.log1p(amostra)).toFixed(4));
          return { acao: String(g.acao), amostra, recompensaMedia, score };
        })
        .filter((p: PadraoAcao) => p.amostra >= minimoAmostra)
        .sort((a: PadraoAcao, b: PadraoAcao) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.recompensaMedia !== a.recompensaMedia) return b.recompensaMedia - a.recompensaMedia;
          return b.amostra - a.amostra;
        })
        .slice(0, limit);
    } catch (err) {
      logger.warn({ err }, '[LEARNING-BANK] Falha ao consultar padrões (não bloqueante)');
      return [];
    }
  }

  async obterTopPadroesTenant(
    tenantId: string,
    options?: { limit?: number; diasJanela?: number; minimoAmostra?: number }
  ): Promise<TopPadraoTenant[]> {
    const limit = Math.max(1, Math.min(50, options?.limit ?? 10));
    const minimoAmostra = Math.max(1, options?.minimoAmostra ?? 3);
    const diasJanela = Math.max(1, options?.diasJanela ?? 30);
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - diasJanela);

    try {
      const rows = await (prisma as any).aprendizadoAgente.findMany({
        where: {
          tenantId,
          criadoEm: { gte: dataInicial },
        },
        select: {
          contexto: true,
          contextoHash: true,
          acao: true,
          recompensa: true,
          criadoEm: true,
        },
        orderBy: { criadoEm: 'desc' },
        take: 5000,
      });

      const map = new Map<string, {
        contexto: string;
        contextoHash: string;
        acao: string;
        somaRecompensa: number;
        amostra: number;
        ultimaOcorrencia: Date;
      }>();

      for (const row of rows) {
        const key = `${row.contextoHash}::${row.acao}`;
        const atual = map.get(key);
        if (!atual) {
          map.set(key, {
            contexto: row.contexto,
            contextoHash: row.contextoHash,
            acao: row.acao,
            somaRecompensa: Number(row.recompensa || 0),
            amostra: 1,
            ultimaOcorrencia: row.criadoEm,
          });
        } else {
          atual.somaRecompensa += Number(row.recompensa || 0);
          atual.amostra += 1;
          if (row.criadoEm > atual.ultimaOcorrencia) atual.ultimaOcorrencia = row.criadoEm;
        }
      }

      return Array.from(map.values())
        .filter((item) => item.amostra >= minimoAmostra)
        .map((item) => ({
          contexto: item.contexto,
          contextoHash: item.contextoHash,
          acao: item.acao,
          amostra: item.amostra,
          recompensaMedia: Number((item.somaRecompensa / item.amostra).toFixed(4)),
          ultimaOcorrencia: item.ultimaOcorrencia,
        }))
        .sort((a, b) => {
          if (b.recompensaMedia !== a.recompensaMedia) return b.recompensaMedia - a.recompensaMedia;
          return b.amostra - a.amostra;
        })
        .slice(0, limit);
    } catch (err) {
      logger.warn({ err }, '[LEARNING-BANK] Falha ao obter top padrões do tenant (não bloqueante)');
      return [];
    }
  }
}

export const bancoDeAprendizadosService = new BancoDeAprendizadosService();

