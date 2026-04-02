import request from 'supertest';
import express from 'express';
import rotasAutenticacao from '../../rotas/autenticacao';

// Mock de libs externas
jest.mock('../../lib/db', () => ({
  prisma: {
    usuario: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    }
  }
}));

jest.mock('../../lib/redis', () => ({
  getRedisClient: jest.fn(() => ({
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    quit: jest.fn()
  }))
}));

jest.mock('../../utilitarios/token', () => ({
  gerarToken: jest.fn(() => 'mock-jwt-token'),
  gerarRefreshToken: jest.fn(() => 'mock-refresh-token'),
  validarRefreshToken: jest.fn(),
  revogarRefreshToken: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/auth', rotasAutenticacao);

describe('Rotas de Autenticação (Integração)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('deve retornar 401 se o corpo da requisição for inválido', async () => {
      const resposta = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalido'
          // Falta senha
        });

      expect(resposta.status).toBe(401);
      expect(resposta.body.erro).toBeDefined();
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('deve retornar 400 se o refreshToken não for fornecido', async () => {
      const resposta = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(resposta.status).toBe(400);
      expect(resposta.body.erro).toBe('Refresh token é obrigatório');
    });

    it('deve retornar 401 se o token for inválido vindo da validação', async () => {
      const { validarRefreshToken } = require('../../utilitarios/token');
      // Mock para validarRefreshToken retornar null (inválido/expirado)
      validarRefreshToken.mockResolvedValueOnce(null);

      const resposta = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'token-invalido' });

      expect(resposta.status).toBe(401);
      expect(resposta.body.erro).toBe('Refresh token inválido ou expirado');
    });

    it('deve retornar 200 com novo token se válido', async () => {
      const { validarRefreshToken, revogarRefreshToken } = require('../../utilitarios/token');
      const { prisma } = require('../../lib/db');
      
      validarRefreshToken.mockResolvedValueOnce('user-id-123');
      prisma.usuario.findUnique.mockResolvedValueOnce({
        id: 'user-id-123',
        email: 'teste@elyon.com.br',
        tenantId: 'tenant-1',
        papel: 'ADMIN',
        estaAtivo: true,
        tenant: { slug: 'elyon' }
      });
      revogarRefreshToken.mockResolvedValueOnce(true);

      const resposta = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'token-valido-123' });

      expect(resposta.status).toBe(200);
      expect(resposta.body.token).toBe('mock-jwt-token');
      expect(resposta.body.refreshToken).toBe('mock-refresh-token');
    });
  });
});
