import { interpretarFollowupTemporal } from '../followup-temporal';

describe('policy temporal de follow-up', () => {
  const now = new Date('2026-07-15T12:00:00Z');
  it('resolve data relativa apenas com timezone IANA confiavel', () => {
    expect(interpretarFollowupTemporal({ expressao: 'amanha 09:30', timezone: 'America/Sao_Paulo', agora: now })).toMatchObject({ ok: true, local: '2026-07-16T09:30' });
    expect(interpretarFollowupTemporal({ expressao: 'amanha 09:30', timezone: 'UTC-3', agora: now })).toEqual({ ok: false, reasonCode: 'TIMEZONE_INVALID' });
  });
  it.each(['me chama depois', 'fala comigo semana que vem', 'amanha'])('exige esclarecimento para %s', (expressao) => {
    expect(interpretarFollowupTemporal({ expressao, timezone: 'America/Sao_Paulo', agora: now })).toEqual({ ok: false, reasonCode: 'DATE_AMBIGUOUS' });
  });
  it('recusa passado e horario fora da policy', () => {
    expect(interpretarFollowupTemporal({ expressao: '2026-07-14 09:00', timezone: 'America/Sao_Paulo', agora: now })).toEqual({ ok: false, reasonCode: 'DATE_PAST' });
    expect(interpretarFollowupTemporal({ expressao: '2026-07-16 23:00', timezone: 'America/Sao_Paulo', agora: now })).toEqual({ ok: false, reasonCode: 'OUTSIDE_ALLOWED_HOURS' });
  });
  it('recusa horario inexistente ou duplicado em DST', () => {
    expect(interpretarFollowupTemporal({ expressao: '2026-03-08 02:30', timezone: 'America/New_York', agora: new Date('2026-01-01T00:00:00Z') }).ok).toBe(false);
    expect(interpretarFollowupTemporal({ expressao: '2026-11-01 01:30', timezone: 'America/New_York', agora: new Date('2026-01-01T00:00:00Z') })).toEqual({ ok: false, reasonCode: 'DATE_AMBIGUOUS' });
  });
});
