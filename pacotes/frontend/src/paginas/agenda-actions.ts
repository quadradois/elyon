import type { AgendaCommandName, EventoAgenda } from '../servicos/apiAgenda';

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
