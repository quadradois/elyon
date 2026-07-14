import express from 'express';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { prisma } from '../../src/lib/db';
import { closeRedisClient, getRedisClient } from '../../src/lib/redis';
import {
  adquirirMutexContato,
  liberarMutexContato,
  registrarHashRespostaUnicaJanela,
} from '../../src/lib/redis-cache';
import rotaLeads from '../../src/rotas/leads';
import { registrarEventoWebhook } from '../../src/servicos/webhook-seguranca';

const runId = randomUUID();
const tenantIds: string[] = [];
const webhookIds: string[] = [];
const redisKeys: string[] = [];

function validarInfraDedicada(): void {
  const databaseUrl = process.env.DATABASE_URL || '';
  const redisUrl = process.env.REDIS_URL || '';

  if (!/elyon_integration(?:\?|$)/.test(databaseUrl)) {
    throw new Error('DATABASE_URL deve apontar para o banco dedicado elyon_integration');
  }
  if (!/\/(?:15)(?:\?|$)/.test(redisUrl)) {
    throw new Error('REDIS_URL deve usar o database Redis dedicado /15');
  }
}

function dadosLead(tenantId: string, nome: string) {
  return {
    tenantId,
    nome,
    doresIdentificadas: [],
    objecoes: [],
    imovelCaracteristicas: [],
    imovelFotos: [],
  };
}

beforeAll(() => {
  validarInfraDedicada();
});

afterAll(async () => {
  if (webhookIds.length > 0) {
    await prisma.webhookEvento.deleteMany({ where: { eventoId: { in: webhookIds } } });
  }
  if (tenantIds.length > 0) {
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  }

  const redis = await getRedisClient();
  if (redisKeys.length > 0) await redis.del(redisKeys);
  await closeRedisClient();
  await prisma.$disconnect();
});

describe('fronteiras reais de infraestrutura', () => {
  it('isola listagem e detalhe de leads entre tenants', async () => {
    const [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({ data: { nome: 'Integration A', slug: `integration-a-${runId}` } }),
      prisma.tenant.create({ data: { nome: 'Integration B', slug: `integration-b-${runId}` } }),
    ]);
    tenantIds.push(tenantA.id, tenantB.id);

    const [leadA, leadB] = await Promise.all([
      prisma.lead.create({ data: dadosLead(tenantA.id, 'Lead tenant A') }),
      prisma.lead.create({ data: dadosLead(tenantB.id, 'Lead tenant B') }),
    ]);

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.tenantId = tenantA.id;
      next();
    });
    app.use('/leads', rotaLeads);

    const listagem = await request(app).get('/leads');
    expect(listagem.status).toBe(200);
    expect(listagem.body).toEqual([
      expect.objectContaining({ id: leadA.id, nome: 'Lead tenant A' }),
    ]);

    const detalheOutroTenant = await request(app).get(`/leads/${leadB.id}`);
    expect(detalheOutroTenant.status).toBe(403);
    expect(JSON.stringify(detalheOutroTenant.body)).not.toContain('Lead tenant B');
  });

  it('persiste recibo de webhook e bloqueia replay pela constraint real', async () => {
    const eventoId = `integration-${runId}`;
    webhookIds.push(eventoId);
    const entrada = {
      provedor: 'ASAAS' as const,
      eventoId,
      tipo: 'PAYMENT_RECEIVED',
      payloadHash: `sha256-${runId}`,
      payload: { id: eventoId },
    };

    const primeiro = await registrarEventoWebhook(entrada);
    const replay = await registrarEventoWebhook(entrada);

    expect(primeiro).toEqual({ duplicado: false, registroId: expect.any(String) });
    expect(replay).toEqual({ duplicado: true });
    await expect(prisma.webhookEvento.count({ where: { eventoId } })).resolves.toBe(1);
  });

  it('garante TTL e exclusao mutua atomica no Redis real', async () => {
    const contatoId = `integration-${runId}`;
    const scope = `integration-${runId}`;
    const hash = 'resposta';
    const mutexKey = `mutex:contato:${contatoId}`;
    const dedupeKey = `hash:resposta:janela:${scope}:${hash}`;
    redisKeys.push(mutexKey, dedupeKey);

    await expect(adquirirMutexContato(contatoId)).resolves.toBe(true);
    await expect(adquirirMutexContato(contatoId)).resolves.toBe(false);

    const redis = await getRedisClient();
    const mutexTtl = await redis.ttl(mutexKey);
    expect(mutexTtl).toBeGreaterThan(0);
    expect(mutexTtl).toBeLessThanOrEqual(600);

    await expect(registrarHashRespostaUnicaJanela(scope, hash, 5)).resolves.toBe(true);
    await expect(registrarHashRespostaUnicaJanela(scope, hash, 5)).resolves.toBe(false);
    expect(await redis.ttl(dedupeKey)).toBeGreaterThan(0);

    await liberarMutexContato(contatoId);
    await expect(adquirirMutexContato(contatoId)).resolves.toBe(true);
  });
});
