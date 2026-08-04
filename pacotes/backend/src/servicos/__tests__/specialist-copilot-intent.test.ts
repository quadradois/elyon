import { extrairHorarioProposto, interpretarIntencaoEspecialista } from '../specialist-copilot-intent';

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
});
