import {
  selecionarSugestoesDeHorario,
  type SlotAgenda,
} from '../sugestao-horarios-agenda';

const slot = (inicio: string): SlotAgenda => ({
  inicio,
  fim: new Date(new Date(inicio).getTime() + 30 * 60_000).toISOString(),
  duracaoMin: 30,
});

describe('sugestão de horários para lead flexível', () => {
  const agora = new Date('2026-08-03T10:00:00.000Z'); // 07:00 em Goiânia
  const slots = [
    slot('2026-08-03T12:00:00.000Z'), // 09:00
    slot('2026-08-03T13:00:00.000Z'), // 10:00
    slot('2026-08-03T17:00:00.000Z'), // 14:00
  ];

  it('oferece no máximo duas opções e varia manhã/tarde quando o lead aceita qualquer horário', () => {
    expect(selecionarSugestoesDeHorario({ slots, agora, periodoPreferido: 'qualquer' }))
      .toEqual([slots[0], slots[2]]);
  });

  it('respeita a preferência por tarde', () => {
    expect(selecionarSugestoesDeHorario({ slots, agora, periodoPreferido: 'tarde' }))
      .toEqual([slots[2]]);
  });

  it('remove horários que conflitam com a agenda local do especialista', () => {
    expect(selecionarSugestoesDeHorario({
      slots,
      agora,
      periodoPreferido: 'manha',
      conflitosLocais: [{ agendadoPara: new Date('2026-08-03T12:00:00.000Z'), duracao: 30 }],
    })).toEqual([slots[1]]);
  });
});
