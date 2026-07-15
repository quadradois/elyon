import { createHash, randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { prisma } from '../../src/lib/db';
import agendaRouter from '../../src/rotas/agenda';
import {
  AGENDA_COMMERCIAL_POLICY_VERSION,
  executarComandoAgenda,
  type AgendaCommand,
} from '../../src/servicos/coerencia-agenda-estado';
import { executarProximoEfeitoAgenda, reivindicarProximoEfeitoAgenda } from '../../src/servicos/efeitos-agenda-outbox';
import { executarProximoNoShowAgenda, reivindicarProximoNoShow } from '../../src/servicos/processador-no-show-agenda';

describe('B16 - coerencia atomica entre agenda e estado comercial', () => {
  let tenantA: string;
  let tenantB: string;
  let leadA: string;
  let leadB: string;
  let atividadeA: string;

  beforeEach(async () => {
    const run = randomUUID();
    const a = await prisma.tenant.create({ data: { nome: 'B16 A', slug: `b16-a-${run}` } });
    const b = await prisma.tenant.create({ data: { nome: 'B16 B', slug: `b16-b-${run}` } });
    tenantA = a.id; tenantB = b.id;
    const la = await prisma.lead.create({ data: { tenantId: tenantA, nome: 'Lead A', status: 'VISITA_AGENDADA' } });
    const lb = await prisma.lead.create({ data: { tenantId: tenantB, nome: 'Lead B', status: 'VISITA_AGENDADA' } });
    leadA = la.id; leadB = lb.id;
    atividadeA = (await prisma.atividade.create({ data: {
      leadId: leadA, tipo: 'AVALIACAO', titulo: 'Visita B16', agendadoPara: new Date('2027-02-10T15:00:00Z'),
      statusAgendamento: 'CONFIRMADO', confirmadoPor: 'baseline', confirmadoEm: new Date('2027-02-01T12:00:00Z'),
    } })).id;
  });

  afterEach(async () => {
    const tenants = [tenantA, tenantB].filter(Boolean);
    if (!tenants.length) return;
    await prisma.efeitoAgendaOutbox.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.comandoAgendaLedger.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.milestoneAgenda.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
  });

  function base(id = randomUUID()): Omit<AgendaCommand, 'operacao'> {
    return {
      tenantId: tenantA, leadId: leadA, atividadeId: atividadeA,
      requestIdentity: { source: 'BASELINE', id }, ator: 'baseline', origem: 'BASELINE_B16',
      motivo: 'Motivo estruturado baseline', policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION,
      ocorridoEm: new Date('2027-02-02T12:00:00Z'), expectedVersion: 0,
    } as Omit<AgendaCommand, 'operacao'>;
  }

  it('cancela agenda, regride estado atual e registra milestone na mesma transacao', async () => {
    const result = await executarComandoAgenda({ ...base(), operacao: 'CANCELAR' });
    expect(result).toMatchObject({ success: true, reasonCode: 'CANCELLED', leadStatus: 'TENTATIVA_AGENDAMENTO' });
    expect(await prisma.atividade.findUniqueOrThrow({ where: { id: atividadeA } })).toMatchObject({ statusAgendamento: 'CANCELADO', versao: 1 });
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: leadA } })).toMatchObject({ status: 'TENTATIVA_AGENDAMENTO' });
    expect(await prisma.milestoneAgenda.findMany({ where: { atividadeId: atividadeA } })).toHaveLength(1);
  });

  it('atravessa o caminho humano real API -> comando -> PostgreSQL', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.tenantId = tenantA;
      req.usuario = { id: 'baseline-user', email: 'operador@baseline.invalid', papel: 'ADMIN', tenantId: tenantA };
      next();
    });
    app.use('/api/agenda', agendaRouter);
    const payload = { motivo: 'Cancelamento confirmado', avisarCliente: true, requestId: randomUUID(), expectedVersion: 0 };
    const response = await request(app).post(`/api/agenda/${atividadeA}/cancelar`).send(payload).expect(200);
    await request(app).post(`/api/agenda/${atividadeA}/cancelar`).send(payload).expect(200);
    expect(response.body.sucesso).toBe(true);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadA } })).status).toBe('TENTATIVA_AGENDAMENTO');
    expect(await prisma.comandoAgendaLedger.count({ where: { tenantId: tenantA } })).toBe(1);
    expect(await prisma.efeitoAgendaOutbox.count({ where: { tenantId: tenantA } })).toBe(1);
  });

  it('reagenda criando substituta sem janela parcial e preserva VISITA_AGENDADA', async () => {
    const result = await executarComandoAgenda({ ...base(), operacao: 'REAGENDAR', novoHorario: new Date('2027-02-12T16:00:00Z') });
    expect(result).toMatchObject({ success: true, reasonCode: 'RESCHEDULED', leadStatus: 'VISITA_AGENDADA' });
    const original = await prisma.atividade.findUniqueOrThrow({ where: { id: atividadeA } });
    expect(original).toMatchObject({ statusAgendamento: 'CANCELADO', substituidaPorId: result.atividadeResultanteId, versao: 1 });
    expect(await prisma.atividade.findUniqueOrThrow({ where: { id: result.atividadeResultanteId } })).toMatchObject({ statusAgendamento: 'PENDENTE', versao: 0 });
    expect((await prisma.milestoneAgenda.findFirstOrThrow({ where: { atividadeId: atividadeA } })).tipo).toBe('VISITA_REAGENDADA');
  });

  it('reagendamento repetido pela API com avisarCliente cria uma unica intencao', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.tenantId = tenantA;
      req.usuario = { id: 'baseline-user', email: 'operador@baseline.invalid', papel: 'ADMIN', tenantId: tenantA };
      next();
    });
    app.use('/api/agenda', agendaRouter);
    const payload = {
      novoHorario: '2027-02-12T16:00:00.000Z', motivo: 'Mudanca solicitada',
      avisarCliente: true, requestId: randomUUID(), expectedVersion: 0,
    };
    await request(app).post(`/api/agenda/${atividadeA}/reagendar`).send(payload).expect(200);
    await request(app).post(`/api/agenda/${atividadeA}/reagendar`).send(payload).expect(200);
    expect(await prisma.efeitoAgendaOutbox.count({ where: { tenantId: tenantA, tipo: 'REAGENDAMENTO' } })).toBe(1);
    expect(await prisma.atividade.count({ where: { leadId: leadA } })).toBe(2);
  });

  it('marca no-show, atualiza o Lead e preserva milestone separado', async () => {
    const result = await executarComandoAgenda({ ...base(), ocorridoEm: new Date('2027-02-10T16:00:00Z'), requestIdentity: { source: 'WORKER', id: randomUUID() }, operacao: 'NO_SHOW', parteAusente: 'LEAD' });
    expect(result.reasonCode).toBe('NO_SHOW_RECORDED');
    expect((await prisma.atividade.findUniqueOrThrow({ where: { id: atividadeA } })).statusAgendamento).toBe('NAO_COMPARECEU');
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadA } })).status).toBe('TENTATIVA_AGENDAMENTO');
    expect(await prisma.milestoneAgenda.findFirstOrThrow({ where: { atividadeId: atividadeA } })).toMatchObject({ tipo: 'VISITA_NAO_COMPARECEU', parteAusente: 'LEAD' });
  });

  it('replay retorna o resultado original sem duplicar milestone ou substituta', async () => {
    const request = randomUUID();
    const command = { ...base(request), operacao: 'REAGENDAR' as const, novoHorario: new Date('2027-02-12T16:00:00Z') };
    const first = await executarComandoAgenda(command);
    const replay = await executarComandoAgenda({ ...command, ocorridoEm: new Date('2027-02-03T12:00:00Z') });
    expect(replay).toMatchObject({ success: true, reasonCode: 'COMMAND_REPLAY', replay: true, atividadeResultanteId: first.atividadeResultanteId });
    expect(await prisma.milestoneAgenda.count({ where: { atividadeId: atividadeA } })).toBe(1);
    expect(await prisma.atividade.count({ where: { leadId: leadA } })).toBe(2);
  });

  it('mesma chave com payload divergente falha fechado sem mutacao adicional', async () => {
    const request = randomUUID();
    await executarComandoAgenda({ ...base(request), operacao: 'CANCELAR' });
    const conflict = await executarComandoAgenda({ ...base(request), operacao: 'NO_SHOW', parteAusente: 'LEAD' });
    expect(conflict.reasonCode).toBe('REQUEST_ID_CONFLICT');
    expect(await prisma.milestoneAgenda.count({ where: { atividadeId: atividadeA } })).toBe(1);
  });

  it('evento antigo nao cancela atividade substituta e retorna reason code explicito', async () => {
    const moved = await executarComandoAgenda({ ...base(), operacao: 'REAGENDAR', novoHorario: new Date('2027-02-12T16:00:00Z') });
    const stale = await executarComandoAgenda({ ...base(), expectedVersion: 1, operacao: 'CANCELAR' });
    expect(stale.reasonCode).toBe('ACTIVITY_ALREADY_REPLACED');
    expect((await prisma.atividade.findUniqueOrThrow({ where: { id: moved.atividadeResultanteId } })).statusAgendamento).toBe('PENDENTE');
  });

  it('no-show atrasado nao regride estado comercial mais avancado', async () => {
    await prisma.lead.update({ where: { id: leadA }, data: { status: 'AVALIACAO_EM_ANDAMENTO' } });
    const result = await executarComandoAgenda({ ...base(), ocorridoEm: new Date('2027-02-10T16:00:00Z'), operacao: 'NO_SHOW', parteAusente: 'LEAD' });
    expect(result.reasonCode).toBe('STALE_EVENT');
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadA } })).status).toBe('AVALIACAO_EM_ANDAMENTO');
  });

  it('recusa tenant e Lead divergentes sem revelar qual identidade divergiu', async () => {
    const crossTenant = await executarComandoAgenda({ ...base(), tenantId: tenantB, operacao: 'CANCELAR' });
    const crossLead = await executarComandoAgenda({ ...base(), leadId: leadB, operacao: 'CANCELAR' });
    expect(crossTenant.reasonCode).toBe('TENANT_OWNERSHIP_DENIED');
    expect(crossLead.reasonCode).toBe('TENANT_OWNERSHIP_DENIED');
    expect((await prisma.atividade.findUniqueOrThrow({ where: { id: atividadeA } })).statusAgendamento).toBe('CONFIRMADO');
  });

  it('transicao nao prevista e versao obsoleta sao default-deny', async () => {
    await prisma.lead.update({ where: { id: leadA }, data: { status: 'NOVO' } });
    expect((await executarComandoAgenda({ ...base(), operacao: 'CANCELAR' })).reasonCode).toBe('STATE_TRANSITION_DENIED');
    await prisma.lead.update({ where: { id: leadA }, data: { status: 'VISITA_AGENDADA' } });
    expect((await executarComandoAgenda({ ...base(), expectedVersion: 9, operacao: 'CANCELAR' })).reasonCode).toBe('STALE_EVENT');
  });

  it('concorrencia humano x automacao produz um unico vencedor', async () => {
    const [cancel, reschedule] = await Promise.all([
      executarComandoAgenda({ ...base(), operacao: 'CANCELAR' }),
      executarComandoAgenda({ ...base(), operacao: 'REAGENDAR', novoHorario: new Date('2027-02-12T16:00:00Z') }),
    ]);
    expect([cancel, reschedule].filter((item) => item.success)).toHaveLength(1);
    expect(await prisma.milestoneAgenda.count({ where: { atividadeId: atividadeA } })).toBe(1);
  });

  it('falha no milestone provoca rollback integral de agenda e Lead', async () => {
    const request = randomUUID();
    const requestKey = createHash('sha256').update(['agenda-command-v1', tenantA, 'BASELINE', request].join('|')).digest('hex');
    const milestoneKey = createHash('sha256').update(['agenda-milestone-v1', requestKey, 'CANCELAR'].join('|')).digest('hex');
    await prisma.milestoneAgenda.create({ data: {
      tenantId: tenantA, leadId: leadA, atividadeId: atividadeA, tipo: 'TEST_COLLISION', ator: 'baseline', origem: 'BASELINE_B16',
      motivo: 'Colisao controlada', reasonCode: 'TEST', ocorridoEm: new Date(), chaveIdempotencia: milestoneKey,
    } });
    const result = await executarComandoAgenda({ ...base(request), operacao: 'CANCELAR' });
    expect(result.success).toBe(false);
    expect((await prisma.atividade.findUniqueOrThrow({ where: { id: atividadeA } })).statusAgendamento).toBe('CONFIRMADO');
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadA } })).status).toBe('VISITA_AGENDADA');
    expect(await prisma.comandoAgendaLedger.count({ where: { tenantId: tenantA } })).toBe(0);
  });

  it('falha ao criar a substituicao preserva integralmente agenda original e Lead', async () => {
    const request = randomUUID();
    const requestKey = createHash('sha256').update(['agenda-command-v1', tenantA, 'BASELINE', request].join('|')).digest('hex');
    const milestoneKey = createHash('sha256').update(['agenda-milestone-v1', requestKey, 'REAGENDAR'].join('|')).digest('hex');
    await prisma.milestoneAgenda.create({ data: {
      tenantId: tenantA, leadId: leadA, atividadeId: atividadeA, tipo: 'TEST_COLLISION', ator: 'baseline', origem: 'BASELINE_B16',
      motivo: 'Colisao controlada', reasonCode: 'TEST', ocorridoEm: new Date(), chaveIdempotencia: milestoneKey,
    } });
    const result = await executarComandoAgenda({ ...base(request), operacao: 'REAGENDAR', novoHorario: new Date('2027-02-12T16:00:00Z') });
    expect(result.reasonCode).toBe('AGENDA_REPLACEMENT_FAILED');
    expect(await prisma.atividade.count({ where: { leadId: leadA } })).toBe(1);
    expect(await prisma.atividade.findUniqueOrThrow({ where: { id: atividadeA } })).toMatchObject({ statusAgendamento: 'CONFIRMADO', substituidaPorId: null, versao: 0 });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadA } })).status).toBe('VISITA_AGENDADA');
    expect(await prisma.comandoAgendaLedger.count({ where: { tenantId: tenantA } })).toBe(0);
  });

  it('persiste rejeicao deterministica e seu replay nunca passa a executar', async () => {
    const request = randomUUID();
    const command = { ...base(request), expectedVersion: 9, operacao: 'CANCELAR' as const };
    const denied = await executarComandoAgenda(command);
    expect(denied.reasonCode).toBe('STALE_EVENT');
    await prisma.atividade.update({ where: { id: atividadeA }, data: { versao: 9 } });
    const replay = await executarComandoAgenda(command);
    expect(replay).toMatchObject({ success: false, reasonCode: 'STALE_EVENT', replay: true });
    expect((await prisma.atividade.findUniqueOrThrow({ where: { id: atividadeA } })).statusAgendamento).toBe('CONFIRMADO');
    expect(await prisma.comandoAgendaLedger.count({ where: { tenantId: tenantA } })).toBe(1);
  });

  it('recusa payload divergente de uma rejeicao persistida sem criar nem cancelar', async () => {
    const request = randomUUID();
    await executarComandoAgenda({ ...base(request), expectedVersion: 9, operacao: 'CANCELAR' });
    const conflict = await executarComandoAgenda({ ...base(request), expectedVersion: 9, operacao: 'REAGENDAR', novoHorario: new Date('2027-02-12T16:00:00Z') });
    expect(conflict.reasonCode).toBe('REQUEST_ID_CONFLICT');
    expect(await prisma.atividade.count({ where: { leadId: leadA } })).toBe(1);
    expect(await prisma.milestoneAgenda.count({ where: { atividadeId: atividadeA } })).toBe(0);
  });

  it('evento anterior a mutacao autoritativa falha mesmo com versao aparentemente igual', async () => {
    await prisma.atividade.update({
      where: { id: atividadeA },
      data: { estadoAgendaAtualizadoEm: new Date('2027-02-05T12:00:00Z') },
    });
    const stale = await executarComandoAgenda({ ...base(), ocorridoEm: new Date('2027-02-04T12:00:00Z'), operacao: 'CANCELAR' });
    expect(stale.reasonCode).toBe('STALE_EVENT');
  });

  it('confirmacao entre leitura e cancelamento incrementa fencing e torna o comando stale', async () => {
    const snapshot = await prisma.atividade.findUniqueOrThrow({ where: { id: atividadeA } });
    await prisma.atividade.update({
      where: { id: atividadeA },
      data: { confirmadoEm: new Date('2027-02-03T12:00:00Z'), versao: { increment: 1 }, estadoAgendaAtualizadoEm: new Date('2027-02-03T12:00:00Z') },
    });
    const result = await executarComandoAgenda({ ...base(), ocorridoEm: new Date('2027-02-04T12:00:00Z'), expectedVersion: snapshot.versao, operacao: 'CANCELAR' });
    expect(result.reasonCode).toBe('STALE_EVENT');
  });

  it('impede no-show antes do horario mais grace period', async () => {
    const early = await executarComandoAgenda({
      ...base(), ocorridoEm: new Date('2027-02-10T15:20:00Z'), operacao: 'NO_SHOW', parteAusente: 'LEAD',
    });
    expect(early.reasonCode).toBe('NO_SHOW_NOT_DUE');
    expect((await prisma.atividade.findUniqueOrThrow({ where: { id: atividadeA } })).statusAgendamento).toBe('CONFIRMADO');
  });

  it('cancelamento repetido com aviso cria uma intencao e confirma um unico envio', async () => {
    await prisma.lead.update({ where: { id: leadA }, data: { telefone: '5511999999999' } });
    await prisma.sessaoWhatsapp.create({ data: { tenantId: tenantA, nome: 'B16', instanceName: `b16-${randomUUID()}`, status: 'CONECTADO' } });
    const request = randomUUID();
    const command = { ...base(request), operacao: 'CANCELAR' as const, notificacao: { tipo: 'CANCELAMENTO' as const, mensagem: 'Aviso deterministico' } };
    await executarComandoAgenda(command);
    await executarComandoAgenda({ ...command, ocorridoEm: new Date('2027-02-03T12:00:00Z') });
    expect(await prisma.efeitoAgendaOutbox.count({ where: { tenantId: tenantA } })).toBe(1);
    const sends: string[] = [];
    expect(await executarProximoEfeitoAgenda('baseline-effect', { send: async (_instance, _phone, _message, key) => { sends.push(key); return { providerId: 'provider-1' }; } })).toBe(true);
    expect(await executarProximoEfeitoAgenda('baseline-effect', { send: async () => { throw new Error('nao deve enviar'); } })).toBe(false);
    expect(sends).toHaveLength(1);
    expect(await prisma.efeitoAgendaOutbox.findFirstOrThrow({ where: { tenantId: tenantA } })).toMatchObject({ status: 'CONCLUIDA' });
  });

  it('reagendamento repetido com aviso cria uma unica intencao', async () => {
    const command = {
      ...base(randomUUID()), operacao: 'REAGENDAR' as const, novoHorario: new Date('2027-02-12T16:00:00Z'),
      notificacao: { tipo: 'REAGENDAMENTO' as const, mensagem: 'Novo horario confirmado' },
    };
    await executarComandoAgenda(command);
    await executarComandoAgenda(command);
    expect(await prisma.efeitoAgendaOutbox.count({ where: { tenantId: tenantA } })).toBe(1);
  });

  it('reserva abandonada entra em reconciliacao sem reenvio automatico', async () => {
    await executarComandoAgenda({
      ...base(), operacao: 'CANCELAR', notificacao: { tipo: 'CANCELAMENTO', mensagem: 'Aviso' },
    });
    const reserved = await reivindicarProximoEfeitoAgenda('owner-crashed', new Date('2027-02-02T13:00:00Z'));
    expect(reserved?.status).toBe('RESERVADA');
    const sends: string[] = [];
    expect(await executarProximoEfeitoAgenda('owner-takeover', { send: async () => { sends.push('sent'); return {}; } }, new Date('2027-02-02T13:03:00Z'))).toBe(false);
    expect(sends).toHaveLength(0);
    expect(await prisma.efeitoAgendaOutbox.findFirstOrThrow({ where: { tenantId: tenantA } })).toMatchObject({ status: 'RECONCILIACAO', reasonCode: 'DELIVERY_UNKNOWN' });
  });

  it('worker real reivindica no-show vencido e atravessa comando ate PostgreSQL', async () => {
    const now = new Date('2027-02-10T17:00:00Z');
    expect(await executarProximoNoShowAgenda('baseline-no-show', now)).toBe(true);
    expect(await prisma.atividade.findUniqueOrThrow({ where: { id: atividadeA } })).toMatchObject({ statusAgendamento: 'NAO_COMPARECEU', noShowReasonCode: 'NO_SHOW_RECORDED' });
    expect(await prisma.milestoneAgenda.count({ where: { atividadeId: atividadeA, tipo: 'VISITA_NAO_COMPARECEU' } })).toBe(1);
  });

  it('dois workers concorrentes reivindicam uma atividade vencida somente uma vez', async () => {
    const now = new Date('2027-02-10T17:00:00Z');
    const outcomes = await Promise.all([
      executarProximoNoShowAgenda('baseline-no-show-a', now),
      executarProximoNoShowAgenda('baseline-no-show-b', now),
    ]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(await prisma.milestoneAgenda.count({ where: { atividadeId: atividadeA } })).toBe(1);
  });

  it('takeover apos restart reaproveita identidade e nao duplica milestone', async () => {
    const claimed = await reivindicarProximoNoShow('worker-before-restart', new Date('2027-02-10T17:00:00Z'));
    expect(claimed).not.toBeNull();
    expect(await executarProximoNoShowAgenda('worker-after-restart', new Date('2027-02-10T17:02:00Z'))).toBe(true);
    expect(await executarProximoNoShowAgenda('worker-third', new Date('2027-02-10T17:03:00Z'))).toBe(false);
    expect(await prisma.milestoneAgenda.count({ where: { atividadeId: atividadeA } })).toBe(1);
  });
});
