export type AgendaCanonicalState = 'PROPOSTO' | 'SOLICITADO' | 'CONFIRMADO' | 'CANCELADO'
  | 'REALIZADO' | 'NAO_COMPARECEU' | 'SUBSTITUIDO';
export type AgendaPersistedState = AgendaCanonicalState | 'PENDENTE';

const CANONICAL_STATES = new Set<AgendaCanonicalState>([
  'PROPOSTO', 'SOLICITADO', 'CONFIRMADO', 'CANCELADO', 'REALIZADO', 'NAO_COMPARECEU', 'SUBSTITUIDO',
]);

export function paraEstadoCanonico(state: string | null | undefined): AgendaCanonicalState {
  if (state === 'PENDENTE') return 'SOLICITADO';
  if (CANONICAL_STATES.has(state as AgendaCanonicalState)) return state as AgendaCanonicalState;
  throw new Error('AGENDA_STATE_UNKNOWN');
}

export function paraEstadoPersistido(state: AgendaCanonicalState, options: { escritorLegado: boolean }): AgendaPersistedState {
  if (state === 'SOLICITADO' && options.escritorLegado) return 'PENDENTE';
  return state;
}
