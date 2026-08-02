import type { AgendaActorKind } from './agenda-command-types';

export type AgendaTemporalPhase = 'FUTURO' | 'INICIADO' | 'ENCERRADO';

export type AgendaPolicyAction =
  | 'SOLICITAR'
  | 'PROPOR'
  | 'ACEITAR'
  | 'RECUSAR'
  | 'CONFIRMAR_ATRIBUICAO'
  | 'CANCELAR'
  | 'REAGENDAR'
  | 'REALIZAR'
  | 'NAO_COMPARECEU'
  | 'CORRIGIR';

export type AgendaPolicyActor = AgendaActorKind;

export type AgendaPolicyReasonCode =
  | 'ALLOWED'
  | 'APPOINTMENT_INVALID'
  | 'APPOINTMENT_STARTED'
  | 'APPOINTMENT_TERMINAL'
  | 'ACTOR_NOT_ALLOWED'
  | 'ACTION_NOT_ALLOWED';

export interface AgendaPolicyInput {
  status: string | null | undefined;
  agendadoPara: Date | null | undefined;
  duracaoMinutos?: number | null;
  agora: Date;
  ator: AgendaPolicyActor;
}

export interface AgendaPolicyView {
  faseTemporal: AgendaTemporalPhase | null;
  allowedActions: AgendaPolicyAction[];
  reasonCode: AgendaPolicyReasonCode;
}

export interface AgendaPolicyDecision extends AgendaPolicyView {
  allowed: boolean;
  action: AgendaPolicyAction;
}

const ACTIVE_STATUSES = new Set(['PENDENTE', 'CONFIRMADO', 'PROPOSTO', 'SOLICITADO']);
const TERMINAL_STATUSES = new Set(['CANCELADO', 'REALIZADO', 'NAO_COMPARECEU', 'SUBSTITUIDO']);
const DEFAULT_DURATION_MINUTES = 60;

export function obterAgendaPolicy(input: AgendaPolicyInput): AgendaPolicyView {
  const faseTemporal = calcularFaseTemporal(input);
  if (!faseTemporal) return { faseTemporal: null, allowedActions: [], reasonCode: 'APPOINTMENT_INVALID' };

  const status = input.status || '';
  if (TERMINAL_STATUSES.has(status)) {
    return {
      faseTemporal,
      allowedActions: input.ator === 'ADMIN' ? ['CORRIGIR'] : [],
      reasonCode: 'APPOINTMENT_TERMINAL',
    };
  }
  if (!ACTIVE_STATUSES.has(status)) {
    return { faseTemporal, allowedActions: [], reasonCode: 'ACTION_NOT_ALLOWED' };
  }

  if (faseTemporal === 'FUTURO') {
    if (input.ator === 'PUBLICO') {
      const allowedActions: AgendaPolicyAction[] = ['CANCELAR'];
      if (['PENDENTE', 'PROPOSTO'].includes(status)) allowedActions.unshift('ACEITAR');
      return { faseTemporal, allowedActions, reasonCode: 'ALLOWED' };
    }
    if (input.ator === 'SISTEMA') return { faseTemporal, allowedActions: [], reasonCode: 'ACTOR_NOT_ALLOWED' };
    const allowedActions: AgendaPolicyAction[] = ['CANCELAR', 'REAGENDAR'];
    if (['PENDENTE', 'PROPOSTO'].includes(status)) allowedActions.push('PROPOR');
    if (['PENDENTE', 'SOLICITADO', 'PROPOSTO'].includes(status)) allowedActions.push('CONFIRMAR_ATRIBUICAO', 'RECUSAR');
    return { faseTemporal, allowedActions, reasonCode: 'ALLOWED' };
  }

  if (input.ator === 'PUBLICO') return { faseTemporal, allowedActions: [], reasonCode: 'APPOINTMENT_STARTED' };
  if (input.ator === 'SISTEMA') {
    return { faseTemporal, allowedActions: ['NAO_COMPARECEU'], reasonCode: 'ALLOWED' };
  }
  const allowedActions: AgendaPolicyAction[] = ['REALIZAR', 'NAO_COMPARECEU'];
  return { faseTemporal, allowedActions, reasonCode: 'ALLOWED' };
}

export function avaliarAgendaPolicy(
  input: AgendaPolicyInput & { acao: AgendaPolicyAction },
): AgendaPolicyDecision {
  const view = obterAgendaPolicy(input);
  if (view.allowedActions.includes(input.acao)) return { ...view, allowed: true, action: input.acao, reasonCode: 'ALLOWED' };

  let reasonCode = view.reasonCode;
  if ((input.acao === 'CANCELAR' || input.acao === 'REAGENDAR') && view.faseTemporal !== 'FUTURO') {
    reasonCode = 'APPOINTMENT_STARTED';
  } else if (TERMINAL_STATUSES.has(input.status || '')) {
    reasonCode = 'APPOINTMENT_TERMINAL';
  } else if (reasonCode === 'ALLOWED') {
    reasonCode = 'ACTION_NOT_ALLOWED';
  }
  return { ...view, allowed: false, action: input.acao, reasonCode };
}

function calcularFaseTemporal(input: AgendaPolicyInput): AgendaTemporalPhase | null {
  if (!isValidDate(input.agora) || !isValidDate(input.agendadoPara)) return null;
  const duration = Number.isFinite(input.duracaoMinutos) && Number(input.duracaoMinutos) > 0
    ? Math.trunc(Number(input.duracaoMinutos))
    : DEFAULT_DURATION_MINUTES;
  const start = input.agendadoPara.getTime();
  const now = input.agora.getTime();
  if (now < start) return 'FUTURO';
  if (now < start + duration * 60_000) return 'INICIADO';
  return 'ENCERRADO';
}

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}
