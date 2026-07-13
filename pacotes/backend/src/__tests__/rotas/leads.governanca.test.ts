import request from 'supertest';
import express from 'express';
import rotasLeads from '../../rotas/leads';
import { prisma } from '../../lib/db';

jest.mock('../../lib/db', () => ({
  prisma: {
    lead: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../utils/cascade-delete', () => ({
  cascadeDeleteLeads: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.tenantId = 'tenant-123';
  next();
});
app.use('/api/leads', rotasLeads);

describe('GET /api/leads/:id - governanca', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna bloco de governança com source_of_truth e faltantes', async () => {
    (prisma.lead.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'lead-1',
      tenantId: 'tenant-123',
      nome: 'Ivonet',
      telefone: '5511999999999',
      email: 'ivonet@teste.com',
      cpf: null,
      status: 'QUALIFICADO',
      temperatura: 'MORNO',
      origem: 'prospeccao_ativa',
      primeiroContato: new Date('2026-04-12T20:00:00.000Z'),
      ultimaInteracao: new Date('2026-04-13T10:00:00.000Z'),
      criadoEm: new Date('2026-04-12T20:00:00.000Z'),
      atualizadoEm: new Date('2026-04-13T10:00:00.000Z'),
      campanhaOrigem: null,
      imoveis: [],
      atividades: [],
      conversas: [],
      enderecoImovel: 'Reserva Buriti',
      tipoImovel: 'apartamento',
      areaImovel: null,
      quartosImovel: 2,
      vagasImovel: null,
      valorPretendido: 'R$ 350.000',
      ocupacaoImovel: 'ocupado',
      interesseEm: 'vender',
      situacaoAtual: null,
      tempoDecisao: null,
      tentativasAnteriores: null,
      comCorretorAtualmente: null,
      motivacaoVenda: 'mudança',
      doresIdentificadas: ['poucas visitas'],
      prazoDesejado: null,
      urgencia: null,
      consequencias: null,
      custosAtuais: null,
      pressaoTempo: null,
      expectativaServico: null,
      objecoes: [],
      interesseAvaliacao: null,
      observacoesSpin: null,
      situacaoFinanceira: null,
      temDividas: null,
      estadoConservacao: null,
      comissaoAcordada: null,
      tipoAutorizacao: null,
      prazoTrabalho: null,
      autorizouAnuncio: null,
      contratoUrl: null,
      dataAssinatura: null,
      vigenciaInicio: null,
      vigenciaFim: null,
      ultimaAcaoIA: null,
      ultimaAcaoIAEm: null,
      motivoPerda: null,
      empresaAtual: null,
      cnpjEmpresa: null,
      profissao: null,
      setor: null,
      idade: null,
      sexo: null,
      rendaEstimada: null,
      faixaSalarial: null,
      scoreAssertiva: null,
      telefone2: null,
      telefone3: null,
      email2: null,
      bairroImovel: null,
      nomeEdificio: null,
      inscricaoIptu: null,
      valorVenal: null,
      briefingCloser: null,
      schemaState: {
        lastSourceUpdateAt: '2026-04-13T09:58:00.000Z',
        fieldSources: {
          valorPretendido: {
            source: 'tool_confirmada',
            value: 'R$ 350.000',
            updatedAt: '2026-04-13T09:58:00.000Z',
            evidence: 'lead informou preço de anúncio',
          },
        },
      },
    });

    const resposta = await request(app).get('/api/leads/lead-1');

    expect(resposta.status).toBe(200);
    expect(resposta.body.governanca).toBeDefined();
    expect(resposta.body.governanca.prontidaoQualificacao).toBe('PARCIAL');
    expect(resposta.body.governanca.camposCriticos.faltantes).toEqual(
      expect.arrayContaining(['areaImovel', 'situacaoAtual', 'implicacao'])
    );
    expect(resposta.body.governanca.sourceOfTruth.lastSourceUpdateAt).toBe('2026-04-13T09:58:00.000Z');
    expect(resposta.body.governanca.sourceOfTruth.totalCamposRastreados).toBe(1);
    expect(resposta.body.governanca.sourceOfTruth.fields[0]).toEqual(
      expect.objectContaining({
        campo: 'valorPretendido',
        source: 'tool_confirmada',
      })
    );
  });
});

