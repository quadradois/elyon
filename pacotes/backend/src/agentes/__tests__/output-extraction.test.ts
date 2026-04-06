import { extrairRespostaECot } from '../output-extraction';

describe('extrairRespostaECot', () => {
  it('usa string finalOutput diretamente', () => {
    const result = extrairRespostaECot({
      finalOutput: 'Olá, tudo bem?',
    });

    expect(result.respostaFinal).toBe('Olá, tudo bem?');
    expect(result.cotLog).toBeNull();
    expect(result.structuredOutputDetectado).toBe(false);
  });

  it('extrai respostaParaOCliente de structured output', () => {
    const result = extrairRespostaECot({
      finalOutput: {
        respostaParaOCliente: 'CPF anotado! Me passa o e-mail?',
        proximoPasso: 'coletar_email',
      },
    });

    expect(result.respostaFinal).toBe('CPF anotado! Me passa o e-mail?');
    expect(result.structuredOutputDetectado).toBe(true);
    expect(result.proximoPasso).toBe('coletar_email');
  });

  it('remove bloco CoT da resposta final', () => {
    const result = extrairRespostaECot({
      finalOutput: '<cot>Raciocínio interno</cot>Resposta para o cliente',
    });

    expect(result.cotLog).toBe('<cot>Raciocínio interno</cot>');
    expect(result.respostaFinal).toBe('Resposta para o cliente');
  });

  it('faz stringify para output objeto sem respostaParaOCliente', () => {
    const result = extrairRespostaECot({
      finalOutput: { foo: 'bar' },
    });

    expect(result.respostaFinal).toBe('{"foo":"bar"}');
    expect(result.structuredOutputDetectado).toBe(false);
  });

  it('remove tags XML de tools vazadas (qualificar_lead com conteúdo)', () => {
    const result = extrairRespostaECot({
      finalOutput: 'Entendi!\n<qualificar_lead>\n<contatoId>abc123</contatoId>\n<temperatura>QUENTE</temperatura>\n</qualificar_lead>\nPosso te ajudar?',
    });

    expect(result.respostaFinal).toBe('Entendi!\n\nPosso te ajudar?');
  });

  it('remove tags XML de converter_para_lead vazadas', () => {
    const result = extrairRespostaECot({
      finalOutput: '<converter_para_lead>\n<contatoId>abc</contatoId>\n<temperatura>QUENTE</temperatura>\n</converter_para_lead>\n?',
    });

    // Deve ficar vazio ou só com "?" removido
    expect(result.respostaFinal).not.toContain('converter_para_lead');
    expect(result.respostaFinal).not.toContain('contatoId');
  });

  it('remove tags órfãs de transfer_to_* sem fechamento', () => {
    const result = extrairRespostaECot({
      finalOutput: 'Resposta válida\n<transfer_to_presenter_agent_v5>\n',
    });

    expect(result.respostaFinal).toBe('Resposta válida');
    expect(result.respostaFinal).not.toContain('transfer_to');
  });

  it('preserva texto normal com emojis e acentos ao limpar tags XML', () => {
    const result = extrairRespostaECot({
      finalOutput: 'Boa! 😊 Já conheço o empreendimento.\n<qualificar_lead><contatoId>x</contatoId></qualificar_lead>\nVocê tem valor em mente?',
    });

    expect(result.respostaFinal).toBe('Boa! 😊 Já conheço o empreendimento.\n\nVocê tem valor em mente?');
  });
});
