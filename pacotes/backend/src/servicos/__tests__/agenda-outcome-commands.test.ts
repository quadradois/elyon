import { avaliarAgendaPolicy } from '../agenda-policy';

describe('comandos de desfecho', () => {
  const base = {
    status: 'CONFIRMADO',
    agendadoPara: new Date('2026-08-01T10:00:00Z'),
    duracaoMinutos: 60,
    agora: new Date('2026-08-01T11:00:00Z'),
    ator: 'OPERADOR' as const,
  };

  it.each(['REALIZAR', 'NAO_COMPARECEU'] as const)('permite %s após o início', (acao) => {
    expect(avaliarAgendaPolicy({ ...base, acao })).toMatchObject({ allowed: true, faseTemporal: 'ENCERRADO' });
  });

  it.each(['REALIZADO', 'NAO_COMPARECEU'] as const)('mantém %s terminal para comandos comuns', (status) => {
    expect(avaliarAgendaPolicy({ ...base, status, acao: 'REALIZAR' })).toMatchObject({
      allowed: false,
      reasonCode: 'APPOINTMENT_TERMINAL',
    });
  });
});
