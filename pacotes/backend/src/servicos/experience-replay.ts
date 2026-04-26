import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import { isExperienceReplayEnabled, isLearningBankEnabled } from '../agentes/feature-flags';
import { bancoDeAprendizadosService } from './banco-aprendizados';

type ReplayStatus = 'SUCESSO' | 'SEM_DADOS' | 'PULADO' | 'ERRO' | 'DESABILITADO';

type RegistroAprendizado = {
  contexto: string;
  contextoHash: string;
  acao: string;
  resultado: string;
  recompensa: number;
  criadoEm: Date;
};

interface ReplayConfig {
  periodoRecenteHoras: number;
  janelaHistoricaDias: number;
  amostraRecente: number;
  amostraHistorica: number;
  poolHistorico: number;
  taxaRecente: number;
  taxaHistorica: number;
  ajusteMaxPorPadrao: number;
  limiteDerivaExecucaoAbs: number;
  ajusteMinimoAbsoluto: number;
  maxPadroesPorExecucao: number;
}

interface ReplayTenantResult {
  tenantId: string;
  status: ReplayStatus;
  amostraRecente: number;
  amostraHistorica: number;
  padroesAvaliados: number;
  padroesAjustados: number;
  ajusteTotalAbs: number;
  erro?: string;
}

interface ReplayDiarioResult {
  status: ReplayStatus;
  tenantsProcessados: number;
  tenantsComErro: number;
  ajustesAplicados: number;
  ajustesTotalAbs: number;
  resultados: ReplayTenantResult[];
}

type PadraoReplay = {
  contexto: string;
  contextoHash: string;
  acao: string;
  somaRecente: number;
  qtdRecente: number;
  somaHistorica: number;
  qtdHistorica: number;
};

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.round(clampNumber(raw, min, max));
}

function parseFloatEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return clampNumber(raw, min, max);
}

function getReplayConfig(): ReplayConfig {
  return {
    periodoRecenteHoras: parseIntEnv('EXPERIENCE_REPLAY_RECENT_HOURS', 24, 1, 168),
    janelaHistoricaDias: parseIntEnv('EXPERIENCE_REPLAY_HISTORICAL_DAYS', 90, 7, 365),
    amostraRecente: parseIntEnv('EXPERIENCE_REPLAY_RECENT_SAMPLE', 150, 20, 1000),
    amostraHistorica: parseIntEnv('EXPERIENCE_REPLAY_HISTORICAL_SAMPLE', 120, 20, 1000),
    poolHistorico: parseIntEnv('EXPERIENCE_REPLAY_HISTORICAL_POOL', 1200, 100, 5000),
    taxaRecente: parseFloatEnv('EXPERIENCE_REPLAY_RECENT_RATE', 0.14, 0.01, 1),
    taxaHistorica: parseFloatEnv('EXPERIENCE_REPLAY_HISTORICAL_RATE', 0.05, 0.001, 1),
    ajusteMaxPorPadrao: parseFloatEnv('EXPERIENCE_REPLAY_MAX_ADJUSTMENT_PER_PATTERN', 0.12, 0.01, 1),
    limiteDerivaExecucaoAbs: parseFloatEnv('EXPERIENCE_REPLAY_MAX_TOTAL_ADJUSTMENT', 1.2, 0.05, 10),
    ajusteMinimoAbsoluto: parseFloatEnv('EXPERIENCE_REPLAY_MIN_ABS_ADJUSTMENT', 0.02, 0.001, 1),
    maxPadroesPorExecucao: parseIntEnv('EXPERIENCE_REPLAY_MAX_PATTERNS', 60, 5, 300),
  };
}

function randomSample<T>(array: T[], take: number): T[] {
  if (array.length <= take) return array;
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone.slice(0, take);
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || 'erro_desconhecido');
}

function toReplayRows(
  recentRows: RegistroAprendizado[],
  historicalRows: RegistroAprendizado[]
): PadraoReplay[] {
  const map = new Map<string, PadraoReplay>();

  for (const row of recentRows) {
    const key = `${row.contextoHash}::${row.acao}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, {
        contexto: row.contexto,
        contextoHash: row.contextoHash,
        acao: row.acao,
        somaRecente: row.recompensa,
        qtdRecente: 1,
        somaHistorica: 0,
        qtdHistorica: 0,
      });
      continue;
    }
    current.somaRecente += row.recompensa;
    current.qtdRecente += 1;
  }

  for (const row of historicalRows) {
    const key = `${row.contextoHash}::${row.acao}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, {
        contexto: row.contexto,
        contextoHash: row.contextoHash,
        acao: row.acao,
        somaRecente: 0,
        qtdRecente: 0,
        somaHistorica: row.recompensa,
        qtdHistorica: 1,
      });
      continue;
    }
    current.somaHistorica += row.recompensa;
    current.qtdHistorica += 1;
  }

  return Array.from(map.values());
}

