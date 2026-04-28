import { expect, jest, describe, it, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { prisma } from '../../lib/db';
import { assertivaService } from '../../servicos/assertiva';
import { scraperIPTU } from '../../servicos/scraper-iptu';

// Mock do banco de dados — todas as tabelas/métodos usados pela rota
jest.mock('../../lib/db', () => ({
  prisma: {
    cacheCpf: {
      findMany: jest.fn<any>().mockResolvedValue([]),
      create: jest.fn<any>().mockResolvedValue({ id: 'cache-1' }),
      upsert: jest.fn<any>().mockResolvedValue({ id: 'cache-1' }),
      update: jest.fn<any>().mockResolvedValue({}),
    },
    consultaCpf: {
      create: jest.fn<any>().mockResolvedValue({}),
    },
    tenant: {
      findUnique: jest.fn<any>().mockResolvedValue({ id: 'tenant-123', precoConsultaCpf: '2.00' }),
      update: jest.fn<any>().mockResolvedValue({}),
    },
    lead: {
      createMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn<any>().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn<any>().mockResolvedValue(null),
    },
    imovel: {
      upsert: jest.fn<any>().mockResolvedValue({ id: 'imovel-1' }),
      findFirst: jest.fn<any>().mockResolvedValue(null),
    },
    contato: {
      create: jest.fn<any>().mockResolvedValue({ id: 'contato-1' }),
    },
    $transaction: jest.fn<any>(async (cb: Function) => cb()),
  }
}));

jest.mock('../../servicos/assertiva', () => ({
  assertivaService: {
    enriquecerDocumento: jest.fn<any>()
  }
}));

jest.mock('../../servicos/servico-creditos', () => ({
  servicoCreditos: {
    consultarSaldo: jest.fn<any>().mockResolvedValue({ total: 100, mensais: 100, prepagos: 0, bonus: 0 }),
    consumirCredito: jest.fn<any>().mockResolvedValue(true),
    temCreditos: jest.fn<any>().mockResolvedValue(true),
  }
}));

jest.mock('../../servicos/servico-auditoria', () => ({
  ServicoAuditoria: {
    registrar: jest.fn<any>(),
  }
}));

jest.mock('../../servicos/scraper-iptu', () => ({
  scraperIPTU: { consultarProprietario: jest.fn<any>() },
  parsearEnderecoPrefeitura: jest.fn<any>().mockReturnValue({}),
}));

jest.mock('../../servicos/mapa', () => ({
  mapaService: { buscarImoveis: jest.fn<any>() },
}));

// Setup simples do Express para testar a rota isolada
const app = express();
app.use(express.json());

// Simulando o middleware de auth para testes
app.use((req, res, next) => {
  req.tenantId = 'tenant-123';
  req.headers['x-tenant-id'] = 'tenant-123';
  next();
});

import mineracaoRotas from '../../rotas/mineracao/processamento.rotas';
app.use('/api/mineracao', mineracaoRotas);

describe('Rotas de Mineração - API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore defaults after clearAllMocks
    // @ts-ignore
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 'tenant-123', precoConsultaCpf: '2.00' });
    // @ts-ignore
    (prisma.tenant.update as jest.Mock).mockResolvedValue({});
    // @ts-ignore
    (prisma.cacheCpf.findMany as jest.Mock).mockResolvedValue([]);
    // @ts-ignore
    (prisma.cacheCpf.upsert as jest.Mock).mockResolvedValue({ id: 'cache-1' });
    // @ts-ignore
    (prisma.consultaCpf.create as jest.Mock).mockResolvedValue({});
    // @ts-ignore
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(null);
    // @ts-ignore
    (prisma.imovel.upsert as jest.Mock).mockResolvedValue({ id: 'imovel-1' });
  });

  describe('POST /api/mineracao/confirmar-leads', () => {
    it('deve retornar 400 se nenhum proprietário for fornecido', async () => {
      const res = await request(app)
        .post('/api/mineracao/confirmar-leads')
        .send({ proprietarios: [] });
      
      expect(res.status).toBe(400);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.erro).toMatch(/Nenhum documento/);
    });

    it('deve enriquecer e confirmar leads processados via Cache ou Assertiva', async () => {
      // Mock Assertiva: retorna dados de sucesso
      // @ts-ignore
      (assertivaService.enriquecerDocumento as jest.Mock).mockResolvedValue({
        nome: 'João Silva Teste',
        telefones: [{ numero: '11999999999', tipo: 'CELULAR', whatsapp: true }],
        emails: ['joao@test.com'],
      });

      const payload = {
        proprietarios: [
          {
            nrinscr: '00000001',
            cpf: '12345678901',
            nome: 'João',
            origem: 'MANUAL'
          }
        ]
      };

      const res = await request(app)
        .post('/api/mineracao/confirmar-leads')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.sucesso).toBeGreaterThanOrEqual(0);
      expect(assertivaService.enriquecerDocumento).toHaveBeenCalledTimes(1);
      expect(prisma.cacheCpf.upsert).toHaveBeenCalledTimes(1);
    });

    it('deve persistir novos campos da Assertiva no cache (cpfMae, escolaridade, estadoCivil, tipoLogradouro)', async () => {
      // @ts-ignore
      (assertivaService.enriquecerDocumento as jest.Mock).mockResolvedValue({
        nome: 'João Silva Teste',
        telefones: [{ numero: '11999999999', tipo: 'CELULAR', whatsapp: true }],
        emails: ['joao@test.com'],
        estadoCivil: 'Casado',
        cpfMae: '11122233344',
        escolaridade: 'Superior Completo',
        endereco: {
          tipoLogradouro: 'Rua',
          logradouro: 'Das Flores',
          numero: '123',
          cidade: 'Goiânia',
          uf: 'GO',
        }
      });

      const res = await request(app)
        .post('/api/mineracao/confirmar-leads')
        .send({
          proprietarios: [
            { nrinscr: '00000001', cpf: '12345678901', nome: 'João', origem: 'MANUAL' }
          ]
        });

      expect(res.status).toBe(200);
      expect(prisma.cacheCpf.upsert).toHaveBeenCalledTimes(1);
      const payloadUpsert: any = (prisma.cacheCpf.upsert as jest.Mock).mock.calls[0][0];
      expect(payloadUpsert.update.dados.estadoCivil).toBe('Casado');
      expect(payloadUpsert.update.dados.cpfMae).toBe('11122233344');
      expect(payloadUpsert.update.dados.escolaridade).toBe('Superior Completo');
      expect(payloadUpsert.update.dados.tipoLogradouro).toBe('Rua');
    });
  });

  describe('POST /api/mineracao/iptu-unitario', () => {
    it('deve retornar dados avançados do imóvel extraídos pelo scraper', async () => {
      // @ts-ignore
      (scraperIPTU.consultarProprietario as jest.Mock).mockResolvedValue({
        nrinscr: '123456',
        nome: 'Maria',
        cpf: '12345678901',
        endereco_correspondencia: 'Rua Teste, 10',
        tipoImovel: 'PREDIAL',
        areaConstruida: 82.5,
        areaTerreno: 120,
        valorVenal: 450000,
        anoConstituicao: 2018,
        apartamento: '806',
        bloco: 'B',
        nomeEdificio: 'Residencial Exemplo',
      });
      // @ts-ignore
      (assertivaService.enriquecerDocumento as jest.Mock).mockResolvedValue({
        nome: 'Maria',
        cpf: '12345678901',
        telefones: [],
        emails: [],
        score: 90,
      });

      const res = await request(app)
        .post('/api/mineracao/iptu-unitario')
        .send({ iptu: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.imovel.area).toBe(82.5);
      expect(res.body.imovel.areaTerreno).toBe(120);
      expect(res.body.imovel.valorVenal).toBe(450000);
      expect(res.body.imovel.anoConstituicao).toBe(2018);
    });
  });
});
