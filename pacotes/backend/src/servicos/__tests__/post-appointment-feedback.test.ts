import {
  calcularElegibilidadeFeedback,
  interpretarFeedbackPosAtendimento,
  montarMensagemFeedbackPosAtendimento,
} from '../post-appointment-feedback';

describe('feedback pós-atendimento', () => {
  it('agenda ligação vinte minutos depois do início', () => {
    const inicio = new Date('2026-08-05T15:00:00Z');
    expect(calcularElegibilidadeFeedback({ agendadoPara: inicio, canal: 'TELEFONE', tipo: 'REUNIAO' }))
      .toEqual(new Date('2026-08-05T15:20:00Z'));
  });

  it('agenda visita quinze minutos depois do término', () => {
    const inicio = new Date('2026-08-05T15:00:00Z');
    expect(calcularElegibilidadeFeedback({ agendadoPara: inicio, canal: 'VISITA', tipo: 'AVALIACAO', duracaoMinutos: 60 }))
      .toEqual(new Date('2026-08-05T16:15:00Z'));
  });

  it.each([
    ['1. Conversei com ela e quer vender no próximo mês', 'REALIZADO'],
    ['A cliente não atendeu', 'LEAD_AUSENTE'],
    ['Eu não consegui ligar porque fiquei sem sinal', 'ESPECIALISTA_AUSENTE'],
    ['Precisamos reagendar para outro horário', 'REAGENDAR'],
    ['atendimento 1 realizado', 'REALIZADO'],
    ['Depois vejo', 'AMBIGUO'],
  ])('interpreta %s', (texto, intent) => {
    expect(interpretarFeedbackPosAtendimento(texto).intent).toBe(intent);
  });

  it('monta convite contextual sem expor dados desnecessários', () => {
    const mensagem = montarMensagemFeedbackPosAtendimento({
      especialistaNome: 'Guilherme', leadNome: 'Ivonet', agendadoPara: new Date('2026-08-05T15:00:00Z'),
      modalidade: 'Ligação telefônica', imovel: 'Reserva Buriti',
    });
    expect(mensagem).toContain('Guilherme');
    expect(mensagem).toContain('Ivonet');
    expect(mensagem).toContain('Reserva Buriti');
    expect(mensagem).toContain('breve resumo');
  });
});
