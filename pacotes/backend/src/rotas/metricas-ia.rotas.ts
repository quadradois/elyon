/**
 * ROTAS DE MÉTRICAS DA IA
 * 
 * API para consultar performance dos agentes, guardrails,
 * ferramentas e sentimento dos leads.
 * 
 * Endpoints:
 * - GET /api/metricas-ia/resumo          — Conversões por agente, taxa de handoff
 * - GET /api/metricas-ia/guardrails      — Top guardrails acionados
 * - GET /api/metricas-ia/tools           — Taxa de sucesso/falha por tool
 * - GET /api/metricas-ia/sentimento      — Distribuição de sentimento
 * 
 * @version 1.0
 * @date 02/04/2026
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { responderErro } from '../utilitarios/resposta';
import { listarFlagsAgente } from '../agentes/feature-flags';
import { bancoDeAprendizadosService } from '../servicos/banco-aprendizados';

const router = Router();

const obterTenantId = (req: Request): string | null => {
  const tenantId = typeof req.tenantId === 'string' ? req.tenantId.trim() : '';
  return tenantId.length > 0 ? tenantId : null;
};

type AgentTurnRecord = {
  createdAt: Date;
  faseFluxo: string;
  sucesso: boolean;
  fallback: string;
  guardrail?: string | null;
  duracaoMs: number;
  toolCalls: number;
  handoffs: number;
  repeticaoDetectada: boolean;
  custoEstimadoUSD: number;
  paolModo?: 'SHADOW' | 'AB_VARIANT' | 'CONTROL' | null;
  paolAplicado?: boolean;
  paolAcao?: string | null;
  paolDivergencia?: boolean;
  paolGanhoPotencial?: number;
  aaGroup: 'A' | 'B';
  experimentGroup: 'CONTROL' | 'VARIANT';
};

type AgentOutcomeRecord = {
  createdAt: Date;
  outcome: 'SUCESSO' | 'OPTOUT' | 'HANDOFF_HUMANO' | 'PERDA' | 'ERRO';
  faseFluxo: string;
  paolModo?: 'SHADOW' | 'AB_VARIANT' | 'CONTROL' | null;
  paolAplicado?: boolean;
  paolAcao?: string | null;
  aaGroup: 'A' | 'B';
  experimentGroup: 'CONTROL' | 'VARIANT';
};

function toRecord(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  return {};
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((value / total) * 100).toFixed(1));
}

function pFrom(sorted: number[], percentile: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((percentile / 100) * sorted.length)));
  return Math.round(sorted[idx]);
}

function mapTurn(item: { criadoEm: Date; detalhes: any }): AgentTurnRecord {
  const d = toRecord(item.detalhes);
  const aaGroup = d.aaGroup === 'B' ? 'B' : 'A';
  const experimentGroup = d.experimentGroup === 'VARIANT' ? 'VARIANT' : 'CONTROL';
  return {
    createdAt: item.criadoEm,
    faseFluxo: String(d.faseFluxo || 'DESCONHECIDA'),
    sucesso: !!d.sucesso,
    fallback: String(d.fallback || 'NONE'),
    guardrail: d.guardrail || null,
    duracaoMs: toNumber(d.duracaoMs, 0),
    toolCalls: toNumber(d.toolCalls, 0),
    handoffs: toNumber(d.handoffs, 0),
    repeticaoDetectada: !!d.repeticaoDetectada,
    custoEstimadoUSD: toNumber(d.custoEstimadoUSD, 0),
    paolModo: ['SHADOW', 'AB_VARIANT', 'CONTROL'].includes(String(d.paolModo)) ? String(d.paolModo) as AgentTurnRecord['paolModo'] : null,
    paolAplicado: !!d.paolAplicado,
    paolAcao: d.paolAcao ? String(d.paolAcao) : null,
    paolDivergencia: !!d.paolDivergencia,
    paolGanhoPotencial: toNumber(d.paolGanhoPotencial, 0),
    aaGroup,
    experimentGroup,
  };
}

function mapOutcome(item: { criadoEm: Date; detalhes: any }): AgentOutcomeRecord {
  const d = toRecord(item.detalhes);
  const outcomeRaw = String(d.outcome || 'SUCESSO').toUpperCase();
  const allowed = new Set(['SUCESSO', 'OPTOUT', 'HANDOFF_HUMANO', 'PERDA', 'ERRO']);
  const outcome = (allowed.has(outcomeRaw) ? outcomeRaw : 'SUCESSO') as AgentOutcomeRecord['outcome'];
  const aaGroup = d.aaGroup === 'B' ? 'B' : 'A';
  const experimentGroup = d.experimentGroup === 'VARIANT' ? 'VARIANT' : 'CONTROL';
  return {
    createdAt: item.criadoEm,
    outcome,
    faseFluxo: String(d.faseFluxo || 'DESCONHECIDA'),
    paolModo: ['SHADOW', 'AB_VARIANT', 'CONTROL'].includes(String(d.paolModo)) ? String(d.paolModo) as AgentOutcomeRecord['paolModo'] : null,
    paolAplicado: !!d.paolAplicado,
    paolAcao: d.paolAcao ? String(d.paolAcao) : null,
    aaGroup,
    experimentGroup,
  };
}

async function carregarTelemetria(tenantId: string, limiteData: Date) {
  const [turnosRaw, outcomesRaw] = await Promise.all([
    prisma.logAuditoria.findMany({
      where: {
        tenantId,
        acao: 'AGENT_TURNO',
        criadoEm: { gte: limiteData },
      },
      select: { criadoEm: true, detalhes: true },
      orderBy: { criadoEm: 'desc' },
      take: 10000,
    }),
    prisma.logAuditoria.findMany({
      where: {
        tenantId,
        acao: 'AGENT_OUTCOME',
        criadoEm: { gte: limiteData },
      },
      select: { criadoEm: true, detalhes: true },
      orderBy: { criadoEm: 'desc' },
      take: 10000,
    }),
  ]);

  const turnos = turnosRaw.map(mapTurn);
  const outcomes = outcomesRaw.map(mapOutcome);
  return { turnos, outcomes };
}

function calcularCockpit(turnos: AgentTurnRecord[], outcomes: AgentOutcomeRecord[]) {
  const totalTurnos = turnos.length;
  const duracoes = turnos.map((t) => t.duracaoMs).filter((n) => n > 0).sort((a, b) => a - b);
  const avgDuracao = duracoes.length ? Math.round(duracoes.reduce((acc, n) => acc + n, 0) / duracoes.length) : 0;
  const repeticoes = turnos.filter((t) => t.repeticaoDetectada).length;
  const fallbacksContexto = turnos.filter((t) =>
    ['ANTI_REPEAT_GUARD', 'HANDOFF_NARRATION_FILTER', 'EMPTY_AFTER_HANDOFF'].includes(t.fallback)
  ).length;
  const desviosFluxo = turnos.filter((t) =>
    ['GENERIC_FALLBACK', 'EXCEPTION', 'EMPTY_AFTER_HANDOFF'].includes(t.fallback)
  ).length;

  const fallbackMap = new Map<string, number>();
  for (const turno of turnos) {
    if (turno.fallback && turno.fallback !== 'NONE') {
      fallbackMap.set(turno.fallback, (fallbackMap.get(turno.fallback) || 0) + 1);
    }
  }
  const topFallbacks = Array.from(fallbackMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([fallback, total]) => ({ fallback, total }));

  const faseAbandono = new Map<string, number>();
  for (const item of outcomes) {
    if (item.outcome === 'OPTOUT' || item.outcome === 'ERRO' || item.outcome === 'PERDA') {
      faseAbandono.set(item.faseFluxo, (faseAbandono.get(item.faseFluxo) || 0) + 1);
    }
  }
  const etapaMaiorAbandono = Array.from(faseAbandono.entries())
    .sort((a, b) => b[1] - a[1])[0];

  const totalOutcomes = outcomes.length;
  const totalOptout = outcomes.filter((o) => o.outcome === 'OPTOUT').length;
  const totalErro = outcomes.filter((o) => o.outcome === 'ERRO').length;
  const totalPerda = outcomes.filter((o) => o.outcome === 'PERDA').length;
  const totalHandoffHumano = outcomes.filter((o) => o.outcome === 'HANDOFF_HUMANO').length;
  const totalSucesso = outcomes.filter((o) => o.outcome === 'SUCESSO').length;

  const mediaToolCalls = totalTurnos > 0
    ? Number((turnos.reduce((acc, t) => acc + t.toolCalls, 0) / totalTurnos).toFixed(2))
    : 0;
  const mediaHandoffs = totalTurnos > 0
    ? Number((turnos.reduce((acc, t) => acc + t.handoffs, 0) / totalTurnos).toFixed(2))
    : 0;
  const exceptions = turnos.filter((t) => !t.sucesso || t.fallback === 'EXCEPTION').length;
  const providerFallback = turnos.filter((t) => t.fallback === 'PROVIDER_FALLBACK').length;

  const suggestions: Array<{ id: string; titulo: string; descricao: string; severidade: 'BAIXA' | 'MEDIA' | 'ALTA' }> = [];
  const repeticaoRate = percent(repeticoes, totalTurnos);
  if (repeticaoRate > 12) {
    suggestions.push({
      id: 'repeticao_alta',
      titulo: 'Reduzir repetição de perguntas',
      descricao: 'Taxa de repetição acima de 12%. Revisar guardrails de janela recente e reforçar extração de estado da conversa.',
      severidade: 'ALTA',
    });
  }
  const falhaFluxoRate = percent(desviosFluxo, totalTurnos);
  if (falhaFluxoRate > 8) {
    suggestions.push({
      id: 'desvio_fluxo',
      titulo: 'Ajustar aderência de fluxo',
      descricao: 'Desvios de fluxo acima de 8%. Revisar critérios de fallback genérico e transições de fase.',
      severidade: 'MEDIA',
    });
  }
  if (providerFallback > 0) {
    suggestions.push({
      id: 'fallback_provedor',
      titulo: 'Estabilizar provedor principal',
      descricao: 'Foram detectados fallbacks de provedor. Revisar BYOK, limites e timeouts para reduzir degradação.',
      severidade: 'MEDIA',
    });
  }
  if (percent(totalOptout, Math.max(totalOutcomes, 1)) > 5) {
    suggestions.push({
      id: 'optout_alto',
      titulo: 'Revisar abordagem para reduzir opt-out',
      descricao: 'Opt-out acima de 5% no período. Ajustar abertura e frequência de follow-up.',
      severidade: 'ALTA',
    });
  }
  if (!suggestions.length) {
    suggestions.push({
      id: 'saude_estavel',
      titulo: 'Operação estável',
      descricao: 'Sem alertas críticos no período. Continue monitorando baseline e execute A/A para validar instrumentação.',
      severidade: 'BAIXA',
    });
  }

  return {
    qualidade: {
      taxaRepeticaoPerguntas: repeticaoRate,
      aderenciaFluxo: Number((100 - falhaFluxoRate).toFixed(1)),
      contextoValido: Number((100 - percent(fallbacksContexto, totalTurnos)).toFixed(1)),
    },
    gargalos: {
      latenciaMs: {
        media: avgDuracao,
        p50: pFrom(duracoes, 50),
        p95: pFrom(duracoes, 95),
      },
      mediaToolCalls,
      mediaHandoffs,
      topFallbacks,
      etapaMaiorAbandono: etapaMaiorAbandono
        ? { fase: etapaMaiorAbandono[0], total: etapaMaiorAbandono[1] }
        : null,
    },
    erros: {
      totalTurnos,
      exceptions,
      providerFallback,
      antiRepeatGuard: turnos.filter((t) => t.fallback === 'ANTI_REPEAT_GUARD').length,
      optOuts: totalOptout,
      perdas: totalPerda,
      errosOutcome: totalErro,
    },
    outcomes: {
      total: totalOutcomes,
      sucesso: totalSucesso,
      optout: totalOptout,
      handoffHumano: totalHandoffHumano,
      perda: totalPerda,
      erro: totalErro,
      taxas: {
        sucesso: percent(totalSucesso, totalOutcomes),
        optout: percent(totalOptout, totalOutcomes),
        handoffHumano: percent(totalHandoffHumano, totalOutcomes),
        perda: percent(totalPerda, totalOutcomes),
        erro: percent(totalErro, totalOutcomes),
      },
    },
    sugestoes: suggestions,
  };
}

function resumirExperimento<T extends 'A' | 'B' | 'CONTROL' | 'VARIANT'>(
  turnos: AgentTurnRecord[],
  outcomes: AgentOutcomeRecord[],
  groups: readonly T[],
  pickTurnGroup: (turno: AgentTurnRecord) => T,
  pickOutcomeGroup: (outcome: AgentOutcomeRecord) => T,
) {
  const result = {} as Record<T, any>;
  for (const group of groups) {
    const turnosGroup = turnos.filter((t) => pickTurnGroup(t) === group);
    const outcomesGroup = outcomes.filter((o) => pickOutcomeGroup(o) === group);
    const latencias = turnosGroup.map((t) => t.duracaoMs).filter((n) => n > 0).sort((a, b) => a - b);
    const custos = turnosGroup.map((t) => t.custoEstimadoUSD).filter((n) => n > 0);
    const totalOutcomes = outcomesGroup.length;
    const optouts = outcomesGroup.filter((o) => o.outcome === 'OPTOUT').length;
    const sucesso = outcomesGroup.filter((o) => o.outcome === 'SUCESSO').length;

    result[group] = {
      totalTurnos: turnosGroup.length,
      totalOutcomes,
      taxaSucesso: percent(sucesso, totalOutcomes),
      taxaOptout: percent(optouts, totalOutcomes),
      latenciaMediaMs: latencias.length
        ? Math.round(latencias.reduce((acc, n) => acc + n, 0) / latencias.length)
        : 0,
      latenciaP95Ms: pFrom(latencias, 95),
      custoMedioUsd: custos.length
        ? Number((custos.reduce((acc, n) => acc + n, 0) / custos.length).toFixed(6))
        : 0,
      repeticaoPerguntas: percent(turnosGroup.filter((t) => t.repeticaoDetectada).length, turnosGroup.length),
    };
  }
  return result;
}

// ====================================
// GET /resumo — Performance geral dos agentes
// ====================================
router.get('/resumo', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantId(req);
    if (!tenantId) {
      return responderErro(res, 400, 'Tenant ID obrigatório');
    }
    const diasAtras = parseInt(req.query.dias as string) || 30;
    
    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasAtras);

    // Buscar atividades de tool execution
    const atividades = await prisma.atividade.findMany({
      where: {
        titulo: { startsWith: 'TOOL_EXEC:' },
        criadoEm: { gte: limiteData },
        lead: { tenantId }
      },
      select: {
        titulo: true,
        descricao: true,
        criadoEm: true,
      }
    });

    // Contagens por resultado
    const totalExecucoes = atividades.length;
    const sucessos = atividades.filter((a: any) => a.descricao?.startsWith('SUCCESS')).length;
    const falhas = totalExecucoes - sucessos;

    // Contagens por tool
    const porTool: Record<string, { total: number; sucessos: number; falhas: number }> = {};
    for (const a of atividades as any[]) {
      const toolName = a.titulo.replace('TOOL_EXEC:', '');
      if (!porTool[toolName]) porTool[toolName] = { total: 0, sucessos: 0, falhas: 0 };
      porTool[toolName].total++;
      if (a.descricao?.startsWith('SUCCESS')) {
        porTool[toolName].sucessos++;
      } else {
        porTool[toolName].falhas++;
      }
    }

    // Métricas de leads
    const [totalLeads, leadsQuentes, leadsMornos, leadsFrios] = await Promise.all([
      prisma.lead.count({ where: { tenantId, criadoEm: { gte: limiteData } } }),
      prisma.lead.count({ where: { tenantId, temperatura: 'QUENTE', criadoEm: { gte: limiteData } } }),
      prisma.lead.count({ where: { tenantId, temperatura: 'MORNO', criadoEm: { gte: limiteData } } }),
      prisma.lead.count({ where: { tenantId, temperatura: 'FRIO', criadoEm: { gte: limiteData } } }),
    ]);

    // Conversões (leads captados)
    const captados = await prisma.lead.count({
      where: { tenantId, status: 'CAPTADO', criadoEm: { gte: limiteData } }
    });

    res.json({
      periodo: `Últimos ${diasAtras} dias`,
      resumo: {
        totalExecucoesTools: totalExecucoes,
        taxaSucesso: totalExecucoes > 0 ? `${((sucessos / totalExecucoes) * 100).toFixed(1)}%` : '0%',
        totalLeadsGerados: totalLeads,
        leadsCaptados: captados,
        taxaConversao: totalLeads > 0 ? `${((captados / totalLeads) * 100).toFixed(1)}%` : '0%',
      },
      distribuicaoTemperatura: {
        quentes: leadsQuentes,
        mornos: leadsMornos,
        frios: leadsFrios,
      },
      performancePorTool: porTool,
    });

  } catch (error: any) {
    console.error('[METRICAS-IA] Erro no resumo:', error);
    res.status(500).json({ erro: error.message });
  }
});

// ====================================
// GET /tools — Detalhamento por ferramenta
// ====================================
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantId(req);
    if (!tenantId) {
      return responderErro(res, 400, 'Tenant ID obrigatório');
    }
    const diasAtras = parseInt(req.query.dias as string) || 7;
    
    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasAtras);

    const atividades = await prisma.atividade.findMany({
      where: {
        titulo: { startsWith: 'TOOL_EXEC:' },
        criadoEm: { gte: limiteData },
        lead: { tenantId }
      },
      select: {
        titulo: true,
        descricao: true,
        criadoEm: true,
      },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });

    const porTool: Record<string, {
      total: number;
      sucessos: number;
      falhas: number;
      ultimaExecucao: Date | null;
      exemplosErro: string[];
    }> = {};

    for (const a of atividades) {
      const toolName = a.titulo.replace('TOOL_EXEC:', '');
      if (!porTool[toolName]) {
        porTool[toolName] = { total: 0, sucessos: 0, falhas: 0, ultimaExecucao: null, exemplosErro: [] };
      }
      porTool[toolName].total++;
      if (!porTool[toolName].ultimaExecucao) porTool[toolName].ultimaExecucao = a.criadoEm;

      if (a.descricao?.startsWith('SUCCESS')) {
        porTool[toolName].sucessos++;
      } else {
        porTool[toolName].falhas++;
        if (porTool[toolName].exemplosErro.length < 3) {
          porTool[toolName].exemplosErro.push(a.descricao || 'Erro desconhecido');
        }
      }
    }

    res.json({
      periodo: `Últimos ${diasAtras} dias`,
      tools: porTool,
    });

  } catch (error: any) {
    console.error('[METRICAS-IA] Erro nas tools:', error);
    res.status(500).json({ erro: error.message });
  }
});

// ====================================
// GET /conversoes — Timeline de conversões
// ====================================
router.get('/conversoes', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantId(req);
    if (!tenantId) {
      return responderErro(res, 400, 'Tenant ID obrigatório');
    }
    const diasAtras = parseInt(req.query.dias as string) || 30;

    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasAtras);

    const leads = await prisma.lead.findMany({
      where: {
        tenantId,
        criadoEm: { gte: limiteData },
      },
      select: {
        id: true,
        nome: true,
        temperatura: true,
        status: true,
        criadoEm: true,
      },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    });

    // Agrupar por dia
    const porDia: Record<string, { total: number; quentes: number; captados: number }> = {};
    for (const lead of leads) {
      const dia = lead.criadoEm.toISOString().split('T')[0];
      if (!porDia[dia]) porDia[dia] = { total: 0, quentes: 0, captados: 0 };
      porDia[dia].total++;
      if (lead.temperatura === 'QUENTE') porDia[dia].quentes++;
      if (lead.status === 'CAPTADO') porDia[dia].captados++;
    }

    res.json({
      periodo: `Últimos ${diasAtras} dias`,
      totalLeads: leads.length,
      timeline: porDia,
      ultimosLeads: leads.slice(0, 10).map((l: any) => ({
        nome: l.nome,
        temperatura: l.temperatura,
        status: l.status,
        data: l.criadoEm,
      })),
    });

  } catch (error: any) {
    console.error('[METRICAS-IA] Erro nas conversões:', error);
    res.status(500).json({ erro: error.message });
  }
});

// ====================================
// GET /cockpit — Cockpit v1 (qualidade, gargalos, erros, sugestões)
// ====================================
router.get('/cockpit', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantId(req);
    if (!tenantId) return responderErro(res, 400, 'Tenant ID obrigatório');
    const diasAtras = parseInt(req.query.dias as string) || 7;
    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasAtras);

    const { turnos, outcomes } = await carregarTelemetria(tenantId, limiteData);
    const cockpit = calcularCockpit(turnos, outcomes);

    // Falhas de tools no período (bloco Erros)
    const atividadesTools = await prisma.atividade.findMany({
      where: {
        titulo: { startsWith: 'TOOL_EXEC:' },
        criadoEm: { gte: limiteData },
        lead: { tenantId },
      },
      select: { titulo: true, descricao: true },
      take: 5000,
    });
    const totalTools = atividadesTools.length;
    const falhasTools = atividadesTools.filter((a) => !a.descricao?.startsWith('SUCCESS')).length;

    res.json({
      periodo: `Últimos ${diasAtras} dias`,
      flags: listarFlagsAgente(),
      ...cockpit,
      erros: {
        ...cockpit.erros,
        tools: {
          totalExecucoes: totalTools,
          falhas: falhasTools,
          taxaFalha: percent(falhasTools, totalTools),
        },
      },
    });
  } catch (error: any) {
    console.error('[METRICAS-IA] Erro no cockpit:', error);
    res.status(500).json({ erro: error.message });
  }
});

// ====================================
// GET /cockpit/baseline — baseline para comparação (14 dias por padrão)
// ====================================
router.get('/cockpit/baseline', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantId(req);
    if (!tenantId) return responderErro(res, 400, 'Tenant ID obrigatório');
    const diasAtras = parseInt(req.query.dias as string) || 14;
    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasAtras);

    const { turnos, outcomes } = await carregarTelemetria(tenantId, limiteData);
    const cockpit = calcularCockpit(turnos, outcomes);
    res.json({
      tipo: 'baseline',
      periodo: `Últimos ${diasAtras} dias`,
      desde: limiteData.toISOString(),
      ate: new Date().toISOString(),
      amostra: {
        turnos: turnos.length,
        outcomes: outcomes.length,
      },
      ...cockpit,
    });
  } catch (error: any) {
    console.error('[METRICAS-IA] Erro no baseline cockpit:', error);
    res.status(500).json({ erro: error.message });
  }
});

// ====================================
// GET /cockpit/experimentos/aa — comparativo A/A de instrumentação
// ====================================
router.get('/cockpit/experimentos/aa', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantId(req);
    if (!tenantId) return responderErro(res, 400, 'Tenant ID obrigatório');
    const diasAtras = parseInt(req.query.dias as string) || 7;
    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasAtras);
    const { turnos, outcomes } = await carregarTelemetria(tenantId, limiteData);
    const grupos = resumirExperimento(
      turnos,
      outcomes,
      ['A', 'B'] as const,
      (t) => t.aaGroup,
      (o) => o.aaGroup,
    );
    const driftSucesso = Math.abs((grupos.A.taxaSucesso || 0) - (grupos.B.taxaSucesso || 0));
    const driftLatencia = Math.abs((grupos.A.latenciaMediaMs || 0) - (grupos.B.latenciaMediaMs || 0));
    res.json({
      tipo: 'aa',
      periodo: `Últimos ${diasAtras} dias`,
      grupos,
      drift: {
        taxaSucesso: Number(driftSucesso.toFixed(1)),
        latenciaMediaMs: driftLatencia,
      },
      validacaoInstrumentacao: driftSucesso <= 5 ? 'OK' : 'ATENCAO',
    });
  } catch (error: any) {
    console.error('[METRICAS-IA] Erro no experimento A/A:', error);
    res.status(500).json({ erro: error.message });
  }
});

// ====================================
// GET /cockpit/experimentos/ab — dashboard técnico controle vs variante
// ====================================
router.get('/cockpit/experimentos/ab', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantId(req);
    if (!tenantId) return responderErro(res, 400, 'Tenant ID obrigatório');
    const diasAtras = parseInt(req.query.dias as string) || 7;
    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasAtras);
    const { turnos, outcomes } = await carregarTelemetria(tenantId, limiteData);
    const grupos = resumirExperimento(
      turnos,
      outcomes,
      ['CONTROL', 'VARIANT'] as const,
      (t) => t.experimentGroup,
      (o) => o.experimentGroup,
    );

    const ganhoSucesso = Number(((grupos.VARIANT.taxaSucesso || 0) - (grupos.CONTROL.taxaSucesso || 0)).toFixed(1));
    const deltaOptout = Number(((grupos.VARIANT.taxaOptout || 0) - (grupos.CONTROL.taxaOptout || 0)).toFixed(1));
    const deltaLatencia = (grupos.VARIANT.latenciaMediaMs || 0) - (grupos.CONTROL.latenciaMediaMs || 0);
    const deltaCusto = Number(((grupos.VARIANT.custoMedioUsd || 0) - (grupos.CONTROL.custoMedioUsd || 0)).toFixed(6));
    const turnosVariantAplicados = turnos.filter((t) => t.experimentGroup === 'VARIANT' && t.paolAplicado).length;
    const divergenciaSombra = turnos.filter((t) => t.paolModo === 'SHADOW' && t.paolDivergencia).length;

    res.json({
      tipo: 'ab',
      periodo: `Últimos ${diasAtras} dias`,
      grupos,
      delta: {
        taxaSucesso: ganhoSucesso,
        taxaOptout: deltaOptout,
        latenciaMediaMs: deltaLatencia,
        custoMedioUsd: deltaCusto,
      },
      paol: {
        turnosVariantAplicados,
        divergenciasSombra: divergenciaSombra,
      },
      recomendacao: ganhoSucesso >= 0 && deltaOptout <= 0
        ? 'VARIANTE_PROMISSORA'
        : 'MANTER_CONTROLE',
    });
  } catch (error: any) {
    console.error('[METRICAS-IA] Erro no experimento A/B:', error);
    res.status(500).json({ erro: error.message });
  }
});

// ====================================
// GET /cockpit/experimentos/ab/promocao — gates para promoção da variante
// ====================================
router.get('/cockpit/experimentos/ab/promocao', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantId(req);
    if (!tenantId) return responderErro(res, 400, 'Tenant ID obrigatório');

    const diasAtras = parseInt(req.query.dias as string) || 7;
    const minOutcomes = parseInt(req.query.minOutcomes as string) || 10;
    const limiteDeltaLatenciaMs = parseInt(req.query.maxDeltaLatenciaMs as string) || 200;
    const limiteDeltaCustoUsd = Number(req.query.maxDeltaCustoUsd as string) || 0.002;

    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasAtras);

    const { turnos, outcomes } = await carregarTelemetria(tenantId, limiteData);
    const grupos = resumirExperimento(
      turnos,
      outcomes,
      ['CONTROL', 'VARIANT'] as const,
      (t) => t.experimentGroup,
      (o) => o.experimentGroup,
    );

    const deltaSucesso = Number(((grupos.VARIANT.taxaSucesso || 0) - (grupos.CONTROL.taxaSucesso || 0)).toFixed(1));
    const deltaOptout = Number(((grupos.VARIANT.taxaOptout || 0) - (grupos.CONTROL.taxaOptout || 0)).toFixed(1));
    const deltaLatencia = (grupos.VARIANT.latenciaMediaMs || 0) - (grupos.CONTROL.latenciaMediaMs || 0);
    const deltaCusto = Number(((grupos.VARIANT.custoMedioUsd || 0) - (grupos.CONTROL.custoMedioUsd || 0)).toFixed(6));

    const gateAmostra = grupos.CONTROL.totalOutcomes >= minOutcomes && grupos.VARIANT.totalOutcomes >= minOutcomes;
    const gateConversao = deltaSucesso >= 0;
    const gateOptout = deltaOptout <= 0;
    const gateLatencia = deltaLatencia <= limiteDeltaLatenciaMs;
    const gateCusto = deltaCusto <= limiteDeltaCustoUsd;
    const podePromover = gateAmostra && gateConversao && gateOptout && gateLatencia && gateCusto;

    res.json({
      periodo: `Últimos ${diasAtras} dias`,
      grupos,
      delta: {
        taxaSucesso: deltaSucesso,
        taxaOptout: deltaOptout,
        latenciaMediaMs: deltaLatencia,
        custoMedioUsd: deltaCusto,
      },
      gates: {
        amostraMinima: gateAmostra,
        conversaoNaoInferior: gateConversao,
        optoutNaoPiora: gateOptout,
        latenciaDentroLimite: gateLatencia,
        custoDentroTeto: gateCusto,
      },
      limiares: {
        minOutcomes,
        maxDeltaLatenciaMs: limiteDeltaLatenciaMs,
        maxDeltaCustoUsd: limiteDeltaCustoUsd,
      },
      recomendacao: podePromover ? 'PROMOVER_VARIANTE' : 'MANTER_CONTROLE',
      podePromover,
    });
  } catch (error: any) {
    console.error('[METRICAS-IA] Erro na avaliação de promoção A/B:', error);
    res.status(500).json({ erro: error.message });
  }
});

// ====================================
// GET /learning-bank/top-padroes — Top padrões de aprendizado por tenant
// ====================================
router.get('/learning-bank/top-padroes', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantId(req);
    if (!tenantId) return responderErro(res, 400, 'Tenant ID obrigatório');

    const diasAtras = parseInt(req.query.dias as string) || 30;
    const limite = parseInt(req.query.limite as string) || 10;
    const minimoAmostra = parseInt(req.query.minimoAmostra as string) || 3;

    const topPadroes = await bancoDeAprendizadosService.obterTopPadroesTenant(tenantId, {
      diasJanela: diasAtras,
      limit: limite,
      minimoAmostra,
    });

    res.json({
      periodo: `Últimos ${diasAtras} dias`,
      total: topPadroes.length,
      padroes: topPadroes,
    });
  } catch (error: any) {
    console.error('[METRICAS-IA] Erro em top-padroes do learning bank:', error);
    res.status(500).json({ erro: error.message });
  }
});

// ====================================
// GET /learning-bank/replay-auditoria — Últimas execuções de replay por tenant
// ====================================
router.get('/learning-bank/replay-auditoria', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantId(req);
    if (!tenantId) return responderErro(res, 400, 'Tenant ID obrigatório');

    const limite = Math.max(1, Math.min(30, parseInt(req.query.limite as string) || 10));

    const execucoes = await (prisma as any).auditoriaReplayAprendizado.findMany({
      where: { tenantId },
      orderBy: { executadoEm: 'desc' },
      take: limite,
      select: {
        executadoEm: true,
        status: true,
        erro: true,
        amostraRecente: true,
        amostraHistorica: true,
        totalAmostras: true,
        padroesAvaliados: true,
        padroesAjustados: true,
        ajusteTotalAbs: true,
        taxaRecente: true,
        taxaHistorica: true,
        limiteDerivaExecucaoAbs: true,
        duracaoMs: true,
      },
    });

    const resumo = {
      totalExecucoes: execucoes.length,
      sucessos: execucoes.filter((e: any) => e.status === 'SUCESSO').length,
      semDados: execucoes.filter((e: any) => e.status === 'SEM_DADOS').length,
      erros: execucoes.filter((e: any) => e.status === 'ERRO').length,
      ajustesTotalAbs: Number(
        execucoes.reduce((acc: number, e: any) => acc + Number(e.ajusteTotalAbs || 0), 0).toFixed(4)
      ),
    };

    res.json({
      limite,
      resumo,
      execucoes,
    });
  } catch (error: any) {
    console.error('[METRICAS-IA] Erro em replay-auditoria do learning bank:', error);
    res.status(500).json({ erro: error.message });
  }
});

// ====================================
// GET /learning-bank/paol/politica — Top ações aprendidas pelo PAOL
// ====================================
router.get('/learning-bank/paol/politica', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantId(req);
    if (!tenantId) return responderErro(res, 400, 'Tenant ID obrigatório');
    const limite = Math.max(1, Math.min(50, parseInt(req.query.limite as string) || 20));
    const diasAtras = parseInt(req.query.dias as string) || 30;
    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasAtras);

    const rows = await (prisma as any).paolPolitica.findMany({
      where: {
        tenantId,
        atualizadoEm: { gte: limiteData },
      },
      orderBy: [
        { emaRecompensa: 'desc' },
        { emaSucesso: 'desc' },
        { amostra: 'desc' },
      ],
      take: limite,
      select: {
        contextoHash: true,
        acao: true,
        emaRecompensa: true,
        emaSucesso: true,
        amostra: true,
        ultimoOutcome: true,
        ultimoFallback: true,
        atualizadoEm: true,
      },
    });

    res.json({
      periodo: `Últimos ${diasAtras} dias`,
      total: rows.length,
      politicas: rows,
    });
  } catch (error: any) {
    console.error('[METRICAS-IA] Erro ao consultar política PAOL:', error);
    res.status(500).json({ erro: error.message });
  }
});

export default router;
