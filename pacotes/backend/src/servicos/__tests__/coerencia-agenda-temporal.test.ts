import { createAgendaTestClock } from '../../../test/helpers/agenda-clock';
import { avaliarAgendaPolicy } from '../agenda-policy';

describe('coerencia temporal dos comandos de Agenda', () => {
  const scheduled = new Date('2026-08-03T11:01:00.000Z');
  const decision = (now: string, acao: 'CANCELAR' | 'REAGENDAR') => avaliarAgendaPolicy({
    status: 'CONFIRMADO', agendadoPara: scheduled, duracaoMinutos: 60,
    agora: createAgendaTestClock(now).now(), ator: 'OPERADOR', acao,
  });

  it.each(['CANCELAR', 'REAGENDAR'] as const)('permite %s antes do inicio', (acao) => {
    expect(decision('2026-08-03T11:00:59.999Z', acao)).toMatchObject({ allowed: true, faseTemporal: 'FUTURO' });
  });
  it.each(['CANCELAR', 'REAGENDAR'] as const)('rejeita %s no instante exato', (acao) => {
    expect(decision('2026-08-03T11:01:00.000Z', acao)).toMatchObject({ allowed: false, reasonCode: 'APPOINTMENT_STARTED', faseTemporal: 'INICIADO' });
  });
  it.each(['CANCELAR', 'REAGENDAR'] as const)('rejeita %s depois do encerramento', (acao) => {
    expect(decision('2026-08-03T12:01:00.000Z', acao)).toMatchObject({ allowed: false, reasonCode: 'APPOINTMENT_STARTED', faseTemporal: 'ENCERRADO' });
  });
});
