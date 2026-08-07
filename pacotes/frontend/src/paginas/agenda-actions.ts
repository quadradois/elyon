import type { AgendaCommandName, EventoAgenda } from '../servicos/apiAgenda';

export type EstadoDrawerAgenda = 'FUTURO' | 'VENCIDO_SEM_DESFECHO' | 'CONCLUIDO' | 'CANCELADO' | 'LEITURA';

const STATUS_CONCLUIDOS = new Set(['REALIZADO', 'NAO_COMPARECEU']);

export function obterEstadoDrawerAgenda(evento: EventoAgenda | null): EstadoDrawerAgenda {
  const status = evento?.extendedProps?.status;
  if (status === 'CANCELADO') return 'CANCELADO';
  if (status && STATUS_CONCLUIDOS.has(status)) return 'CONCLUIDO';
  if (acaoAgendaPermitida(evento, 'REALIZAR') || acaoAgendaPermitida(evento, 'NAO_COMPARECEU')) {
    return 'VENCIDO_SEM_DESFECHO';
  }
  if (evento?.extendedProps?.faseTemporal === 'FUTURO'
    || acaoAgendaPermitida(evento, 'CANCELAR')
    || acaoAgendaPermitida(evento, 'REAGENDAR')
    || acaoAgendaPermitida(evento, 'RECUSAR')) {
    return 'FUTURO';
  }
  return 'LEITURA';
}

export function descricaoEstadoDrawerAgenda(estado: EstadoDrawerAgenda): string {
  switch (estado) {
    case 'FUTURO': return 'Gerencie este compromisso e, se necessário, comunique uma alteração ao lead.';
    case 'VENCIDO_SEM_DESFECHO': return 'O horário já passou. Registre o resultado do atendimento para concluir a pendência.';
    case 'CONCLUIDO': return 'Confira o resultado registrado e corrija o desfecho somente se houver divergência.';
    case 'CANCELADO': return 'Este compromisso foi cancelado. Consulte abaixo os dados registrados.';
    default: return 'Consulte os dados deste compromisso.';
  }
}

export function rotuloStatusAgenda(status?: string): string {
  const rotulos: Record<string, string> = {
    PENDENTE: 'Aguardando',
    SOLICITADO: 'Solicitado',
    PROPOSTO: 'Horário proposto',
    CONFIRMADO: 'Confirmado',
    REALIZADO: 'Realizado',
    NAO_COMPARECEU: 'Não compareceu',
    CANCELADO: 'Cancelado',
  };
  return status ? rotulos[status] || status.replaceAll('_', ' ').toLocaleLowerCase('pt-BR') : 'Não informado';
}

export function corEventoPorStatus(evento: EventoAgenda): string {
  const status = evento.extendedProps?.status;
  if (status === 'NAO_COMPARECEU') return '#be123c';
  if (status === 'REALIZADO') return '#475569';
  if (status === 'CANCELADO') return '#dc2626';
  if (status === 'CONFIRMADO') return '#16a34a';
  if (['PENDENTE', 'SOLICITADO', 'PROPOSTO'].includes(status || '')) return '#d97706';
  return evento.backgroundColor || '#3174ad';
}

export function acaoAgendaPermitida(
  evento: EventoAgenda | null,
  acao: AgendaCommandName,
): boolean {
  return evento?.extendedProps?.allowedActions?.includes(acao) === true;
}

export function ordenarPendenciasVencidas<T extends { pendingAgeMinutes: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.pendingAgeMinutes - a.pendingAgeMinutes);
}

export function pendenciaPermiteAcao(
  pendencia: { allowedActions: AgendaCommandName[] },
  acao: 'REALIZAR' | 'NAO_COMPARECEU',
): boolean {
  return pendencia.allowedActions.includes(acao);
}
