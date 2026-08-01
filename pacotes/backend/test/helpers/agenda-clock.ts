export const AGENDA_TEST_TIMEZONE = 'America/Sao_Paulo';

export interface AgendaTestClock {
  now(): Date;
  set(instant: Date | string): void;
  advance(milliseconds: number): void;
}

export function createAgendaTestClock(initial: Date | string): AgendaTestClock {
  let current = toValidDate(initial);

  return {
    now: () => new Date(current.getTime()),
    set: (instant) => {
      current = toValidDate(instant);
    },
    advance: (milliseconds) => {
      if (!Number.isFinite(milliseconds)) throw new Error('AGENDA_TEST_CLOCK_INVALID_ADVANCE');
      current = new Date(current.getTime() + milliseconds);
    },
  };
}

function toValidDate(value: Date | string): Date {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('AGENDA_TEST_CLOCK_INVALID_INSTANT');
  return parsed;
}
