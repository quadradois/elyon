import type { EventoAgenda } from '../servicos/apiAgenda';

export function acaoAgendaPermitida(
  evento: EventoAgenda | null,
  acao: 'CANCELAR' | 'REAGENDAR' | 'REALIZAR' | 'NAO_COMPARECEU' | 'CORRIGIR',
): boolean {
  return evento?.extendedProps?.allowedActions?.includes(acao) === true;
}

export function ordenarPendenciasVencidas<T extends { pendingAgeMinutes: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.pendingAgeMinutes - a.pendingAgeMinutes);
}
