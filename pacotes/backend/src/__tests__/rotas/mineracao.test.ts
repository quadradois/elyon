import { expect, jest, describe, it, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { prisma } from '../../lib/db';
import { assertivaService } from '../../servicos/assertiva';

// Mock do banco de dados e serviços
jest.mock('../../lib/db', () => ({
  prisma: {
    cacheCpf: { findMany: jest.fn(), create: jest.fn() },
    lead: { createMany: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn((callback: Function) => callback(prisma))
  }
}));

jest.mock('../../servicos/assertiva', () => ({
  assertivaService: {
    enriquecerDocumento: jest.fn()
  }
}));

// Setup simples do Express para testar a rota isolada
const app = express();
app.use(express.json());

// Simulando o middleware de auth para testes
app.use((req, res, next) => {
  req.tenantId = 'tenant-123';
  next();
});

import mineracaoRotas from '../../rotas/mineracao/processamento.rotas';
app.use('/api/mineracao', mineracaoRotas);

describe('Rotas de Mineração - API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/mineracao/confirmar-leads', () => {
    it('deve retornar 400 se nenhum lead for fornecido', async () => {
      const res = await request(app)
        .post('/api/mineracao/confirmar-leads')
        .send({ leads: [] });
      
      expect(res.status).toBe(400);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.mensagem).toMatch(/Nenhum documento/);
    });

    it('deve enriquecer e confirmar leads processados via Cache ou Assertiva', async () => {
      // Mock Cache: o banco retorna vazio, forçando chamada à Assertiva
      // @ts-ignore
      (prisma.cacheCpf.findMany as jest.Mock).mockResolvedValue([]);
      
      // Mock Assertiva: retorna dados falsos de sucesso
      // @ts-ignore
      (assertivaService.enriquecerDocumento as jest.Mock).mockResolvedValue({
        nome: 'João Silva Teste',
        telefones: [{ numero: '11999999999', whatsapp: true }]
      });

      // Transação dummy 
      // @ts-ignore
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return [{ count: 1 }]; // createMany result mock
      });

      const payload = {
        leads: [
          {
            cpf: '12345678901',
            nome: 'João',
            origem: 'MANUAL',
            status: 'AGUARDANDO'
          }
        ]
      };

      const res = await request(app)
        .post('/api/mineracao/confirmar-leads')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.sucesso).toBe(true);
      expect(assertivaService.enriquecerDocumento).toHaveBeenCalledTimes(1);
      expect(prisma.cacheCpf.create).toHaveBeenCalledTimes(1);
    });
  });
});
