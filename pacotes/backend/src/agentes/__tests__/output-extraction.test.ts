import { extrairRespostaECot as _extrairRespostaECot } from '../output-extraction';

// Cast para permitir stubs de teste com objetos parciais
const extrairRespostaECot = _extrairRespostaECot as (result: any) => ReturnType<typeof _extrairRespostaECot>;

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

  it('preserva dadosEstruturados e raciocinio do structured output', () => {
    const result = extrairRespostaECot({
      finalOutput: {
        respostaParaOCliente: 'Entendi, já anunciou antes?',
        raciocinio: 'Lead parece receptivo, fase Descoberta',
        proximoPasso: 'DESCOBERTA',
        pvamInferido: {
          preco: 'DESCONHECIDO',
          veto: 'DECIDE_SOZINHO',
          ativador: 'INTERESSE_LEVE',
          momento: 'DESCONHECIDO',
        },
      },
    });

    expect(result.respostaFinal).toBe('Entendi, já anunciou antes?');
    expect(result.structuredOutputDetectado).toBe(true);
    expect(result.cotLog).toBe('Lead parece receptivo, fase Descoberta');
    expect(result.proximoPasso).toBe('DESCOBERTA');
    expect(result.dadosEstruturados).toBeDefined();
    expect((result.dadosEstruturados as any).pvamInferido.ativador).toBe('INTERESSE_LEVE');
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

  // ──── Testes para Caminho 2.5: Structured Output em formato string ────
  
  it('extrai respostaParaOCliente de JSON string (SDK devolveu string em vez de objeto)', () => {
    const json = JSON.stringify({
      respostaParaOCliente: 'Perfeito, você quer vender ou alugar?',
      raciocinio: 'Fase Descoberta, lead interessado',
      proximoPasso: 'DESCOBERTA',
      pvamInferido: { preco: 'DESCONHECIDO' },
    });

    const result = extrairRespostaECot({ finalOutput: json });

    expect(result.respostaFinal).toBe('Perfeito, você quer vender ou alugar?');
    expect(result.structuredOutputDetectado).toBe(true);
    expect(result.cotLog).toBe('Fase Descoberta, lead interessado');
    expect(result.proximoPasso).toBe('DESCOBERTA');
  });

  it('extrai respostaParaOCliente de formato texto "key: value" (modelo sem JSON)', () => {
    const textoModelo = `respostaParaOCliente: Perfeito, Ivonet — você quer vender ou alugar o imóvel no Reserva Buriti?

raciocinio: Fase Descoberta. Lead interessado.

proximoPasso: coletar_tipo_interesse

pvamInferido: {temperatura: "MORNO"}`;

    const result = extrairRespostaECot({ finalOutput: textoModelo });

    expect(result.respostaFinal).toBe('Perfeito, Ivonet — você quer vender ou alugar o imóvel no Reserva Buriti?');
    expect(result.structuredOutputDetectado).toBe(true);
    expect(result.cotLog).toBe('Fase Descoberta. Lead interessado.');
    expect(result.proximoPasso).toBe('coletar_tipo_interesse');
  });

  it('extrai respostaParaOCliente quando o modelo envia texto + JSON interno no final', () => {
    const textoPoluido = `Sim — trabalho com compradores buscando apartamentos no Reserva Buriti.
Qual valor você espera pelo seu apartamento?

{
  "respostaParaOCliente": "Sim — trabalho com compradores buscando apartamentos no Reserva Buriti.\\nQual valor você espera pelo seu apartamento?",
  "raciocinio": "Fase descoberta",
  "fase": "DESCOBERTA",
  "pvam": { "A": "ALTO" },
  "spin": { "sinalCompra": "ABERTO" }
}`;

    const result = extrairRespostaECot({ finalOutput: textoPoluido });

    expect(result.respostaFinal).toBe(
      'Sim — trabalho com compradores buscando apartamentos no Reserva Buriti.\nQual valor você espera pelo seu apartamento?'
    );
    expect(result.structuredOutputDetectado).toBe(true);
    expect(result.cotLog).toBe('Fase descoberta');
  });

  it('não confunde texto normal que menciona "respostaParaOCliente" como campo', () => {
    const result = extrairRespostaECot({
      finalOutput: 'Olá, tudo bem?',
    });

    expect(result.respostaFinal).toBe('Olá, tudo bem?');
    expect(result.structuredOutputDetectado).toBe(false);
  });

  it('remove bloco textual de metadados internos mesmo sem campo respostaParaOCliente', () => {
    const result = extrairRespostaECot({
      finalOutput: `Tranquilo, faz sentido não saber na hora.
Isso tem atrapalhado algum plano seu (mudança/compra de outro imóvel) ou é mais só incômodo com visitas curiosas?

raciocinio: Lead respondeu não saber a implicação; abordagem deve ser empática.

fase: "DIAGNOSTICO_SPIN"

pvam: { "P": "DESCONHECIDO", "V": "DESCONHECIDO", "A": "ALTA", "M": "DESCONHECIDO" }

spin: { "dorFinanceira": "BAIXO", "necessidadeGestao": "ALTA", "sinalCompra": "ABERTO" }`,
    });

    expect(result.respostaFinal).toBe(
      'Tranquilo, faz sentido não saber na hora.\nIsso tem atrapalhado algum plano seu (mudança/compra de outro imóvel) ou é mais só incômodo com visitas curiosas?'
    );
    expect(result.structuredOutputDetectado).toBe(false);
  });
});
