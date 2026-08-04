import {
  extrairHorarioProposto,
  extrairPeriodoConsulta,
  interpretarIntencaoEspecialista,
} from '../specialist-copilot-intent';

describe('specialist copilot deterministic intent', () => {
  const agora = new Date('2026-08-03T18:00:00.000Z'); // 15:00 em Goiânia

  it.each(['sim', 'Confirmo', 'pode confirmar', 'vou atender'])(
    'reconhece confirmação simples: %s',
    (texto) => expect(interpretarIntencaoEspecialista(texto, agora).name).toBe('CONFIRMAR'),
  );

  it.each(['não consigo', 'não posso', 'estou indisponível', 'recuso'])(
    'reconhece recusa simples: %s',
    (texto) => expect(interpretarIntencaoEspecialista(texto, agora).name).toBe('RECUSAR'),
  );

  it('extrai contraproposta explícita na timezone de Goiânia', () => {
    const intent = interpretarIntencaoEspecialista('Posso dia 04/08/2026 às 10:30', agora);
    expect(intent.name).toBe('CONTRAPROPOR');
    expect(intent.horarioProposto?.toISOString()).toBe('2026-08-04T13:30:00.000Z');
  });

  it('não confunde o dia da data com a hora', () => {
    expect(extrairHorarioProposto('Posso dia 04/08/2026', agora)).toBeUndefined();
  });

  it('recusa horário passado', () => {
    expect(extrairHorarioProposto('Posso hoje às 10h', agora)).toBeUndefined();
  });

  it('restringe consulta de amanhã ao dia local de Goiânia', () => {
    const intent = interpretarIntencaoEspecialista('Quais atendimentos tenho amanhã?', agora);
    expect(intent).toMatchObject({
      name: 'CONSULTAR',
      periodoConsulta: {
        descricao: 'amanha',
        dataLocal: '2026-08-04',
      },
    });
    expect(intent.periodoConsulta?.inicio.toISOString()).toBe('2026-08-04T03:00:00.000Z');
    expect(intent.periodoConsulta?.fim.toISOString()).toBe('2026-08-05T02:59:59.999Z');
  });

  it('resolve amanhã corretamente perto da meia-noite local', () => {
    const pertoDaMeiaNoite = new Date('2026-08-04T02:30:00.000Z'); // 03/08 23:30 em Goiânia
    const periodo = extrairPeriodoConsulta('Minha agenda amanhã', pertoDaMeiaNoite);
    expect(periodo?.dataLocal).toBe('2026-08-04');
    expect(periodo?.inicio.toISOString()).toBe('2026-08-04T03:00:00.000Z');
  });

  it('suporta hoje, data explícita e próximos sete dias', () => {
    expect(extrairPeriodoConsulta('atendimentos hoje', agora)).toMatchObject({ descricao: 'hoje', dataLocal: '2026-08-03' });
    expect(extrairPeriodoConsulta('agenda do dia 05/08/2026', agora)).toMatchObject({ descricao: 'data_explicita', dataLocal: '2026-08-05' });
    expect(extrairPeriodoConsulta('agenda dos próximos 7 dias', agora)).toMatchObject({ descricao: 'proximos_sete_dias' });
  });

  it('mantém a janela padrão quando a consulta não informa período', () => {
    expect(interpretarIntencaoEspecialista('Quais são meus atendimentos?', agora)).toMatchObject({
      name: 'CONSULTAR',
      periodoConsulta: undefined,
    });
  });
});
