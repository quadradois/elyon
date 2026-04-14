import request from 'supertest';
import express from 'express';
import rotasMetricasAgentes from '../../rotas/metricas-agentes';
import { prisma } from '../../lib/db';

jest.mock('../../lib/db', () => ({
  prisma: {
    lead: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    atividade: {
      findMany: jest.fn(),
    },
    mensagem: {
      findMany: jest.fn(),
    },
  },
}));

const app = express();
app.use(express.json());
app.use('/api/metricas-agentes', rotasMetricasAgentes);

describe('Rotas de Métricas dos Agentes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/metricas-agentes/governanca', () => {
    it('deve retornar 400 quando tenantId não for informado', async () => {
      const resposta = await request(app).get('/api/metricas-agentes/governanca');

      expect(resposta.status).toBe(400);
      expect(resposta.body.sucesso).toBe(false);
      expect(resposta.body.erro).toBe('Tenant ID obrigatório');
      expect(prisma.lead.findMany).not.toHaveBeenCalled();
    });

    it('deve calcular completude, faltantes e fila prioritária', async () => {
      (prisma.lead.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'lead-parcial-warm',
          nome: 'Lead Warm Parcial',
          status: 'QUALIFICADO',
          temperatura: 'MORNO',
          atualizadoEm: new Date('2026-04-10T14:00:00.000Z'),
          interesseEm: 'venda',
          tipoImovel: 'apartamento',
          areaImovel: '',
          ocupacaoImovel: '',
          valorPretendido: null,
          doresIdentificadas: ['pouca liquidez'],
          situacaoAtual: '',
          motivacaoVenda: '',
          consequencias: null,
          custosAtuais: null,
        },
        {
          id: 'lead-completo',
          nome: 'Lead Completo',
          status: 'TENTATIVA_AGENDAMENTO',
          temperatura: 'QUENTE',
          atualizadoEm: new Date('2026-04-10T13:00:00.000Z'),
          interesseEm: 'venda',
          tipoImovel: 'apartamento',
          areaImovel: '120m2',
          ocupacaoImovel: 'ocupado',
          valorPretendido: '850000',
          doresIdentificadas: ['vazio há meses'],
          situacaoAtual: 'anúncio próprio',
          motivacaoVenda: 'mudança de cidade',
          consequencias: 'perda de renda',
          custosAtuais: null,
        },
        {
          id: 'lead-parcial-hot',
          nome: 'Lead Hot Parcial',
          status: 'QUALIFICADO',
          temperatura: 'QUENTE',
          atualizadoEm: new Date('2026-04-10T12:00:00.000Z'),
          interesseEm: 'venda',
          tipoImovel: 'casa',
          areaImovel: '200m2',
          ocupacaoImovel: 'vazio',
          valorPretendido: null,
          doresIdentificadas: [],
          situacaoAtual: 'já anunciado',
          motivacaoVenda: 'divisão de bens',
          consequencias: null,
          custosAtuais: null,
        },
      ]);

      const resposta = await request(app)
        .get('/api/metricas-agentes/governanca?periodo=7d')
        .set('x-tenant-id', 'tenant-123');

      expect(resposta.status).toBe(200);
      expect(resposta.body.resumo).toEqual({
        totalLeadsQualificacao: 3,
        completa: 1,
        parcial: 2,
        taxaCompletude: '33%',
        taxaParcial: '67%',
      });

      const faltantesTop = resposta.body.faltantesTop as Array<{ campo: string; quantidade: number }>;
      expect(faltantesTop).toEqual(
        expect.arrayContaining([
          { campo: 'valorPretendido', quantidade: 2 },
          { campo: 'implicacao', quantidade: 2 },
        ])
      );

      expect(resposta.body.filaPrioritaria).toHaveLength(2);
      expect(resposta.body.filaPrioritaria[0].leadId).toBe('lead-parcial-hot');
      expect(resposta.body.filaPrioritaria[0].faltantes).toEqual([
        'valorPretendido',
        'doresIdentificadas',
        'implicacao',
      ]);
      expect(typeof resposta.body.filaPrioritaria[0].atualizadoEm).toBe('string');
    });
  });

  describe('GET /api/metricas-agentes/governanca/trilha', () => {
    it('deve retornar 400 quando leadId não for informado', async () => {
      const resposta = await request(app)
        .get('/api/metricas-agentes/governanca/trilha')
        .set('x-tenant-id', 'tenant-123');

      expect(resposta.status).toBe(400);
      expect(resposta.body.sucesso).toBe(false);
      expect(resposta.body.erro).toBe('leadId é obrigatório');
    });

    it('deve retornar trilha operacional consolidada', async () => {
      (prisma.lead.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'lead-1',
        nome: 'Ivonet',
        status: 'QUALIFICADO',
        temperatura: 'MORNO',
        ultimaAcaoIA: 'Movido para FASE2: lead pronto',
        ultimaAcaoIAEm: new Date('2026-04-13T11:00:00.000Z'),
        atualizadoEm: new Date('2026-04-13T11:00:00.000Z'),
        schemaState: {
          lastSourceUpdateAt: '2026-04-13T10:30:00.000Z',
        },
      });
      (prisma.atividade.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'atv-1',
          tipo: 'NOTA',
          titulo: 'TOOL_EXEC:qualificar_lead',
          descricao: 'SUCCESS | Lead processado',
          criadoEm: new Date('2026-04-13T10:59:00.000Z'),
          completadoEm: new Date('2026-04-13T10:59:10.000Z'),
          criadoPor: 'ai_agent',
        }
      ]);
      (prisma.mensagem.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'msg-1',
          remetente: 'assistente',
          conteudo: 'Perfeito, vamos avançar.',
          enviadaEm: new Date('2026-04-13T10:58:00.000Z'),
          conversaId: 'conv-1',
        }
      ]);

      const resposta = await request(app)
        .get('/api/metricas-agentes/governanca/trilha?leadId=lead-1&limite=20')
        .set('x-tenant-id', 'tenant-123');

      expect(resposta.status).toBe(200);
      expect(resposta.body.lead).toEqual({
        id: 'lead-1',
        nome: 'Ivonet',
        status: 'QUALIFICADO',
        temperatura: 'MORNO',
        atualizadoEm: '2026-04-13T11:00:00.000Z',
      });
      expect(resposta.body.resumo.toolsExecutadas).toBe(1);
      expect(resposta.body.resumo.possuiTrilhaSourceOfTruth).toBe(true);
      expect(Array.isArray(resposta.body.timeline)).toBe(true);
      expect(resposta.body.timeline.length).toBeGreaterThan(0);
    });
  });
});
