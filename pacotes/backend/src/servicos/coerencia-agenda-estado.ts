import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { agendaComercialEventos, registrarAgendaLifecycleDecision } from '../observabilidade/agenda-comercial-metrics';
import { avaliarAgendaPolicy, type AgendaPolicyAction, type AgendaPolicyActor } from './agenda-policy';

export const AGENDA_COMMERCIAL_POLICY_VERSION = 'agenda-commercial-v1';

export type AgendaCommandSource = 'MANUAL_API' | 'PUBLIC_TOKEN' | 'INBOUND_BATCH' | 'WORKER' | 'BASELINE';
export type AgendaCommandIdentity = { source: AgendaCommandSource; id: string };
export type AgendaReasonCode =
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'NO_SHOW_RECORDED'
  | 'COMPLETED'
  | 'ASSIGNMENT_CONFIRMED'
  | 'PROPOSED'
  | 'REQUESTED'
  | 'ASSIGNMENT_DECLINED'
  | 'CORRECTED'
  | 'COMMAND_REPLAY'
  | 'REQUEST_ID_CONFLICT'
  | 'TENANT_OWNERSHIP_DENIED'
  | 'ACTIVITY_ALREADY_REPLACED'
  | 'APPOINTMENT_STARTED'
  | 'STALE_EVENT'
  | 'STATE_TRANSITION_DENIED'
  | 'NO_SHOW_NOT_DUE'
  | 'NO_SHOW_LEASE_LOST'
  | 'COMMAND_TRANSIENT_FAILURE'
  | 'AGENDA_REPLACEMENT_FAILED'
  | 'SPECIALIST_REQUIRED'
  | 'JUSTIFICATION_REQUIRED'
  | 'INVALID_COMMAND';

type BaseCommand = {
  tenantId: string;
  leadId: string;
  atividadeId: string;
  requestIdentity: AgendaCommandIdentity;
  ator: string;
  origem: string;
  motivo: string;
  policyVersion: string;
  ocorridoEm: Date;
  expectedVersion: number;
  correlationId?: string;
  notificacao?: AgendaCommandNotification;
  notificacoes?: AgendaCommandNotification[];
};

type AgendaCommandNotification = {
  tipo: 'CANCELAMENTO' | 'REAGENDAMENTO' | 'SOLICITACAO' | 'CONFIRMACAO' | 'CORRECAO' | 'SUBSTITUICAO';
  mensagem: string;
  destinatarioTipo?: 'LEAD' | 'USUARIO';
  usuarioDestinoId?: string;
};

export type CancelarAgendaCommand = BaseCommand & { operacao: 'CANCELAR' };
export type ReagendarAgendaCommand = BaseCommand & { operacao: 'REAGENDAR'; novoHorario: Date; novoTitulo?: string; novaDescricao?: string; responsavelId?: string };
export type NoShowLeaseReference = { owner: string; fencingToken: number; leaseAte: Date };
export type MarcarNoShowCommand = BaseCommand & {
  operacao: 'NO_SHOW';
  parteAusente: 'LEAD' | 'CORRETOR';
  noShowLease?: NoShowLeaseReference;
};
export type RealizarAgendaCommand = BaseCommand & { operacao: 'REALIZAR' };
export type ConfirmarAtribuicaoAgendaCommand = BaseCommand & { operacao: 'CONFIRMAR_ATRIBUICAO'; responsavelId?: string };
export type RecusarAtribuicaoAgendaCommand = BaseCommand & { operacao: 'RECUSAR' };
export type ProporAgendaCommand = BaseCommand & { operacao: 'PROPOR'; novoHorario: Date; manifestacaoLead?: 'PROPOSTA_OPERADOR' };
export type SolicitarAgendaCommand = BaseCommand & {
  operacao: 'SOLICITAR'; novoHorario?: Date; manifestacaoLead: 'HORARIO_ESCOLHIDO' | 'HORARIO_ACEITO'; responsavelId?: string;
  tokenConfirmacaoCorretor?: string;
};
export type CorrigirAgendaCommand = BaseCommand & {
  operacao: 'CORRIGIR';
  estadoCorrigido: 'REALIZADO' | 'NAO_COMPARECEU' | 'CANCELADO';
  justificativa: string;
};
export type AgendaCommand = CancelarAgendaCommand | ReagendarAgendaCommand | MarcarNoShowCommand
  | RealizarAgendaCommand | ConfirmarAtribuicaoAgendaCommand | ProporAgendaCommand
  | RecusarAtribuicaoAgendaCommand | SolicitarAgendaCommand | CorrigirAgendaCommand;

