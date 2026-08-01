import {
  formatarDataHoraAgenda,
  montarMensagemLigacaoConfirmada,
  montarMensagemSolicitacaoLigacao,
} from '../notificacao-agendamento';

describe('mensagens de agendamento por ligação', () => {
  it('registra solicitação sem afirmar confirmação antecipada', () => {
    const mensagem = montarMensagemSolicitacaoLigacao({
      dataHora: '03/08/2026 08:01',
      especialistaNome: 'Guilherme',
    });

    expect(mensagem).toContain('registrei a solicitação');
    expect(mensagem).toContain('Assim que o especialista confirmar');
    expect(mensagem).not.toContain('está confirmado');
  });

  it('confirma ligação telefônica sem chamar de visita ou avaliação', () => {
    const mensagem = montarMensagemLigacaoConfirmada({
      leadNome: 'Ivonet',
      agendadoPara: new Date('2026-08-03T11:01:00.000Z'),
      especialistaNome: 'Guilherme',
    });

    expect(mensagem).toContain('Ligação confirmada');
    expect(mensagem).toContain('Guilherme confirmou seu atendimento por telefone');
    expect(mensagem).toContain('08:01');
    expect(mensagem).toContain('ligará para você');
    expect(mensagem).not.toMatch(/visita|avaliação/i);
  });

  it('formata o horário no fuso de Brasília', () => {
    expect(formatarDataHoraAgenda(new Date('2026-08-03T11:01:00.000Z'))).toContain('08:01');
  });
});
