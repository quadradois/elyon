import {
  normalizarTexto,
  extrairEstadoConversa,
  respostaPositivaCurta,
  deveForcarTransicaoParaPresenter,
  respostaRepetePerguntaCritica,
  gerarFallbackContextual,
  EstadoConversa,
} from '../conversation-state';

// ============================================
// normalizarTexto
// ============================================

describe('normalizarTexto', () => {
  it('remove acentos e converte para minúsculo', () => {
    expect(normalizarTexto('Olá Você')).toBe('ola voce');
  });

  it('retorna string vazia para undefined', () => {
    expect(normalizarTexto(undefined)).toBe('');
  });

  it('faz trim', () => {
    expect(normalizarTexto('  teste  ')).toBe('teste');
  });

  it('mantém dígitos intactos', () => {
    expect(normalizarTexto('120m² R$500k')).toBe('120m² r$500k');
  });
});

// ============================================
// extrairEstadoConversa
// ============================================

describe('extrairEstadoConversa', () => {
  it('detecta intenção "vender"', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'Quero vender meu apartamento' },
    ]);
    expect(estado.intencao).toBe('vender');
  });

  it('detecta intenção "alugar"', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'Estou pensando em alugar' },
    ]);
    expect(estado.intencao).toBe('alugar');
  });

  it('detecta locação por regex', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'Preciso de locação' },
    ]);
    expect(estado.intencao).toBe('alugar');
  });

  it('retorna null quando sem intenção clara', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'Bom dia, tudo bem?' },
    ]);
    expect(estado.intencao).toBeNull();
  });

  it('extrai metragem em m²', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'O apartamento tem 120m²' },
    ]);
    expect(estado.metragem).toBe(120);
  });

  it('extrai metragem sem símbolo ²', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'São 85m de área' },
    ]);
    expect(estado.metragem).toBe(85);
  });

  it('detecta ocupação "vazio"', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'Está desocupado há 3 meses' },
    ]);
    expect(estado.ocupacao).toBe('vazio');
  });

  it('detecta ocupação "ocupado"', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'Ainda estou morando lá' },
    ]);
    expect(estado.ocupacao).toBe('ocupado');
  });

  it('extrai valor pretendido com "k"', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'Estou pensando em uns 500k' },
    ]);
    expect(estado.valorPretendido).toBe('500k');
  });

  it('extrai valor pretendido com R$', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'Acho que vale R$ 450.000' },
    ]);
    expect(estado.valorPretendido).toContain('450.000');
  });

  it('detecta decisão de venda (com acentos)', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'Já decidi vender' },
    ]);
    expect(estado.jaRespondeuDecisao).toBe(true);
  });

  it('detecta "preciso vender"', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'Preciso vender urgente' },
    ]);
    expect(estado.jaRespondeuDecisao).toBe(true);
  });

  it('não marca decisão para conversa genérica', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'Bom dia' },
    ]);
    expect(estado.jaRespondeuDecisao).toBe(false);
  });

  it('detecta perguntas já feitas pelo assistente', () => {
    const estado = extrairEstadoConversa([
      { role: 'assistant', content: 'Posso te fazer uma pergunta rápida?' },
      { role: 'user', content: 'Pode sim' },
      { role: 'assistant', content: 'Já decidiu vender ou ainda tá só avaliando?' },
      { role: 'user', content: 'Já decidi' },
    ]);
    expect(estado.perguntasJaFeitas.prioridade).toBe(true);
    expect(estado.perguntasJaFeitas.decisaoVenda).toBe(true);
  });

  it('combina dados de múltiplas mensagens do usuário', () => {
    const estado = extrairEstadoConversa([
      { role: 'user', content: 'Quero vender' },
      { role: 'assistant', content: 'Qual a metragem?' },
      { role: 'user', content: '120m²' },
      { role: 'assistant', content: 'E está ocupado?' },
      { role: 'user', content: 'Está vazio' },
    ]);
    expect(estado.intencao).toBe('vender');
    expect(estado.metragem).toBe(120);
    expect(estado.ocupacao).toBe('vazio');
  });
});

// ============================================
// respostaPositivaCurta
// ============================================

describe('respostaPositivaCurta', () => {
  it.each([
    'sim', 'pode', 'pode sim', 'pode ser', 'claro', 'ok',
    'beleza', 'bora', 'vamos', 'fechado', 'quero', 'manda',
  ])('detecta "%s" como positiva', (texto) => {
    expect(respostaPositivaCurta(texto)).toBe(true);
  });

  it.each([
    'não', 'agora não', 'depois', 'talvez',
  ])('rejeita "%s" como negativa', (texto) => {
    expect(respostaPositivaCurta(texto)).toBe(false);
  });

  it('retorna false para undefined', () => {
    expect(respostaPositivaCurta(undefined)).toBe(false);
  });

  it('retorna false para texto vazio', () => {
    expect(respostaPositivaCurta('')).toBe(false);
  });

  it('ignora acentos', () => {
    expect(respostaPositivaCurta('Claro!')).toBe(true);
  });
});

// ============================================
// deveForcarTransicaoParaPresenter
// ============================================

