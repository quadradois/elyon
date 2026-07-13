import express from 'express';
import request from 'supertest';

jest.mock('../../lib/db', () => ({
  prisma: {
    aprendizadoAgente: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
    },
    auditoriaReplayAprendizado: {
      findMany: jest.fn(),
    },
    logAuditoria: {
      findMany: jest.fn(),
    },
    atividade: {
      findMany: jest.fn(),
    },
    lead: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/db';
import rotaMetricasIA from '../../rotas/metricas-ia.rotas';

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const tenantId = req.headers['x-test-tenant-id'];
  if (typeof tenantId === 'string') req.tenantId = tenantId;
  next();
});
app.use('/api/metricas-ia', rotaMetricasIA);

describe('Rotas métricas IA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna top padrões do learning bank', async () => {
    (prisma as any).aprendizadoAgente.findMany.mockResolvedValue([
      {
        contexto: 'FASE1|NOVO|SDR|NEUTRO',
        contextoHash: 'abcd1234',
        acao: 'tool:qualificar_lead',
        recompensa: 0.8,
        criadoEm: new Date('2026-04-20T10:00:00.000Z'),
      },
      {
        contexto: 'FASE1|NOVO|SDR|NEUTRO',
        contextoHash: 'abcd1234',
        acao: 'tool:qualificar_lead',
        recompensa: 0.9,
        criadoEm: new Date('2026-04-21T10:00:00.000Z'),
      },
      {
        contexto: 'FASE1|NOVO|SDR|NEUTRO',
        contextoHash: 'abcd1234',
        acao: 'tool:qualificar_lead',
        recompensa: 0.7,
        criadoEm: new Date('2026-04-22T10:00:00.000Z'),
      },
    ]);

    const resposta = await request(app)
      .get('/api/metricas-ia/learning-bank/top-padroes?dias=30&limite=10&minimoAmostra=3')
      .set('x-test-tenant-id', 'tenant-1');

    expect(resposta.status).toBe(200);
    expect(resposta.body.total).toBe(1);
    expect(resposta.body.padroes[0].acao).toBe('tool:qualificar_lead');
    expect(resposta.body.padroes[0].amostra).toBe(3);
  });

  it('retorna 400 quando tenant não é informado', async () => {
    const resposta = await request(app)
      .get('/api/metricas-ia/learning-bank/top-padroes');

    expect(resposta.status).toBe(400);
  });

  it('retorna auditoria de replay do learning bank', async () => {
    (prisma as any).auditoriaReplayAprendizado.findMany.mockResolvedValue([
      {
        executadoEm: new Date('2026-04-26T03:00:00.000Z'),
        status: 'SUCESSO',
        erro: null,
        amostraRecente: 42,
        amostraHistorica: 33,
        totalAmostras: 75,
        padroesAvaliados: 20,
        padroesAjustados: 8,
        ajusteTotalAbs: 0.44,
        taxaRecente: 0.14,
        taxaHistorica: 0.05,
        limiteDerivaExecucaoAbs: 1.2,
        duracaoMs: 1200,
      },
    ]);

    const resposta = await request(app)
      .get('/api/metricas-ia/learning-bank/replay-auditoria?limite=5')
      .set('x-test-tenant-id', 'tenant-1');

    expect(resposta.status).toBe(200);
    expect(resposta.body.resumo.totalExecucoes).toBe(1);
    expect(resposta.body.resumo.sucessos).toBe(1);
    expect(resposta.body.execucoes[0].status).toBe('SUCESSO');
  });

  it('retorna gates de promoção do experimento A/B', async () => {
    (prisma as any).logAuditoria.findMany
      .mockResolvedValueOnce([
        {
          criadoEm: new Date('2026-04-26T10:00:00.000Z'),
          detalhes: {
            duracaoMs: 800,
            sucesso: true,
            fallback: 'NONE',
            toolCalls: 1,
            handoffs: 0,
            experimentGroup: 'CONTROL',
            aaGroup: 'A',
            custoEstimadoUSD: 0.0020,
          },
        },
        {
          criadoEm: new Date('2026-04-26T10:10:00.000Z'),
          detalhes: {
            duracaoMs: 900,
            sucesso: true,
            fallback: 'NONE',
            toolCalls: 1,
            handoffs: 0,
            experimentGroup: 'VARIANT',
            aaGroup: 'B',
            custoEstimadoUSD: 0.0021,
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          criadoEm: new Date('2026-04-26T10:01:00.000Z'),
          detalhes: { outcome: 'SUCESSO', experimentGroup: 'CONTROL', aaGroup: 'A' },
        },
        {
          criadoEm: new Date('2026-04-26T10:11:00.000Z'),
          detalhes: { outcome: 'SUCESSO', experimentGroup: 'VARIANT', aaGroup: 'B' },
        },
      ]);

    const resposta = await request(app)
      .get('/api/metricas-ia/cockpit/experimentos/ab/promocao?dias=7&minOutcomes=1')
      .set('x-test-tenant-id', 'tenant-1');

    expect(resposta.status).toBe(200);
    expect(resposta.body.gates.conversaoNaoInferior).toBe(true);
    expect(resposta.body.gates.optoutNaoPiora).toBe(true);
    expect(resposta.body.recomendacao).toBe('PROMOVER_VARIANTE');
  });
});
