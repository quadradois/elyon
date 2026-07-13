import crypto from 'crypto';
import express from 'express';
import request from 'supertest';

const webhookEvento = {
  create: jest.fn(),
  update: jest.fn(),
  deleteMany: jest.fn(),
};
const sessaoWhatsapp = {
  findFirst: jest.fn(),
};

jest.mock('../../lib/db', () => ({
  prisma: { webhookEvento, sessaoWhatsapp },
}));

import {
  autenticarWebhookAsaas,
  autenticarWebhookEvolution,
  autenticarWebhookManus,
  capturarRawBody,
  limparCacheChaveManusParaTestes,
  registrarEventoWebhook,
  validarConfiguracaoWebhooks,
} from '../webhook-seguranca';

const envOriginal = { ...process.env };

function appComMiddleware(middleware: express.RequestHandler): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ verify: capturarRawBody }));
  app.post('/webhook', middleware, (req, res) => {
    res.json({ autorizado: true, rawBody: req.rawBody?.toString('utf8') });
  });
  return app;
}

describe('seguranca de webhooks', () => {
  beforeEach(() => {
    process.env = { ...envOriginal, NODE_ENV: 'test' };
    webhookEvento.create.mockReset();
    webhookEvento.update.mockReset();
    webhookEvento.deleteMany.mockReset();
    sessaoWhatsapp.findFirst.mockReset();
    limparCacheChaveManusParaTestes();
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  describe('Asaas', () => {
    it('aceita somente o token dedicado configurado', async () => {
      process.env.ASAAS_WEBHOOK_TOKEN = 'a'.repeat(32);
      const app = appComMiddleware(autenticarWebhookAsaas);

      const invalido = await request(app)
        .post('/webhook')
        .set('asaas-access-token', 'b'.repeat(32))
        .send({ id: 'evt-1' });
      const valido = await request(app)
        .post('/webhook')
        .set('asaas-access-token', 'a'.repeat(32))
        .send({ id: 'evt-1' });

      expect(invalido.status).toBe(401);
      expect(valido.status).toBe(200);
      expect(valido.body.rawBody).toBe(JSON.stringify({ id: 'evt-1' }));
    });

    it('falha fechado quando o token nao esta configurado', async () => {
      delete process.env.ASAAS_WEBHOOK_TOKEN;
      const resposta = await request(appComMiddleware(autenticarWebhookAsaas))
        .post('/webhook')
        .send({ id: 'evt-1' });

      expect(resposta.status).toBe(503);
    });
  });

  describe('Evolution', () => {
    it('aceita somente o IP fixo da VPS Evolution Go dedicada', async () => {
      process.env.EVOLUTION_WEBHOOK_SOURCE_RANGE = '203.0.113.10/32';
      sessaoWhatsapp.findFirst.mockResolvedValue({ evolutionToken: 'token-da-instancia' });
      const resposta = await request(appComMiddleware(autenticarWebhookEvolution))
        .post('/webhook')
        .set('x-forwarded-for', '203.0.113.10')
        .send({
          event: 'Message',
          instanceName: 'elyon_tenant_agente',
          instanceId: 'instance-1',
          instanceToken: 'token-da-instancia',
        });

      expect(resposta.status).toBe(200);
      expect(sessaoWhatsapp.findFirst).toHaveBeenCalledWith({
        where: {
          instanceName: 'elyon_tenant_agente',
          evolutionInstanceId: 'instance-1',
        },
        select: { evolutionToken: true },
      });
    });

    it('rejeita origem diferente e token de instancia invalido', async () => {
      process.env.EVOLUTION_WEBHOOK_SOURCE_RANGE = '203.0.113.10/32';
      sessaoWhatsapp.findFirst.mockResolvedValue({ evolutionToken: 'token-correto' });
      const app = appComMiddleware(autenticarWebhookEvolution);
      const payload = {
        event: 'Message',
        instanceName: 'elyon_tenant_agente',
        instanceId: 'instance-1',
        instanceToken: 'token-incorreto',
      };

      const respostas = await Promise.all([
        request(app).post('/webhook').set('x-forwarded-for', '198.51.100.20').send(payload),
        request(app).post('/webhook').set('x-forwarded-for', '203.0.113.10').send(payload),
        request(app)
          .post('/webhook')
          .set('x-forwarded-for', '203.0.113.10')
          .send({ ...payload, instanceToken: undefined }),
      ]);

      expect(respostas.map((resposta) => resposta.status)).toEqual([403, 403, 401]);
    });
  });

  describe('Manus', () => {
    const url = 'https://api.elyon.test/webhooks/manus';
    const payload = { event_id: 'evt-manus-1', event_type: 'task_created' };
    const rawBody = JSON.stringify(payload);
    let privateKey: string;
    let publicKey: string;

    beforeAll(() => {
      const par = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      privateKey = par.privateKey;
      publicKey = par.publicKey;
    });

    beforeEach(() => {
      process.env.MANUS_WEBHOOK_PUBLIC_KEY = publicKey;
    });

    function assinar(timestamp: string, body = rawBody): string {
      const hash = crypto.createHash('sha256').update(body).digest('hex');
      return crypto.sign(
        'RSA-SHA256',
        Buffer.from(`${timestamp}.${url}.${hash}`),
        privateKey,
      ).toString('base64');
    }

    it('valida assinatura RSA sobre timestamp, URL e raw body', async () => {
      process.env.MANUS_WEBHOOK_URL = url;
      const timestamp = String(Math.floor(Date.now() / 1000));
      const resposta = await request(appComMiddleware(autenticarWebhookManus))
        .post('/webhook')
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-signature', assinar(timestamp))
        .send(payload);

      expect(resposta.status).toBe(200);
      expect(resposta.body.rawBody).toBe(rawBody);
    });

    it('rejeita corpo adulterado e timestamp fora da janela', async () => {
      process.env.MANUS_WEBHOOK_URL = url;
      const atual = String(Math.floor(Date.now() / 1000));
      const antigo = String(Math.floor(Date.now() / 1000) - 301);
      const app = appComMiddleware(autenticarWebhookManus);

      const adulterado = await request(app)
        .post('/webhook')
        .set('x-webhook-timestamp', atual)
        .set('x-webhook-signature', assinar(atual))
        .send({ ...payload, event_type: 'task_stopped' });
      const expirado = await request(app)
        .post('/webhook')
        .set('x-webhook-timestamp', antigo)
        .set('x-webhook-signature', assinar(antigo))
        .send(payload);

      expect(adulterado.status).toBe(401);
      expect(expirado.status).toBe(401);
    });
  });

  describe('recibo idempotente', () => {
    it.each(['ASAAS', 'EVOLUTION', 'MANUS'] as const)(
      'identifica replay de %s pela constraint unica do banco',
      async (provedor) => {
        webhookEvento.create
          .mockResolvedValueOnce({ id: 'registro-1' })
          .mockRejectedValueOnce({ code: 'P2002' });

        const entrada = {
          provedor,
          eventoId: 'evt-1',
          tipo: 'PAYMENT_RECEIVED',
          payloadHash: 'hash-1',
        };

        await expect(registrarEventoWebhook(entrada)).resolves.toEqual({
          duplicado: false,
          registroId: 'registro-1',
        });
        await expect(registrarEventoWebhook(entrada)).resolves.toEqual({ duplicado: true });
      },
    );
  });

  it('impede startup de producao sem segredos obrigatorios', () => {
    process.env.NODE_ENV = 'production';
    process.env.ASAAS_API_KEY = 'asaas-configurada';
    delete process.env.ASAAS_WEBHOOK_TOKEN;
    delete process.env.EVOLUTION_WEBHOOK_SOURCE_RANGE;

    expect(() => validarConfiguracaoWebhooks()).toThrow('ASAAS_WEBHOOK_TOKEN');

    process.env.ASAAS_WEBHOOK_TOKEN = 'a'.repeat(32);
    process.env.EVOLUTION_WEBHOOK_SOURCE_RANGE = '10.0.0.0/24';
    expect(() => validarConfiguracaoWebhooks()).toThrow('EVOLUTION_WEBHOOK_SOURCE_RANGE');

    process.env.EVOLUTION_WEBHOOK_SOURCE_RANGE = '203.0.113.10/32';
    expect(() => validarConfiguracaoWebhooks()).not.toThrow();
  });
});