export type AgendaCommandResult = {
  success: boolean;
  reasonCode: AgendaReasonCode;
  atividadeId: string;
  atividadeResultanteId?: string;
  leadStatus?: string;
  replay?: boolean;
  decisionPersisted?: boolean;
  decisionKey?: string;
  decisionOutcome?: AgendaReasonCode;
  decisionExpectedVersion?: number;
  transient?: boolean;
};

function hash(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function normalizar(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9:_ -]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function sanitizarJustificativaAgenda(value: string): string {
  return value.replace(/[<>]/g, '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function resolverAtorPolicy(command: AgendaCommand): AgendaPolicyActor {
  if (command.requestIdentity.source === 'PUBLIC_TOKEN') return 'PUBLICO';
  if (command.requestIdentity.source === 'WORKER') return 'SISTEMA';
  if (normalizar(command.ator).includes('admin')) return 'ADMIN';
  if (normalizar(command.ator).includes('ai_agent')) return 'AGENTE';
  return 'OPERADOR';
}

export function validarComandoAgenda(command: AgendaCommand): AgendaReasonCode | null {
  if (!command.tenantId?.trim() || !command.leadId?.trim() || !command.atividadeId?.trim()) return 'INVALID_COMMAND';
  if (!command.requestIdentity?.id?.trim() || !command.requestIdentity.source) return 'INVALID_COMMAND';
  if (!command.ator?.trim() || !command.origem?.trim() || normalizar(command.motivo).length < 3) return 'INVALID_COMMAND';
  if (command.policyVersion !== AGENDA_COMMERCIAL_POLICY_VERSION) return 'INVALID_COMMAND';
  if (!Number.isInteger(command.expectedVersion) || command.expectedVersion < 0) return 'INVALID_COMMAND';
  if (!Number.isFinite(command.ocorridoEm?.getTime())) return 'INVALID_COMMAND';
  if (command.operacao === 'NO_SHOW' && command.requestIdentity.source === 'WORKER'
    && (!command.noShowLease?.owner?.trim()
      || !Number.isInteger(command.noShowLease.fencingToken)
      || command.noShowLease.fencingToken < 1
      || !Number.isFinite(command.noShowLease.leaseAte?.getTime()))) return 'INVALID_COMMAND';
  if (command.notificacao && (!command.notificacao.mensagem?.trim()
    || (command.operacao === 'CANCELAR' && command.notificacao.tipo !== 'CANCELAMENTO')
    || (command.operacao === 'REAGENDAR' && command.notificacao.tipo !== 'REAGENDAMENTO')
    || ['NO_SHOW', 'REALIZAR'].includes(command.operacao))) return 'INVALID_COMMAND';
  if (command.notificacoes?.some((item) => !item.mensagem?.trim()
    || (item.destinatarioTipo === 'USUARIO' && !item.usuarioDestinoId?.trim()))) return 'INVALID_COMMAND';
  if (command.operacao === 'REAGENDAR' && (!Number.isFinite(command.novoHorario?.getTime()) || command.novoHorario <= command.ocorridoEm)) return 'INVALID_COMMAND';
  if (command.operacao === 'PROPOR' && (!Number.isFinite(command.novoHorario?.getTime()) || command.novoHorario <= command.ocorridoEm)) return 'INVALID_COMMAND';
  if (command.operacao === 'SOLICITAR' && command.novoHorario && (!Number.isFinite(command.novoHorario.getTime()) || command.novoHorario <= command.ocorridoEm)) return 'INVALID_COMMAND';
  if (command.operacao === 'CORRIGIR' && normalizar(sanitizarJustificativaAgenda(command.justificativa)).length < 10) return 'JUSTIFICATION_REQUIRED';
  return null;
}

export function obterChaveRequisicaoAgenda(command: AgendaCommand): string {
  return hash(['agenda-command-v1', command.tenantId, command.requestIdentity.source, command.requestIdentity.id.trim()]);
}

function fingerprint(command: AgendaCommand): string {
  return hash([
    'agenda-command-fingerprint-v1', command.operacao, command.tenantId, command.leadId, command.atividadeId,
    command.operacao === 'REAGENDAR' || command.operacao === 'PROPOR' ? command.novoHorario.toISOString() : '',
    command.operacao === 'SOLICITAR' && command.novoHorario ? command.novoHorario.toISOString() : '',
    command.operacao === 'REAGENDAR' ? normalizar(command.novoTitulo || '') : '',
    command.operacao === 'REAGENDAR' ? hash(['agenda-description-v1', command.novaDescricao || '']) : '',
    command.operacao === 'NO_SHOW' ? command.parteAusente : '',
    command.operacao === 'SOLICITAR' ? command.manifestacaoLead : '',
    command.operacao === 'SOLICITAR' ? command.responsavelId || '' : '',
    command.operacao === 'SOLICITAR' ? command.tokenConfirmacaoCorretor || '' : '',
    command.operacao === 'CORRIGIR' ? `${command.estadoCorrigido}:${normalizar(command.justificativa)}` : '',
    command.operacao === 'CONFIRMAR_ATRIBUICAO' ? command.responsavelId || '' : '',
    command.operacao === 'REAGENDAR' ? command.responsavelId || '' : '',
    normalizar(command.motivo), command.policyVersion, normalizar(command.ator), normalizar(command.origem),
    String(command.expectedVersion), command.notificacao?.tipo || '',
    command.notificacao ? hash(['agenda-notification-v1', command.notificacao.mensagem]) : '',
    command.notificacoes ? hash(command.notificacoes.map((item) => `${item.tipo}:${item.destinatarioTipo || 'LEAD'}:${item.usuarioDestinoId || ''}:${item.mensagem}`)) : '',
  ]);
}

export function obterNoShowGraceMinutes(): number {
  const parsed = Number(process.env.AGENDA_NO_SHOW_GRACE_MINUTES || 30);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(24 * 60, Math.trunc(parsed))) : 30;
}

async function persistirDecisao(
  tx: Prisma.TransactionClient,
  command: AgendaCommand,
  key: string,
  fp: string,
  result: AgendaCommandResult,
): Promise<AgendaCommandResult> {
  const durableResult: AgendaCommandResult = {
    ...result,
    decisionPersisted: true,
    decisionKey: key,
    decisionOutcome: result.reasonCode,
    decisionExpectedVersion: command.expectedVersion,
  };
  await tx.comandoAgendaLedger.create({ data: {
    chaveRequisicao: key, fingerprint: fp, operacao: command.operacao, tenantId: command.tenantId,
    leadId: command.leadId, atividadeId: command.atividadeId,
    atividadeResultanteId: result.atividadeResultanteId || command.atividadeId,
    correlationId: command.correlationId?.trim() || key,
    outcome: durableResult.reasonCode, resultado: durableResult as unknown as Prisma.InputJsonValue,
  } });
  return durableResult;
}

function resultadoFalha(command: AgendaCommand, reasonCode: AgendaReasonCode): AgendaCommandResult {
  agendaComercialEventos.inc({ resultado: reasonCode.toLowerCase() });
  registrarAgendaLifecycleDecision({ resultado: 'rejeitado', reasonCode });
  return { success: false, reasonCode, atividadeId: command.atividadeId };
}

async function resolverReplay(
  tx: Prisma.TransactionClient,
  key: string,
  fp: string,
  command: AgendaCommand,
): Promise<AgendaCommandResult | null> {
  const replay = await tx.comandoAgendaLedger.findUnique({ where: { chaveRequisicao: key } });
  if (!replay) return null;
  if (replay.fingerprint !== fp) return { success: false, reasonCode: 'REQUEST_ID_CONFLICT', atividadeId: command.atividadeId };
  await tx.comandoAgendaLedger.update({ where: { id: replay.id }, data: { ultimoReplayEm: new Date() } });
  const original = replay.resultado as AgendaCommandResult;
  return { ...original, reasonCode: original.success ? 'COMMAND_REPLAY' : original.reasonCode, replay: true };
}

async function executarNaTransacao(tx: Prisma.TransactionClient, command: AgendaCommand): Promise<AgendaCommandResult> {
  const key = obterChaveRequisicaoAgenda(command);
  const fp = fingerprint(command);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${command.tenantId}:${command.leadId}:agenda-commercial`}, 0))`;
  const workerNoShow = command.operacao === 'NO_SHOW' && command.requestIdentity.source === 'WORKER';
  if (!workerNoShow) {
    const replay = await resolverReplay(tx, key, fp, command);
    if (replay) return replay;
  }

  const atividade = await tx.atividade.findFirst({
    where: { id: command.atividadeId, leadId: command.leadId, lead: { tenantId: command.tenantId } },
    include: { lead: { select: { id: true, status: true, tenantId: true } } },
  });
  if (!atividade) return { success: false, reasonCode: 'TENANT_OWNERSHIP_DENIED', atividadeId: command.atividadeId };
  const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS "now"`;
  const transactionNow = clock.now;
  if (workerNoShow) {
    const lease = command.noShowLease;
    const leaseValido = lease
      && atividade.noShowLeaseOwner === lease.owner
      && atividade.noShowFencingToken === lease.fencingToken
      && atividade.noShowLeaseAte?.getTime() === lease.leaseAte.getTime()
      && atividade.noShowLeaseAte > transactionNow;
    if (!leaseValido) return { success: false, reasonCode: 'NO_SHOW_LEASE_LOST', atividadeId: command.atividadeId };
  }
  if (workerNoShow) {
    const replay = await resolverReplay(tx, key, fp, command);
    if (replay) return replay;
  }
  if (atividade.versao !== command.expectedVersion) return persistirDecisao(tx, command, key, fp, { success: false, reasonCode: 'STALE_EVENT', atividadeId: command.atividadeId });
  if (command.ocorridoEm < atividade.estadoAgendaAtualizadoEm) return persistirDecisao(tx, command, key, fp, { success: false, reasonCode: 'STALE_EVENT', atividadeId: command.atividadeId });
  if (atividade.substituidaPorId && command.operacao !== 'CORRIGIR') {
    return persistirDecisao(tx, command, key, fp, { success: false, reasonCode: 'ACTIVITY_ALREADY_REPLACED', atividadeId: command.atividadeId });
  }
  if (!atividade.agendadoPara || !['AVALIACAO', 'REUNIAO'].includes(atividade.tipo)) {
    return persistirDecisao(tx, command, key, fp, { success: false, reasonCode: 'STATE_TRANSITION_DENIED', atividadeId: command.atividadeId });
  }
  if (['CANCELAR', 'REAGENDAR', 'REALIZAR', 'NO_SHOW', 'CORRIGIR'].includes(command.operacao)) {
    const acaoPolicy = (command.operacao === 'NO_SHOW' ? 'NAO_COMPARECEU' : command.operacao) as AgendaPolicyAction;
    const decisionNow = command.operacao === 'NO_SHOW' ? command.ocorridoEm : transactionNow;
    const policyDecision = avaliarAgendaPolicy({
      status: atividade.statusAgendamento,
      agendadoPara: atividade.agendadoPara,
      duracaoMinutos: atividade.duracao,
      agora: decisionNow,
      ator: resolverAtorPolicy(command),
      acao: acaoPolicy,
    });
    if (!policyDecision.allowed) {
      const reasonCode: AgendaReasonCode = policyDecision.reasonCode === 'APPOINTMENT_STARTED'
        ? 'APPOINTMENT_STARTED'
        : 'STATE_TRANSITION_DENIED';
      return persistirDecisao(tx, command, key, fp, {
        success: false,
        reasonCode,
        atividadeId: command.atividadeId,
      });
    }
  }
  if (command.operacao === 'NO_SHOW') {
    const elegivelEm = new Date(atividade.agendadoPara.getTime() + obterNoShowGraceMinutes() * 60_000);
    if (command.ocorridoEm < elegivelEm) return persistirDecisao(tx, command, key, fp, { success: false, reasonCode: 'NO_SHOW_NOT_DUE', atividadeId: command.atividadeId });
  }
  const statusAtivo = ['PENDENTE', 'SOLICITADO', 'PROPOSTO', 'CONFIRMADO'].includes(atividade.statusAgendamento || '');
  const correcaoTerminal = command.operacao === 'CORRIGIR'
    && ['CANCELADO', 'REALIZADO', 'NAO_COMPARECEU', 'SUBSTITUIDO'].includes(atividade.statusAgendamento || '');
  if ((!statusAtivo && !correcaoTerminal)
    || (statusAtivo && ['CANCELAR', 'REAGENDAR', 'NO_SHOW'].includes(command.operacao) && atividade.lead.status !== 'VISITA_AGENDADA')) {
    const stale = ['AVALIACAO_EM_ANDAMENTO', 'DOCUMENTACAO', 'ONBOARDING', 'CAPTADO'].includes(atividade.lead.status);
    return persistirDecisao(tx, command, key, fp, { success: false, reasonCode: stale ? 'STALE_EVENT' : 'STATE_TRANSITION_DENIED', atividadeId: command.atividadeId });
  }

  const milestoneKey = hash(['agenda-milestone-v1', key, command.operacao]);
  let result: AgendaCommandResult;
  let milestoneType: string;
  let replacementId: string | undefined;

  if (command.operacao === 'REAGENDAR') {
    const substituta = await tx.atividade.create({ data: {
      leadId: atividade.leadId,
      tipo: atividade.tipo,
      canal: atividade.canal,
      titulo: command.novoTitulo?.trim() || `Reagendamento: ${atividade.titulo}`,
      descricao: command.novaDescricao?.trim() || atividade.descricao,
      duracao: atividade.duracao,
      agendadoPara: command.novoHorario,
      criadoPor: command.ator,
      statusAgendamento: 'SOLICITADO',
      tokenConfirmacao: randomUUID(),
      statusConfirmacaoCorretor: atividade.tipo === 'REUNIAO' ? 'PENDENTE' : null,
      tokenConfirmacaoCorretor: atividade.tipo === 'REUNIAO' ? randomUUID() : null,
      corretorOriginalId: command.responsavelId || atividade.corretorOriginalId,
      corretorAtualId: command.responsavelId || atividade.corretorAtualId,
      estadoAgendaAtualizadoEm: command.ocorridoEm,
    } });
    replacementId = substituta.id;
    const encerrada = await tx.atividade.updateMany({
      where: { id: atividade.id, leadId: command.leadId, versao: command.expectedVersion, substituidaPorId: null, statusAgendamento: { in: ['PENDENTE', 'SOLICITADO', 'PROPOSTO', 'CONFIRMADO'] } },
      data: { statusAgendamento: 'SUBSTITUIDO', canceladoPor: command.ator, canceladoEm: command.ocorridoEm,
        motivoCancelamento: command.motivo, substituidaPorId: substituta.id,
        statusConfirmacaoCorretor: atividade.tipo === 'REUNIAO' ? 'REMANEJADO' : atividade.statusConfirmacaoCorretor,
        versao: { increment: 1 }, estadoAgendaAtualizadoEm: command.ocorridoEm },
    });
    if (encerrada.count !== 1) throw new Error('AGENDA_CONCURRENT_WRITE');
    milestoneType = 'VISITA_REAGENDADA';
    result = { success: true, reasonCode: 'RESCHEDULED', atividadeId: atividade.id,
      atividadeResultanteId: substituta.id, leadStatus: 'VISITA_AGENDADA' };
  } else if (command.operacao === 'PROPOR' || command.operacao === 'SOLICITAR') {
    const statusAgendamento = command.operacao === 'PROPOR' ? 'PROPOSTO' : 'SOLICITADO';
    const novoHorario = command.novoHorario;
    const updated = await tx.atividade.updateMany({
      where: { id: atividade.id, leadId: command.leadId, versao: command.expectedVersion,
        statusAgendamento: { in: ['PENDENTE', 'SOLICITADO', 'PROPOSTO'] } },
      data: { statusAgendamento, agendadoPara: novoHorario || atividade.agendadoPara,
        corretorOriginalId: command.operacao === 'SOLICITAR' ? command.responsavelId || atividade.corretorOriginalId : atividade.corretorOriginalId,
        corretorAtualId: command.operacao === 'SOLICITAR' ? command.responsavelId || atividade.corretorAtualId : atividade.corretorAtualId,
        statusConfirmacaoCorretor: command.operacao === 'SOLICITAR' && command.responsavelId ? 'PENDENTE' : atividade.statusConfirmacaoCorretor,
        tokenConfirmacaoCorretor: command.operacao === 'SOLICITAR' && command.responsavelId
          ? command.tokenConfirmacaoCorretor || randomUUID() : atividade.tokenConfirmacaoCorretor,
        // O SLA só começa quando o convite é efetivamente aceito pelo WhatsApp.
        confirmacaoCorretorSolicitadaEm: command.operacao === 'SOLICITAR' && command.responsavelId
          ? null : atividade.confirmacaoCorretorSolicitadaEm,
        lembreteCorretorEnviadoEm: command.operacao === 'SOLICITAR' && command.responsavelId
          ? null : atividade.lembreteCorretorEnviadoEm,
        remanejadoCorretorEm: command.operacao === 'SOLICITAR' && command.responsavelId ? command.ocorridoEm : atividade.remanejadoCorretorEm,
        versao: { increment: 1 }, estadoAgendaAtualizadoEm: command.ocorridoEm },
    });
    if (updated.count !== 1) throw new Error('AGENDA_CONCURRENT_WRITE');
    milestoneType = command.operacao === 'PROPOR' ? 'HORARIO_PROPOSTO'
      : command.responsavelId ? 'ATRIBUICAO_SOLICITADA' : command.manifestacaoLead;
    result = { success: true, reasonCode: command.operacao === 'PROPOR' ? 'PROPOSED' : 'REQUESTED',
      atividadeId: atividade.id, atividadeResultanteId: atividade.id, leadStatus: atividade.lead.status };
  } else if (command.operacao === 'CONFIRMAR_ATRIBUICAO') {
    const responsavelId = command.responsavelId || atividade.corretorAtualId;
    if (!responsavelId) {
      return persistirDecisao(tx, command, key, fp, { success: false, reasonCode: 'SPECIALIST_REQUIRED', atividadeId: atividade.id });
    }
    const responsavel = await tx.usuario.findFirst({ where: { id: responsavelId, tenantId: command.tenantId }, select: { id: true } });
    if (!responsavel) return persistirDecisao(tx, command, key, fp, { success: false, reasonCode: 'SPECIALIST_REQUIRED', atividadeId: atividade.id });
    const updated = await tx.atividade.updateMany({
      where: { id: atividade.id, leadId: command.leadId, versao: command.expectedVersion,
        statusAgendamento: { in: ['PENDENTE', 'SOLICITADO', 'PROPOSTO'] } },
      data: { statusAgendamento: 'CONFIRMADO', statusConfirmacaoCorretor: 'CONFIRMADO',
        corretorAtualId: responsavelId, confirmadoPor: command.ator, confirmadoEm: command.ocorridoEm,
        confirmadoCorretorEm: command.ocorridoEm, versao: { increment: 1 }, estadoAgendaAtualizadoEm: command.ocorridoEm },
    });
    if (updated.count !== 1) throw new Error('AGENDA_CONCURRENT_WRITE');
    milestoneType = 'ATRIBUICAO_CONFIRMADA';
    result = { success: true, reasonCode: 'ASSIGNMENT_CONFIRMED', atividadeId: atividade.id,
      atividadeResultanteId: atividade.id, leadStatus: atividade.lead.status };
  } else if (command.operacao === 'RECUSAR') {
    const updated = await tx.atividade.updateMany({
      where: { id: atividade.id, leadId: command.leadId, versao: command.expectedVersion,
        statusAgendamento: { in: ['PENDENTE', 'SOLICITADO', 'PROPOSTO'] } },
      data: { statusConfirmacaoCorretor: 'RECUSADO', motivoCancelamento: command.motivo,
        versao: { increment: 1 }, estadoAgendaAtualizadoEm: command.ocorridoEm },
    });
    if (updated.count !== 1) throw new Error('AGENDA_CONCURRENT_WRITE');
    milestoneType = 'ATRIBUICAO_RECUSADA';
    result = { success: true, reasonCode: 'ASSIGNMENT_DECLINED', atividadeId: atividade.id,
      atividadeResultanteId: atividade.id, leadStatus: atividade.lead.status };
  } else {
    const statusAgenda = command.operacao === 'CANCELAR' ? 'CANCELADO'
      : command.operacao === 'REALIZAR' ? 'REALIZADO'
        : command.operacao === 'CORRIGIR' ? command.estadoCorrigido : 'NAO_COMPARECEU';
    const noShowFence = command.operacao === 'NO_SHOW' && command.requestIdentity.source === 'WORKER'
      ? {
          noShowLeaseOwner: command.noShowLease!.owner,
          noShowFencingToken: command.noShowLease!.fencingToken,
          noShowLeaseAte: { gt: transactionNow! },
        }
      : {};
    const updated = await tx.atividade.updateMany({
      where: { id: atividade.id, leadId: command.leadId, versao: command.expectedVersion, substituidaPorId: null,
        statusAgendamento: command.operacao === 'CORRIGIR'
          ? { in: ['CANCELADO', 'REALIZADO', 'NAO_COMPARECEU', 'SUBSTITUIDO'] }
          : { in: ['PENDENTE', 'SOLICITADO', 'PROPOSTO', 'CONFIRMADO'] }, ...noShowFence },
      data: { statusAgendamento: statusAgenda, canceladoPor: command.operacao === 'CANCELAR' ? command.ator : atividade.canceladoPor,
        canceladoEm: command.operacao === 'CANCELAR' ? command.ocorridoEm : atividade.canceladoEm,
        motivoCancelamento: command.operacao === 'CANCELAR' ? command.motivo : atividade.motivoCancelamento,
        statusConfirmacaoCorretor: command.operacao === 'CANCELAR' && atividade.tipo === 'REUNIAO'
          ? 'RECUSADO'
          : atividade.statusConfirmacaoCorretor,
        completadoEm: ['NO_SHOW', 'REALIZAR', 'CORRIGIR'].includes(command.operacao) ? command.ocorridoEm : atividade.completadoEm,
        versao: { increment: 1 }, estadoAgendaAtualizadoEm: command.ocorridoEm },
    });
    if (updated.count !== 1) {
      if (command.operacao === 'NO_SHOW' && command.requestIdentity.source === 'WORKER') {
        return { success: false, reasonCode: 'NO_SHOW_LEASE_LOST', atividadeId: command.atividadeId };
      }
      throw new Error('AGENDA_CONCURRENT_WRITE');
    }
    let leadStatus = atividade.lead.status;
    if (command.operacao === 'CANCELAR' || command.operacao === 'NO_SHOW') {
      const lead = await tx.lead.updateMany({ where: { id: command.leadId, tenantId: command.tenantId, status: 'VISITA_AGENDADA' }, data: { status: 'TENTATIVA_AGENDAMENTO' } });
      if (lead.count !== 1) throw new Error('LEAD_CONCURRENT_WRITE');
      leadStatus = 'TENTATIVA_AGENDAMENTO';
    }
    milestoneType = command.operacao === 'CANCELAR' ? 'VISITA_CANCELADA'
      : command.operacao === 'NO_SHOW' ? 'VISITA_NAO_COMPARECEU'
        : command.operacao === 'REALIZAR' ? 'VISITA_REALIZADA' : 'CORRECAO_ADMINISTRATIVA';
    const reasonCode = command.operacao === 'CANCELAR' ? 'CANCELLED'
      : command.operacao === 'NO_SHOW' ? 'NO_SHOW_RECORDED'
        : command.operacao === 'REALIZAR' ? 'COMPLETED' : 'CORRECTED';
    result = { success: true, reasonCode, atividadeId: atividade.id,
      atividadeResultanteId: atividade.id, leadStatus };
  }

  await tx.milestoneAgenda.create({ data: {
    tenantId: command.tenantId, leadId: command.leadId, atividadeId: command.atividadeId,
    atividadeSubstitutaId: replacementId, tipo: milestoneType, ator: command.ator,
    origem: command.origem, motivo: command.operacao === 'CORRIGIR' ? sanitizarJustificativaAgenda(command.justificativa) : command.motivo, reasonCode: result.reasonCode,
    parteAusente: command.operacao === 'NO_SHOW' ? command.parteAusente : null,
    ocorridoEm: command.ocorridoEm, chaveIdempotencia: milestoneKey,
  } });
  result = await persistirDecisao(tx, command, key, fp, result);
  const notifications = [...(command.notificacao ? [command.notificacao] : []), ...(command.notificacoes || [])];
  if (notifications.length > 0) {
    await tx.efeitoAgendaOutbox.createMany({ data: notifications.map((notification, index) => ({
      chaveComando: key,
      chaveIdempotencia: hash(['agenda-effect-v1', key, notification.tipo, notification.destinatarioTipo || 'LEAD', notification.usuarioDestinoId || '', String(index)]),
      tenantId: command.tenantId,
      leadId: command.leadId,
      atividadeId: result.atividadeResultanteId || command.atividadeId,
      tipo: notification.tipo,
      mensagem: notification.mensagem,
      destinatarioTipo: notification.destinatarioTipo || 'LEAD',
      usuarioDestinoId: notification.usuarioDestinoId,
      correlationId: command.correlationId?.trim() || key,
    })) });
  }
  return result;
}

export async function executarComandoAgenda(command: AgendaCommand): Promise<AgendaCommandResult> {
  const invalid = validarComandoAgenda(command);
  if (invalid) return resultadoFalha(command, invalid);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await prisma.$transaction((tx) => executarNaTransacao(tx as unknown as Prisma.TransactionClient, command), { isolationLevel: 'Serializable' });
      agendaComercialEventos.inc({ resultado: result.reasonCode.toLowerCase() });
      registrarAgendaLifecycleDecision({
        resultado: result.replay
          ? 'replay'
          : ['STALE_EVENT', 'REQUEST_ID_CONFLICT'].includes(result.reasonCode)
            ? 'conflito'
            : result.success ? 'aceito' : 'rejeitado',
        reasonCode: result.reasonCode,
      });
      return result;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (['P2002', 'P2034'].includes(code || '') && attempt < 3) continue;
      agendaComercialEventos.inc({ resultado: command.operacao === 'REAGENDAR' ? 'agenda_replacement_failed' : 'rollback' });
      return { success: false, reasonCode: 'COMMAND_TRANSIENT_FAILURE', atividadeId: command.atividadeId, transient: true };
    }
  }
  return { success: false, reasonCode: 'COMMAND_TRANSIENT_FAILURE', atividadeId: command.atividadeId, transient: true };
}
