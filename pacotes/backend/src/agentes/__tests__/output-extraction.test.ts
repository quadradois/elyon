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
});