function countOutcomes(rows: RegistroAprendizado[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) {
    const key = String(row.resultado || 'DESCONHECIDO').toUpperCase();
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

class ExperienceReplayService {
  async executarReplayDiario(options?: { forcar?: boolean; tenantIds?: string[] }): Promise<ReplayDiarioResult> {
    const forcar = Boolean(options?.forcar);

    if (!isLearningBankEnabled() && !forcar) {
      return {
        status: 'DESABILITADO',
        tenantsProcessados: 0,
        tenantsComErro: 0,
        ajustesAplicados: 0,
        ajustesTotalAbs: 0,
        resultados: [],
      };
    }

    if (!isExperienceReplayEnabled() && !forcar) {
      return {
        status: 'DESABILITADO',
        tenantsProcessados: 0,
        tenantsComErro: 0,
        ajustesAplicados: 0,
        ajustesTotalAbs: 0,
        resultados: [],
      };
    }

    const whereTenant: any = options?.tenantIds?.length
      ? { id: { in: options.tenantIds } }
      : { status: 'ATIVO' };

    const tenants = await prisma.tenant.findMany({
      where: whereTenant,
      select: { id: true },
      take: 500,
    });

    const resultados: ReplayTenantResult[] = [];

    for (const tenant of tenants) {
      const replayTenant = await this.executarReplayTenant(tenant.id, { forcar });
      resultados.push(replayTenant);
    }

    const tenantsComErro = resultados.filter((r) => r.status === 'ERRO').length;
    const ajustesAplicados = resultados.reduce((acc, r) => acc + r.padroesAjustados, 0);
    const ajustesTotalAbs = Number(
      resultados.reduce((acc, r) => acc + r.ajusteTotalAbs, 0).toFixed(4)
    );

    return {
      status: tenantsComErro > 0 ? 'ERRO' : 'SUCESSO',
      tenantsProcessados: resultados.length,
      tenantsComErro,
      ajustesAplicados,
      ajustesTotalAbs,
      resultados,
    };
  }

  private async executarReplayTenant(tenantId: string, options?: { forcar?: boolean }): Promise<ReplayTenantResult> {
    const inicio = Date.now();
    const config = getReplayConfig();
    const forcar = Boolean(options?.forcar);

    const baseResult: ReplayTenantResult = {
      tenantId,
      status: 'SEM_DADOS',
      amostraRecente: 0,
      amostraHistorica: 0,
      padroesAvaliados: 0,
      padroesAjustados: 0,
      ajusteTotalAbs: 0,
    };

    try {
      const inicioDia = getStartOfDay(new Date());

      if (!forcar) {
        const jaExecutadoHoje = await (prisma as any).auditoriaReplayAprendizado.findFirst({
          where: {
            tenantId,
            executadoEm: { gte: inicioDia },
            status: { in: ['SUCESSO', 'SEM_DADOS', 'PULADO'] },
          },
          orderBy: { executadoEm: 'desc' },
        });

        if (jaExecutadoHoje) {
          return {
            ...baseResult,
            status: 'PULADO',
          };
        }
      }

      const limiteRecente = new Date();
      limiteRecente.setHours(limiteRecente.getHours() - config.periodoRecenteHoras);

      const limiteHistorico = new Date();
      limiteHistorico.setDate(limiteHistorico.getDate() - config.janelaHistoricaDias);

      const [recentRowsRaw, historicalPoolRaw] = await Promise.all([
        (prisma as any).aprendizadoAgente.findMany({
          where: {
            tenantId,
            criadoEm: { gte: limiteRecente },
          },
          select: {
            contexto: true,
            contextoHash: true,
            acao: true,
            resultado: true,
            recompensa: true,
            criadoEm: true,
          },
          orderBy: { criadoEm: 'desc' },
          take: config.amostraRecente,
        }),
        (prisma as any).aprendizadoAgente.findMany({
          where: {
            tenantId,
            criadoEm: { gte: limiteHistorico, lt: limiteRecente },
          },
          select: {
            contexto: true,
            contextoHash: true,
            acao: true,
            resultado: true,
            recompensa: true,
            criadoEm: true,
          },
          orderBy: { criadoEm: 'desc' },
          take: config.poolHistorico,
        }),
      ]);

      const recentRows: RegistroAprendizado[] = recentRowsRaw.map((r: any) => ({
        contexto: String(r.contexto),
        contextoHash: String(r.contextoHash),
        acao: String(r.acao),
        resultado: String(r.resultado),
        recompensa: Number(r.recompensa || 0),
        criadoEm: r.criadoEm,
      }));

      const historicalPool: RegistroAprendizado[] = historicalPoolRaw.map((r: any) => ({
        contexto: String(r.contexto),
        contextoHash: String(r.contextoHash),
        acao: String(r.acao),
        resultado: String(r.resultado),
        recompensa: Number(r.recompensa || 0),
        criadoEm: r.criadoEm,
      }));

      const historicalRows = randomSample(historicalPool, config.amostraHistorica);
      const totalRows = recentRows.length + historicalRows.length;

      if (totalRows === 0) {
        await this.registrarAuditoria({
          tenantId,
          status: 'SEM_DADOS',
          config,
          amostraRecente: 0,
          amostraHistorica: 0,
          padroesAvaliados: 0,
          padroesAjustados: 0,
          ajusteTotalAbs: 0,
          resumoOutcomes: {},
          ajustesAplicados: [],
          duracaoMs: Date.now() - inicio,
        });

        return baseResult;
      }

      const padroes = toReplayRows(recentRows, historicalRows);
      const candidatos = padroes
        .map((padrao) => {
          const totalCount = padrao.qtdRecente + padrao.qtdHistorica;
          if (totalCount === 0) return null;

          const somaTotal = padrao.somaRecente + padrao.somaHistorica;
          const mediaBase = somaTotal / totalCount;

          const pesoRecente = padrao.qtdRecente * config.taxaRecente;
          const pesoHistorico = padrao.qtdHistorica * config.taxaHistorica;
          const somaPesos = pesoRecente + pesoHistorico;
          const mediaPonderada = somaPesos > 0
            ? ((padrao.somaRecente * config.taxaRecente) + (padrao.somaHistorica * config.taxaHistorica)) / somaPesos
            : mediaBase;

          const deltaBruto = mediaPonderada - mediaBase;

          return {
            ...padrao,
            deltaBruto,
            deltaAbs: Math.abs(deltaBruto),
            mediaBase,
            mediaPonderada,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .sort((a, b) => b.deltaAbs - a.deltaAbs)
        .slice(0, config.maxPadroesPorExecucao);

      let ajusteTotalAbs = 0;
      let padroesAjustados = 0;
      const ajustesAplicados: Array<{
        contextoHash: string;
        acao: string;
        deltaAplicado: number;
        deltaBruto: number;
        amostraRecente: number;
        amostraHistorica: number;
      }> = [];

      for (const candidato of candidatos) {
        let delta = clampNumber(
          candidato.deltaBruto,
          -config.ajusteMaxPorPadrao,
          config.ajusteMaxPorPadrao
        );

        if (Math.abs(delta) < config.ajusteMinimoAbsoluto) {
          continue;
        }

        const saldoDeriva = Number((config.limiteDerivaExecucaoAbs - ajusteTotalAbs).toFixed(6));
        if (saldoDeriva <= 0) break;

        if (Math.abs(delta) > saldoDeriva) {
          delta = delta > 0 ? saldoDeriva : -saldoDeriva;
        }

        await bancoDeAprendizadosService.registrar({
          tenantId,
          contexto: {
            faseFluxo: candidato.contexto.split('|')[0] || 'FASE_DESCONHECIDA',
            statusLead: candidato.contexto.split('|')[1] || 'SEM_STATUS',
            agenteInicial: candidato.contexto.split('|')[2] || 'SEM_AGENTE',
            sentimento: candidato.contexto.split('|')[3] || 'NEUTRO',
          },
          acao: candidato.acao,
          resultado: 'REPLAY_AJUSTE',
          recompensa: Number(delta.toFixed(4)),
          metadados: {
            tipo: 'experience_replay',
            contextoHash: candidato.contextoHash,
            deltaBruto: Number(candidato.deltaBruto.toFixed(4)),
            mediaBase: Number(candidato.mediaBase.toFixed(4)),
            mediaPonderada: Number(candidato.mediaPonderada.toFixed(4)),
            amostraRecente: candidato.qtdRecente,
            amostraHistorica: candidato.qtdHistorica,
            taxaRecente: config.taxaRecente,
            taxaHistorica: config.taxaHistorica,
            protegidoPorLimiteDeriva: true,
          },
        });

        const deltaAbs = Math.abs(delta);
        ajusteTotalAbs = Number((ajusteTotalAbs + deltaAbs).toFixed(4));
        padroesAjustados += 1;

        ajustesAplicados.push({
          contextoHash: candidato.contextoHash,
          acao: candidato.acao,
          deltaAplicado: Number(delta.toFixed(4)),
          deltaBruto: Number(candidato.deltaBruto.toFixed(4)),
          amostraRecente: candidato.qtdRecente,
          amostraHistorica: candidato.qtdHistorica,
        });
      }

      const resumoOutcomes = {
        recente: countOutcomes(recentRows),
        historico: countOutcomes(historicalRows),
      };

      await this.registrarAuditoria({
        tenantId,
        status: totalRows > 0 ? 'SUCESSO' : 'SEM_DADOS',
        config,
        amostraRecente: recentRows.length,
        amostraHistorica: historicalRows.length,
        padroesAvaliados: candidatos.length,
        padroesAjustados,
        ajusteTotalAbs,
        resumoOutcomes,
        ajustesAplicados,
        duracaoMs: Date.now() - inicio,
      });

      logger.info(
        {
          tenantId,
          amostraRecente: recentRows.length,
          amostraHistorica: historicalRows.length,
          padroesAvaliados: candidatos.length,
          padroesAjustados,
          ajusteTotalAbs,
        },
        '[REPLAY] Experience Replay executado'
      );

      return {
        tenantId,
        status: 'SUCESSO',
        amostraRecente: recentRows.length,
        amostraHistorica: historicalRows.length,
        padroesAvaliados: candidatos.length,
        padroesAjustados,
        ajusteTotalAbs,
      };
    } catch (error) {
      const errMsg = normalizeError(error);
      logger.warn({ err: error, tenantId }, '[REPLAY] Erro no Experience Replay do tenant');

      await this.registrarAuditoria({
        tenantId,
        status: 'ERRO',
        erro: errMsg,
        config,
        amostraRecente: 0,
        amostraHistorica: 0,
        padroesAvaliados: 0,
        padroesAjustados: 0,
        ajusteTotalAbs: 0,
        resumoOutcomes: {},
        ajustesAplicados: [],
        duracaoMs: Date.now() - inicio,
      });

      return {
        ...baseResult,
        status: 'ERRO',
        erro: errMsg,
      };
    }
  }

  private async registrarAuditoria(params: {
    tenantId: string;
    status: ReplayStatus;
    erro?: string;
    config: ReplayConfig;
    amostraRecente: number;
    amostraHistorica: number;
    padroesAvaliados: number;
    padroesAjustados: number;
    ajusteTotalAbs: number;
    resumoOutcomes: Record<string, any>;
    ajustesAplicados: Array<Record<string, any>>;
    duracaoMs: number;
  }): Promise<void> {
    try {
      await (prisma as any).auditoriaReplayAprendizado.create({
        data: {
          tenantId: params.tenantId,
          status: params.status,
          erro: params.erro,
          periodoRecenteHoras: params.config.periodoRecenteHoras,
          janelaHistoricaDias: params.config.janelaHistoricaDias,
          amostraRecente: params.amostraRecente,
          amostraHistorica: params.amostraHistorica,
          totalAmostras: params.amostraRecente + params.amostraHistorica,
          padroesAvaliados: params.padroesAvaliados,
          padroesAjustados: params.padroesAjustados,
          taxaRecente: params.config.taxaRecente,
          taxaHistorica: params.config.taxaHistorica,
          ajusteTotalAbs: Number(params.ajusteTotalAbs.toFixed(4)),
          ajusteMaxPorPadrao: params.config.ajusteMaxPorPadrao,
          limiteDerivaExecucaoAbs: params.config.limiteDerivaExecucaoAbs,
          resumoOutcomes: params.resumoOutcomes,
          ajustesAplicados: params.ajustesAplicados.slice(0, 20),
          duracaoMs: params.duracaoMs,
        },
      });
    } catch (error) {
      logger.warn({ err: error, tenantId: params.tenantId }, '[REPLAY] Falha ao registrar auditoria de replay');
    }
  }
}

export const experienceReplayService = new ExperienceReplayService();
