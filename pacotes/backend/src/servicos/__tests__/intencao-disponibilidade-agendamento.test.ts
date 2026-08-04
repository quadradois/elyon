import { interpretarConsultaDisponibilidadeAgendamento } from '../intencao-disponibilidade-agendamento';

describe('interpretarConsultaDisponibilidadeAgendamento', () => {
  const agora = new Date('2026-08-04T18:49:00.000Z');

  it('reconhece a frase real e preserva amanhã', () => {
    expect(interpretarConsultaDisponibilidadeAgendamento('Quais horarios temos amanha ?', agora)).toEqual({
      periodoPreferido: 'qualquer',
      dataPreferida: '2026-08-05',
    });
  });

  it('preserva período e data explícita', () => {
    expect(interpretarConsultaDisponibilidadeAgendamento('Tem horários de tarde em 06/08/2026?', agora)).toEqual({
      periodoPreferido: 'tarde',
      dataPreferida: '2026-08-06',
    });
  });

  it('reconhece flexibilidade sem inventar data', () => {
    expect(interpretarConsultaDisponibilidadeAgendamento('Pode ser qualquer horário', agora)).toEqual({
      periodoPreferido: 'qualquer',
      dataPreferida: undefined,
    });
  });

  it('não confunde consulta do agendamento existente com disponibilidade', () => {
    expect(interpretarConsultaDisponibilidadeAgendamento('Qual é o horário do meu agendamento?', agora)).toBeNull();
  });

  it('não intercepta escolha com data e hora exatas', () => {
    expect(interpretarConsultaDisponibilidadeAgendamento('Amanhã às 10h está bom', agora)).toBeNull();
  });
});
