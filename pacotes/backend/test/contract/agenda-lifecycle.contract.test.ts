import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { prisma } from '../../src/lib/db';
import agendaRouter from '../../src/rotas/agenda';
import { resetAgendaLifecycleRolloutCacheForTests } from '../../src/servicos/agenda-lifecycle-rollout';

describe('contrato HTTP canônico da Agenda', () => {
  let tenantId: string;
  let leadId: string;
  let atividadeId: string;
  let authenticatedUser: { id: string; email: string; papel: string; tenantId: string };
  const app = express();

  beforeAll(() => {
    app.use(express.json());
    app.use((req, _res, next) => {
      req.tenantId = tenantId;
      req.usuario = authenticatedUser;
      next();
    });
    app.use('/api/agenda', agendaRouter);
  });

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({ data: { nome: 'Agenda Contract', slug: `agenda-contract-${randomUUID()}` } });
    tenantId = tenant.id;
    authenticatedUser = { id: 'contract-admin', email: 'admin@contract.invalid', papel: 'ADMIN', tenantId };
    process.env.AGENDA_LIFECYCLE_POLICY_ENABLED = 'true';
    process.env.AGENDA_LIFECYCLE_COMMANDS_ENABLED = 'true';
    process.env.AGENDA_PILOT_TENANT_ID = tenantId;
    process.env.AGENDA_PILOT_STARTED_AT = '2026-08-02T00:00:00.000Z';
    resetAgendaLifecycleRolloutCacheForTests();
    const lead = await prisma.lead.create({ data: { tenantId, nome: 'Lead Contract', status: 'VISITA_AGENDADA' } });
    leadId = lead.id;
    atividadeId = (await prisma.atividade.create({ data: {
      leadId, tipo: 'REUNIAO', titulo: 'Contrato Agenda', agendadoPara: new Date('2030-08-03T13:00:00Z'),
      statusAgendamento: 'SOLICITADO',
    } })).id;
  });

  afterEach(async () => {
    await prisma.efeitoAgendaOutbox.deleteMany({ where: { tenantId } });
    await prisma.comandoAgendaLedger.deleteMany({ where: { tenantId } });
    await prisma.milestoneAgenda.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    delete process.env.AGENDA_LIFECYCLE_POLICY_ENABLED;
    delete process.env.AGENDA_LIFECYCLE_COMMANDS_ENABLED;
    delete process.env.AGENDA_PILOT_TENANT_ID;
    delete process.env.AGENDA_PILOT_STARTED_AT;
    resetAgendaLifecycleRolloutCacheForTests();
  });

  it('retorna visão com fase, versão e ações permitidas', async () => {
    const response = await request(app).get(`/api/agenda/${atividadeId}`).expect(200);
    expect(response.body).toEqual(expect.objectContaining({
      id: atividadeId, status: 'SOLICITADO', temporalPhase: 'FUTURO', version: 0,
      allowedActions: expect.arrayContaining(['CANCELAR', 'REAGENDAR']),
    }));
  });

  it('aplica comando uma vez e responde cinco replays idempotentes', async () => {
    const idempotencyKey = randomUUID();
    const execute = () => request(app)
      .post(`/api/agenda/${atividadeId}/commands`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ command: 'CANCELAR', expectedVersion: 0, reasonCode: 'CONTRACT_TEST', channel: 'PAINEL' })
      .expect(200);
    const first = await execute();
    expect(first.body).toMatchObject({ applied: true, replayed: false });
    for (let replay = 0; replay < 5; replay += 1) {
      await execute().expect((response) => {
        expect(response.body).toMatchObject({ applied: false, replayed: true });
      });
    }
    expect(await prisma.comandoAgendaLedger.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.milestoneAgenda.count({ where: { tenantId } })).toBe(1);
  });

  it('na Onda 0 expoe apenas politica temporal e mantem a fila da Onda 1 fechada', async () => {
    process.env.AGENDA_LIFECYCLE_COMMANDS_ENABLED = 'false';
    resetAgendaLifecycleRolloutCacheForTests();
    const view = await request(app).get(`/api/agenda/${atividadeId}`).expect(200);
    expect(view.body).toMatchObject({
      lifecyclePolicyEnabled: true,
      lifecycleCommandsEnabled: false,
      allowedActions: ['CANCELAR', 'REAGENDAR'],
    });
    await request(app).get('/api/agenda/pendencias/vencidas').expect(200, []);
  });

  it('mantem o endpoint canonico fechado antes da Onda 1', async () => {
    process.env.AGENDA_LIFECYCLE_COMMANDS_ENABLED = 'false';
    resetAgendaLifecycleRolloutCacheForTests();
    const response = await request(app)
      .post(`/api/agenda/${atividadeId}/commands`)
      .set('Idempotency-Key', randomUUID())
      .send({ command: 'CANCELAR', expectedVersion: 0, reasonCode: 'WAVE0_ONLY', channel: 'PAINEL' })
      .expect(404);
    expect(response.body).toMatchObject({ erro: 'AGENDA_LIFECYCLE_COMMANDS_DISABLED' });
  });

  it('retorna rejeição estruturada para versão obsoleta', async () => {
    await prisma.atividade.update({ where: { id: atividadeId }, data: { versao: 2 } });
    const response = await request(app)
      .post(`/api/agenda/${atividadeId}/commands`)
      .set('Idempotency-Key', randomUUID())
      .send({ command: 'CANCELAR', expectedVersion: 0, reasonCode: 'STALE_TEST', channel: 'PAINEL' })
      .expect(409);
    expect(response.body).toEqual(expect.objectContaining({
      code: 'STALE_EVENT', message: 'STALE_EVENT', appointment: expect.objectContaining({ id: atividadeId, version: 2 }),
    }));
  });

  it('mantém visualizador somente leitura e rejeita mutação pelo servidor', async () => {
    authenticatedUser = { id: 'contract-viewer', email: 'viewer@contract.invalid', papel: 'VISUALIZADOR', tenantId };
    const view = await request(app).get(`/api/agenda/${atividadeId}`).expect(200);
    expect(view.body.allowedActions).toEqual([]);
    await request(app)
      .post(`/api/agenda/${atividadeId}/commands`)
      .set('Idempotency-Key', randomUUID())
      .send({ command: 'CANCELAR', expectedVersion: 0, reasonCode: 'VIEWER_DENIED', channel: 'PAINEL' })
      .expect(403);
  });

  it('impede corretor de consultar e alterar compromisso atribuído a outro especialista', async () => {
    const [corretor, outro] = await Promise.all([
      prisma.usuario.create({ data: {
        tenantId, nome: 'Corretor A', email: `a-${randomUUID()}@contract.invalid`, senha: 'test', papel: 'CORRETOR',
      } }),
      prisma.usuario.create({ data: {
        tenantId, nome: 'Corretor B', email: `b-${randomUUID()}@contract.invalid`, senha: 'test', papel: 'CORRETOR',
      } }),
    ]);
    await prisma.atividade.update({ where: { id: atividadeId }, data: { corretorAtualId: outro.id } });
    authenticatedUser = { id: corretor.id, email: corretor.email, papel: 'CORRETOR', tenantId };

    await request(app).get(`/api/agenda/${atividadeId}`).expect(404);
    await request(app)
      .post(`/api/agenda/${atividadeId}/commands`)
      .set('Idempotency-Key', randomUUID())
      .send({ command: 'RECUSAR', expectedVersion: 0, reasonCode: 'OTHER_SPECIALIST', channel: 'PAINEL' })
      .expect(403);
  });

  it('exige e audita a parte ausente no não comparecimento manual', async () => {
    await prisma.atividade.update({
      where: { id: atividadeId },
      data: { agendadoPara: new Date('2026-08-01T10:00:00Z'), statusAgendamento: 'CONFIRMADO' },
    });
    await request(app)
      .post(`/api/agenda/${atividadeId}/commands`)
      .set('Idempotency-Key', randomUUID())
      .send({ command: 'NAO_COMPARECEU', expectedVersion: 0, reasonCode: 'OUTCOME_WITHOUT_PARTY', channel: 'PAINEL' })
      .expect(400);

    await request(app)
      .post(`/api/agenda/${atividadeId}/commands`)
      .set('Idempotency-Key', randomUUID())
      .send({
        command: 'NAO_COMPARECEU', expectedVersion: 0, reasonCode: 'SPECIALIST_ABSENT',
        channel: 'PAINEL', absentParty: 'ESPECIALISTA',
      })
      .expect(200);
    expect(await prisma.milestoneAgenda.findFirstOrThrow({ where: { atividadeId } }))
      .toMatchObject({ tipo: 'VISITA_NAO_COMPARECEU', parteAusente: 'CORRETOR' });

    const agenda = await request(app)
      .get('/api/agenda')
      .query({ start: '2026-08-01T00:00:00.000Z', end: '2026-08-02T00:00:00.000Z' })
      .expect(200);
    expect(agenda.body).toEqual([
      expect.objectContaining({
        id: atividadeId,
        extendedProps: expect.objectContaining({
          status: 'NAO_COMPARECEU',
          parteAusente: 'ESPECIALISTA',
          resultadoRegistradoPor: 'admin@contract.invalid',
          resultadoMotivo: 'SPECIALIST_ABSENT',
          resultadoRegistradoEm: expect.any(String),
        }),
      }),
    ]);
  });

  it('serializa duas transições concorrentes sem dupla mutação', async () => {
    const body = { command: 'CANCELAR', expectedVersion: 0, reasonCode: 'CONCURRENT_TEST', channel: 'PAINEL' };
    const responses = await Promise.all([
      request(app).post(`/api/agenda/${atividadeId}/commands`).set('Idempotency-Key', randomUUID()).send(body),
      request(app).post(`/api/agenda/${atividadeId}/commands`).set('Idempotency-Key', randomUUID()).send(body),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await prisma.milestoneAgenda.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.atividade.findUniqueOrThrow({ where: { id: atividadeId } })).toMatchObject({
      statusAgendamento: 'CANCELADO', versao: 1,
    });
  });
});
