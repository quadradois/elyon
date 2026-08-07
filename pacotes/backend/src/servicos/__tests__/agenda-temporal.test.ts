import { interpretarAgendamentoTemporal, mensagemContemDataHoraExplicita } from '../agenda-temporal';

describe('interpretarAgendamentoTemporal', () => {
  const agora = new Date('2026-07-31T22:01:48.000Z'); // 31/07 19:01 em São Paulo

  it('faz a mensagem inbound prevalecer sobre uma data inventada pelo modelo', () => {
    const result = interpretarAgendamentoTemporal({
      mensagemAtual: 'Pode ser amanhã as 14:00!',
      dataHoraArgumento: '07/08/2026 14:00',
      timezone: 'America/Sao_Paulo',
      agora,
    });

    expect(result).toMatchObject({
      ok: true,
      dataHoraLocal: '01/08/2026 14:00',
      origem: 'MENSAGEM',
    });
    if (result.ok) expect(result.utc.toISOString()).toBe('2026-08-01T17:00:00.000Z');
  });

  it('aceita data absoluta do argumento quando a mensagem não contém expressão temporal', () => {
    expect(interpretarAgendamentoTemporal({
      mensagemAtual: 'Esse horário está ótimo',
      dataHoraArgumento: '03/08/2026 10:30',
      agora,
    })).toMatchObject({ ok: true, dataHoraLocal: '03/08/2026 10:30', origem: 'ARGUMENTO' });
  });

  it('rejeita mensagem temporal ambígua em vez de confiar na data do modelo', () => {
    expect(interpretarAgendamentoTemporal({
      mensagemAtual: 'Pode ser amanhã',
      dataHoraArgumento: '07/08/2026 14:00',
      agora,
    })).toEqual({ ok: false, reasonCode: 'DATE_AMBIGUOUS' });
  });

  it('detecta data e hora explícitas para impedir fallback por link', () => {
    expect(mensagemContemDataHoraExplicita('Pode ser dia 03/08 às 08:00')).toBe(true);
    expect(mensagemContemDataHoraExplicita('Amanhã 14h')).toBe(true);
    expect(mensagemContemDataHoraExplicita('Preciso ver minha agenda')).toBe(false);
    expect(mensagemContemDataHoraExplicita('Pode ser amanhã')).toBe(false);
  });
});
