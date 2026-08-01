import type { EventoAgenda } from '../servicos/apiAgenda';

export function acaoAgendaPermitida(
  evento: EventoAgenda | null,
  acao: 'CANCELAR' | 'REAGENDAR' | 'REALIZAR' | 'NAO_COMPARECEU' | 'CORRIGIR',
): boolean {
  return evento?.extendedProps?.allowedActions?.includes(acao) === true;
}
