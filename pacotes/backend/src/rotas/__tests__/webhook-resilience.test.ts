import {
  extrairSinaisNegociacaoHumana,
  deveAutoRetornarParaIA,
  deveExecutarFallbackConversao,
  deveExecutarFallbackAtualizacaoLead,
} from '../webhook-resilience';

describe('webhook-resilience', () => {
  it('extrai sinais de negociacao humana', () => {
    const sinais = extrairSinaisNegociacaoHumana('podemos fechar exclusiva com 6% por 120 dias');
    expect(sinais.tipoAutorizacao).toBe('exclusiva');
    expect(sinais.comissaoAcordada).toBe('6%');
    expect(sinais.prazoTrabalho).toBe(120);
  });

  it('auto retorno para IA depende de flag e status elegivel', () => {
    expect(deveAutoRetornarParaIA(true, 'DOCUMENTACAO')).toBe(true);
    expect(deveAutoRetornarParaIA(true, 'NOVO')).toBe(false);
    expect(deveAutoRetornarParaIA(false, 'DOCUMENTACAO')).toBe(false);
  });

  it('fallback de conversao roda apenas sem lead e com lock adquirido', () => {
    expect(deveExecutarFallbackConversao({ virouLead: false, leadId: null, lockAdquirido: true })).toBe(true);
    expect(deveExecutarFallbackConversao({ virouLead: false, leadId: null, lockAdquirido: false })).toBe(false);
    expect(deveExecutarFallbackConversao({ virouLead: true, leadId: 'lead-1', lockAdquirido: true })).toBe(false);
  });

  it('fallback de atualizacao do lead so roda quando ha lead, sem tool recente e com texto suficiente', () => {
    expect(deveExecutarFallbackAtualizacaoLead({
      leadId: 'lead-1',
      houveToolSucessoNoTurno: false,
      houveToolExecRecente: false,
      textoConversa: 'estou querendo vender e está parado',
    })).toBe(true);

    expect(deveExecutarFallbackAtualizacaoLead({
      leadId: null,
      houveToolSucessoNoTurno: false,
      houveToolExecRecente: false,
      textoConversa: 'texto válido',
    })).toBe(false);

    expect(deveExecutarFallbackAtualizacaoLead({
      leadId: 'lead-1',
      houveToolSucessoNoTurno: false,
      houveToolExecRecente: true,
      textoConversa: 'texto válido',
    })).toBe(false);

    expect(deveExecutarFallbackAtualizacaoLead({
      leadId: 'lead-1',
      houveToolSucessoNoTurno: true,
      houveToolExecRecente: false,
      textoConversa: 'veja se tenho um agendamento ativo',
    })).toBe(false);

    expect(deveExecutarFallbackAtualizacaoLead({
      leadId: 'lead-1',
      houveToolSucessoNoTurno: false,
      houveToolExecRecente: false,
      textoConversa: 'Veja se tenho algum agendamento ativo!',
    })).toBe(false);

    expect(deveExecutarFallbackAtualizacaoLead({
      leadId: 'lead-1',
      houveToolSucessoNoTurno: false,
      houveToolExecRecente: false,
      textoConversa: 'Quais horarios temos amanha ?',
    })).toBe(false);
  });
});
