export type AgendaCommandName = 'SOLICITAR' | 'PROPOR' | 'ACEITAR' | 'RECUSAR' | 'CONFIRMAR_ATRIBUICAO'
  | 'CANCELAR' | 'REAGENDAR' | 'REALIZAR' | 'NAO_COMPARECEU' | 'CORRIGIR';

export type AgendaActorKind = 'ADMIN' | 'OPERADOR' | 'AGENTE' | 'SISTEMA' | 'PUBLICO';
export type AgendaCommandChannel = 'WHATSAPP' | 'PAINEL' | 'LINK_PUBLICO' | 'JOB' | 'INTEGRACAO';
export type AgendaCommandRejectionCode = 'ACTION_NOT_ALLOWED' | 'APPOINTMENT_STARTED' | 'APPOINTMENT_TERMINAL'
  | 'VERSION_CONFLICT' | 'TENANT_MISMATCH' | 'JUSTIFICATION_REQUIRED';

export interface AgendaCommandEnvelope {
  command: AgendaCommandName;
  tenantId: string;
  appointmentId: string;
  actor: { kind: AgendaActorKind; id: string };
  channel: AgendaCommandChannel;
  reasonCode: string;
  idempotencyKey: string;
  expectedVersion: number;
  correlationId: string;
  occurredAt: Date;
}
