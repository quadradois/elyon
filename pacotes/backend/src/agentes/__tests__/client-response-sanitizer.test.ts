import { sanitizarRespostaParaCliente } from '../client-response-sanitizer';

describe('sanitizarRespostaParaCliente', () => {
  it('normaliza termo "contrato simples" para "autorização de venda"', () => {
    const entrada = 'Temos contrato simples e comissão de 5%.';
    const saida = sanitizarRespostaParaCliente(entrada);

    expect(saida).toContain('autorização de venda');
    expect(saida.toLowerCase()).not.toContain('contrato simples');
  });

  it('remove construção "temos duas opções: contrato simples ou exclusivo"', () => {
    const entrada = 'Temos duas opções: contrato simples (você pode trabalhar com outros corretores) ou exclusivo por 180 dias.';
    const saida = sanitizarRespostaParaCliente(entrada);

    expect(saida).toContain('Trabalhamos com autorização de venda');
    expect(saida.toLowerCase()).not.toContain('duas opções');
    expect(saida.toLowerCase()).not.toContain('contrato simples');
  });

  it('bloqueia planejamento interno em inglês antes do envio ao lead', () => {
    const entrada = "The user is asking for available times tomorrow. I need to use consultar_horarios_disponiveis. Then I'll present them.";
    expect(sanitizarRespostaParaCliente(entrada)).toBe('');
  });
});

