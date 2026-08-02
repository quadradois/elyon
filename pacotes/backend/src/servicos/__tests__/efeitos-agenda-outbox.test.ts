import { montarMensagemAgendaPorFato } from '../efeitos-agenda-outbox';

describe('semântica dos efeitos da Agenda', () => {
  it('não promete confirmação enquanto há apenas solicitação', () => {
    const mensagem = montarMensagemAgendaPorFato({
      fato: 'SOLICITADA', modalidade: 'TELEFONE', dataHora: '03/08/2026 às 10:00', especialistaNome: 'Guilherme',
    });
    expect(mensagem).toContain('solicitação');
    expect(mensagem).toContain('Assim que Guilherme confirmar');
    expect(mensagem).not.toContain('Ligação confirmada');
  });

  it('explicita pendência quando nenhum especialista está disponível', () => {
    const mensagem = montarMensagemAgendaPorFato({
      fato: 'PENDENTE_ESPECIALISTA', modalidade: 'VISITA', dataHora: '03/08/2026 às 10:00',
    });
    expect(mensagem).toContain('ainda não está confirmado');
  });

  it.each([
    ['TELEFONE', 'Ligação confirmada', 'ligará'],
    ['VISITA', 'Visita confirmada', 'com Julia'],
  ] as const)('confirma a modalidade %s com semântica própria', (modalidade, titulo, detalhe) => {
    const mensagem = montarMensagemAgendaPorFato({
      fato: 'CONFIRMADA', modalidade, dataHora: '03/08/2026 às 10:00', especialistaNome: 'Julia',
    });
    expect(mensagem).toContain(titulo);
    expect(mensagem).toContain(detalhe);
  });
});
