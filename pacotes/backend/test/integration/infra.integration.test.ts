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
import { withTenantAdminDb, withTenantDb } from '../../src/lib/tenant-db';

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

    const modoOutroTenant = await request(app).get(`/leads/${leadB.id}/modo`);
    expect(modoOutroTenant.status).toBe(200);
    expect(modoOutroTenant.body).toEqual({ modo: 'IA', contatoId: null });
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

describe('piloto PostgreSQL RLS', () => {
  let tenantA: { id: string };
  let tenantB: { id: string };
  let leadA: { id: string };
  let leadB: { id: string };

  beforeAll(async () => {
    [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({ data: { nome: 'RLS A', slug: `rls-a-${runId}` } }),
      prisma.tenant.create({ data: { nome: 'RLS B', slug: `rls-b-${runId}` } }),
    ]);
    tenantIds.push(tenantA.id, tenantB.id);

    [leadA, leadB] = await Promise.all([
      prisma.lead.create({ data: dadosLead(tenantA.id, 'RLS lead A') }),
      prisma.lead.create({ data: dadosLead(tenantB.id, 'RLS lead B') }),
    ]);
    await Promise.all([
      prisma.campanha.create({ data: { tenantId: tenantA.id, nome: 'RLS campanha A' } }),
      prisma.campanha.create({ data: { tenantId: tenantB.id, nome: 'RLS campanha B' } }),
    ]);
  });

  it('bloqueia leitura e mutacao cross-tenant mesmo sem filtro Prisma', async () => {
    const visiveis = await withTenantDb(tenantA.id, async (tx) => ({
      leads: await tx.lead.findMany({ select: { id: true, tenantId: true } }),
      campanhas: await tx.campanha.findMany({ select: { tenantId: true } }),
      estrangeiro: await tx.lead.findUnique({ where: { id: leadB.id } }),
    }));

    expect(visiveis.leads).toEqual([expect.objectContaining({ id: leadA.id, tenantId: tenantA.id })]);
    expect(visiveis.campanhas).toEqual([expect.objectContaining({ tenantId: tenantA.id })]);
    expect(visiveis.estrangeiro).toBeNull();

    await expect(withTenantDb(tenantA.id, (tx) => tx.lead.create({
      data: dadosLead(tenantB.id, 'Cross tenant bloqueado'),
    }))).rejects.toThrow();
  });

  it('nao vaza tenant nem role entre conexoes reutilizadas do pool', async () => {
    const alternados = await Promise.all(Array.from({ length: 16 }, async (_, indice) => {
      const tenantId = indice % 2 === 0 ? tenantA.id : tenantB.id;
      return withTenantDb(tenantId, async (tx) => {
        const [contexto] = await tx.$queryRaw<Array<{ role_name: string; tenant_id: string }>>`
          SELECT current_user::text AS role_name,
                 current_setting('app.tenant_id', true) AS tenant_id
        `;
        const tenantsVisiveis = await tx.lead.findMany({
          distinct: ['tenantId'],
          select: { tenantId: true },
        });
        return { contexto, tenantsVisiveis };
      });
    }));

    alternados.forEach(({ contexto, tenantsVisiveis }, indice) => {
      const esperado = indice % 2 === 0 ? tenantA.id : tenantB.id;
      expect(contexto).toEqual({ role_name: 'elyon_tenant_access', tenant_id: esperado });
      expect(tenantsVisiveis).toEqual([{ tenantId: esperado }]);
    });

    const foraDaTransacao = await Promise.all(Array.from({ length: 16 }, () =>
      prisma.$queryRaw<Array<{ role_name: string; tenant_id: string | null }>>`
        SELECT current_user::text AS role_name,
               NULLIF(current_setting('app.tenant_id', true), '') AS tenant_id
      `,
    ));
    foraDaTransacao.flat().forEach((contexto) => {
      expect(contexto.role_name).not.toBe('elyon_tenant_access');
      expect(contexto.tenant_id).toBeNull();
    });
  });

  it('mantem acesso administrativo explicito e auditavel', async () => {
    const ids = await withTenantAdminDb({
      tenantId: tenantA.id,
      actor: 'integration-suite',
      reason: 'Validar operacao administrativa cross-tenant do piloto',
    }, (tx) => tx.lead.findMany({
      where: { id: { in: [leadA.id, leadB.id] } },
      select: { id: true },
    }));

    expect(ids.map((lead) => lead.id).sort()).toEqual([leadA.id, leadB.id].sort());
    await expect(prisma.logAuditoria.findFirst({
      where: { tenantId: tenantA.id, acao: 'RLS_ADMIN_ACCESS' },
    })).resolves.toEqual(expect.objectContaining({
      entidade: 'TenantData',
      detalhes: expect.objectContaining({ actor: 'integration-suite' }),
    }));
  });

  it('mede o impacto do RLS dentro de uma transacao equivalente', async () => {
    const iteracoes = 20;
    const inicioBaseline = performance.now();
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < iteracoes; i += 1) {
        await tx.lead.findMany({ where: { tenantId: tenantA.id }, select: { id: true } });
      }
    });
    const baselineMs = performance.now() - inicioBaseline;

    const inicioRls = performance.now();
    await withTenantDb(tenantA.id, async (tx) => {
      for (let i = 0; i < iteracoes; i += 1) {
        await tx.lead.findMany({ select: { id: true } });
      }
    });
    const rlsMs = performance.now() - inicioRls;
    const overheadMs = rlsMs - baselineMs;

    console.log(JSON.stringify({ metric: 'tenant_rls_pilot', iteracoes, baselineMs, rlsMs, overheadMs }));
    expect(rlsMs).toBeLessThan(baselineMs * 8 + 250);
  });
});
