import { createAgendaTestClock } from '../../../test/helpers/agenda-clock';
import { avaliarAgendaPolicy, obterAgendaPolicy } from '../agenda-policy';

const inicio = new Date('2026-08-03T11:01:00.000Z');

describe('AgendaPolicy', () => {
  const base = {
    status: 'CONFIRMADO',
    agendadoPara: inicio,
    duracaoMinutos: 60,
    ator: 'OPERADOR' as const,
  };

  it.each([
    ['um milissegundo antes', '2026-08-03T11:00:59.999Z', 'FUTURO'],
    ['no instante exato', '2026-08-03T11:01:00.000Z', 'INICIADO'],
    ['durante', '2026-08-03T11:30:00.000Z', 'INICIADO'],
    ['no instante final', '2026-08-03T12:01:00.000Z', 'ENCERRADO'],
  ])('classifica %s como %s', (_label, now, expected) => {
    const clock = createAgendaTestClock(now);
    expect(obterAgendaPolicy({ ...base, agora: clock.now() }).faseTemporal).toBe(expected);
  });

  it('permite cancelar e reagendar somente enquanto futuro', () => {
    const policy = obterAgendaPolicy({ ...base, agora: new Date('2026-08-03T11:00:59.999Z') });
    expect(policy.allowedActions).toEqual(expect.arrayContaining(['CANCELAR', 'REAGENDAR']));
  });

  it.each(['INICIADO', 'ENCERRADO'] as const)(
    'remove cancelar e reagendar quando o compromisso esta %s',
    (phase) => {
      const agora = phase === 'INICIADO'
        ? new Date('2026-08-03T11:01:00.000Z')
        : new Date('2026-08-03T12:01:00.000Z');
      const policy = obterAgendaPolicy({ ...base, agora });
      expect(policy.allowedActions).not.toContain('CANCELAR');
      expect(policy.allowedActions).not.toContain('REAGENDAR');
      expect(policy.allowedActions).toEqual(expect.arrayContaining(['REALIZAR', 'NAO_COMPARECEU']));
    },
  );

  it('retorna APPOINTMENT_STARTED para cancelamento no instante exato', () => {
    expect(avaliarAgendaPolicy({ ...base, agora: inicio, acao: 'CANCELAR' })).toMatchObject({
      allowed: false,
      reasonCode: 'APPOINTMENT_STARTED',
      faseTemporal: 'INICIADO',
    });
  });

  it('nao oferece mutacao normal em estado terminal', () => {
    const policy = obterAgendaPolicy({ ...base, status: 'CANCELADO', agora: new Date('2026-08-03T10:00:00Z') });
    expect(policy.allowedActions).toEqual([]);
  });

  it('oferece correcao de estado terminal apenas ao administrador', () => {
    expect(obterAgendaPolicy({ ...base, status: 'REALIZADO', ator: 'ADMIN', agora: inicio }).allowedActions)
      .toEqual(['CORRIGIR']);
    expect(obterAgendaPolicy({ ...base, status: 'REALIZADO', ator: 'OPERADOR', agora: inicio }).allowedActions)
      .toEqual([]);
  });

  it('limita o link publico ao cancelamento futuro', () => {
    const policy = obterAgendaPolicy({
      ...base,
      ator: 'PUBLICO',
      agora: new Date('2026-08-03T10:00:00Z'),
    });
    expect(policy.allowedActions).toEqual(['CANCELAR']);
  });

  it('permite ao Lead aceitar uma proposta futura sem segundo aceite', () => {
    const policy = obterAgendaPolicy({
      ...base, status: 'PROPOSTO', ator: 'PUBLICO', agora: new Date('2026-08-03T10:00:00Z'),
    });
    expect(policy.allowedActions).toEqual(['ACEITAR', 'CANCELAR']);
  });

  it('recusa data ausente ou invalida de forma fechada', () => {
    expect(obterAgendaPolicy({ ...base, agendadoPara: null, agora: inicio })).toMatchObject({
      allowedActions: [],
      reasonCode: 'APPOINTMENT_INVALID',
    });
  });
});