describe('deveForcarTransicaoParaPresenter', () => {
  it('retorna true quando assistant fez pergunta de prioridade e user respondeu positivo', () => {
    const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'assistant', content: 'Posso te fazer uma pergunta rápida?' },
      { role: 'user', content: 'Pode sim' },
    ];
    expect(deveForcarTransicaoParaPresenter(msgs)).toBe(true);
  });

  it('retorna false quando user respondeu negativamente', () => {
    const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'assistant', content: 'Posso te fazer uma pergunta rápida?' },
      { role: 'user', content: 'Agora não' },
    ];
    expect(deveForcarTransicaoParaPresenter(msgs)).toBe(false);
  });

  it('retorna false sem mensagens suficientes', () => {
    expect(deveForcarTransicaoParaPresenter([])).toBe(false);
    expect(deveForcarTransicaoParaPresenter([{ role: 'user', content: 'oi' }])).toBe(false);
  });

  it('retorna false quando assistant não fez pergunta de prioridade', () => {
    const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'assistant', content: 'Olá, tudo bem?' },
      { role: 'user', content: 'Sim' },
    ];
    expect(deveForcarTransicaoParaPresenter(msgs)).toBe(false);
  });

  it('funciona com conversa longa (pega a última interação)', () => {
    const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'assistant', content: 'Olá!' },
      { role: 'user', content: 'Oi' },
      { role: 'assistant', content: 'Qual seu imóvel?' },
      { role: 'user', content: 'Apartamento 120m²' },
      { role: 'assistant', content: 'Posso te fazer uma pergunta rápida?' },
      { role: 'user', content: 'Claro' },
    ];
    expect(deveForcarTransicaoParaPresenter(msgs)).toBe(true);
  });
});

// ============================================
// respostaRepetePerguntaCritica
// ============================================

describe('respostaRepetePerguntaCritica', () => {
  it('detecta texto repetido', () => {
    const mensagens: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'assistant', content: 'Olá, tudo bem?' },
      { role: 'user', content: 'Sim' },
    ];
    expect(respostaRepetePerguntaCritica('Olá, tudo bem?', mensagens)).toBe(true);
  });

  it('detecta repetição de pergunta de prioridade', () => {
    const mensagens: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'assistant', content: 'Posso te fazer uma pergunta rápida?' },
      { role: 'user', content: 'Sim' },
    ];
    expect(respostaRepetePerguntaCritica('Posso te fazer uma pergunta rápida?', mensagens)).toBe(true);
  });

  it('não detecta resposta nova', () => {
    const mensagens: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'assistant', content: 'Olá!' },
      { role: 'user', content: 'Oi' },
    ];
    expect(respostaRepetePerguntaCritica('Qual o tipo do seu imóvel?', mensagens)).toBe(false);
  });

  it('retorna false para resposta vazia', () => {
    expect(respostaRepetePerguntaCritica('', [])).toBe(false);
  });
});

// ============================================
// gerarFallbackContextual
// ============================================

describe('gerarFallbackContextual', () => {
  it('pergunta sobre intenção quando falta', () => {
    const estado: EstadoConversa = {
      intencao: null,
      metragem: null,
      ocupacao: null,
      valorPretendido: null,
      jaRespondeuDecisao: false,
      perguntasJaFeitas: { prioridade: false, decisaoVenda: false, valor: false },
    };
    expect(gerarFallbackContextual(estado, 'OPENER')).toContain('vender ou alugar');
  });

  it('pergunta sobre ocupação quando tem intenção mas falta ocupação', () => {
    const estado: EstadoConversa = {
      intencao: 'vender',
      metragem: null,
      ocupacao: null,
      valorPretendido: null,
      jaRespondeuDecisao: false,
      perguntasJaFeitas: { prioridade: false, decisaoVenda: false, valor: false },
    };
    expect(gerarFallbackContextual(estado, 'OPENER')).toContain('ocupado ou vazio');
  });

  it('pergunta sobre valor quando tem intenção e ocupação', () => {
    const estado: EstadoConversa = {
      intencao: 'vender',
      metragem: 120,
      ocupacao: 'vazio',
      valorPretendido: null,
      jaRespondeuDecisao: false,
      perguntasJaFeitas: { prioridade: false, decisaoVenda: false, valor: false },
    };
    const fallback = gerarFallbackContextual(estado, 'OPENER');
    expect(fallback).toContain('valor');
  });

  it('retorna fallback genérico quando tem tudo preenchido sem decisão', () => {
    const estado: EstadoConversa = {
      intencao: 'vender',
      metragem: 120,
      ocupacao: 'vazio',
      valorPretendido: '500k',
      jaRespondeuDecisao: false,
      perguntasJaFeitas: { prioridade: false, decisaoVenda: false, valor: false },
    };
    // temIntencao && temValor → empurra pra apresentação
    expect(gerarFallbackContextual(estado, 'OPENER')).toContain('vender mais rápido');
  });

  it('empurra para apresentação quando tem dados suficientes', () => {
    const estado: EstadoConversa = {
      intencao: 'vender',
      metragem: 120,
      ocupacao: 'vazio',
      valorPretendido: '500k',
      jaRespondeuDecisao: true,
      perguntasJaFeitas: { prioridade: true, decisaoVenda: true, valor: true },
    };
    expect(gerarFallbackContextual(estado, 'OPENER')).toContain('vender mais rápido');
  });

  it('empurra para apresentação quando tem intenção + já decidiu', () => {
    const estado: EstadoConversa = {
      intencao: 'vender',
      metragem: null,
      ocupacao: null,
      valorPretendido: null,
      jaRespondeuDecisao: true,
      perguntasJaFeitas: { prioridade: false, decisaoVenda: false, valor: false },
    };
    expect(gerarFallbackContextual(estado, 'OPENER')).toContain('vender mais rápido');
  });
});
