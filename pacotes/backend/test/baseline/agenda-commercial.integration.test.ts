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
    await prisma.comandoAgendaLedger.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.milestoneAgenda.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
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
    const response = await request(app).post(`/api/agenda/${atividadeA}/cancelar`).send({
      motivo: 'Cancelamento confirmado', avisarCliente: false, requestId: randomUUID(), expectedVersion: 0,
    }).expect(200);
    expect(response.body.sucesso).toBe(true);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadA } })).status).toBe('TENTATIVA_AGENDAMENTO');
    expect(await prisma.comandoAgendaLedger.count({ where: { tenantId: tenantA } })).toBe(1);
  });

  it('reagenda criando substituta sem janela parcial e preserva VISITA_AGENDADA', async () => {
    const result = await executarComandoAgenda({ ...base(), operacao: 'REAGENDAR', novoHorario: new Date('2027-02-12T16:00:00Z') });
    expect(result).toMatchObject({ success: true, reasonCode: 'RESCHEDULED', leadStatus: 'VISITA_AGENDADA' });
    const original = await prisma.atividade.findUniqueOrThrow({ where: { id: atividadeA } });
    expect(original).toMatchObject({ statusAgendamento: 'CANCELADO', substituidaPorId: result.atividadeResultanteId, versao: 1 });
    expect(await prisma.atividade.findUniqueOrThrow({ where: { id: result.atividadeResultanteId } })).toMatchObject({ statusAgendamento: 'PENDENTE', versao: 0 });
    expect((await prisma.milestoneAgenda.findFirstOrThrow({ where: { atividadeId: atividadeA } })).tipo).toBe('VISITA_REAGENDADA');
  });

  it('marca no-show, atualiza o Lead e preserva milestone separado', async () => {
    const result = await executarComandoAgenda({ ...base(), requestIdentity: { source: 'WORKER', id: randomUUID() }, operacao: 'NO_SHOW', parteAusente: 'LEAD' });
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
    const result = await executarComandoAgenda({ ...base(), operacao: 'NO_SHOW', parteAusente: 'LEAD' });
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
});
