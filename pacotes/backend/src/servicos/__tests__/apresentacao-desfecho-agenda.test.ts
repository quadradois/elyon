import { motivoDesfechoAgendaParaExibicao } from '../apresentacao-desfecho-agenda';

describe('apresentação do desfecho da Agenda', () => {
  it('preserva texto UTF-8 válido', () => {
    expect(motivoDesfechoAgendaParaExibicao({
      status: 'NAO_COMPARECEU',
      tipoAtividade: 'REUNIAO',
      parteAusente: 'CORRETOR',
      motivo: 'Especialista não realizou a ligação confirmada',
    })).toBe('Especialista não realizou a ligação confirmada');
  });

  it('repara mojibake reversível', () => {
    expect(motivoDesfechoAgendaParaExibicao({
      status: 'CANCELADO',
      motivo: 'Lead nÃ£o confirmou o horÃ¡rio',
    })).toBe('Lead não confirmou o horário');
  });

  it('deriva motivo canônico quando caracteres já foram perdidos', () => {
    expect(motivoDesfechoAgendaParaExibicao({
      status: 'NAO_COMPARECEU',
      tipoAtividade: 'REUNIAO',
      parteAusente: 'CORRETOR',
      motivo: 'Especialista n?o realizou a liga??o confirmada',
    })).toBe('Especialista não realizou a ligação confirmada');
  });

  it('não inventa conteúdo para observação corrompida sem semântica estrutural', () => {
    expect(motivoDesfechoAgendaParaExibicao({
      status: 'CANCELADO',
      motivo: 'Motivo inv?lido',
    })).toBe('Observação registrada com caracteres inválidos; consulte o histórico de auditoria.');
  });
});
