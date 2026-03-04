import { aplicarFiltrosRespostaOrchestrator } from '../response-filters';

describe('aplicarFiltrosRespostaOrchestrator', () => {
  const estadoBase = {
    intencao: 'vender',
    metragem: 85,
    ocupacao: 'ocupado',
    valorPretendido: 'R$ 700.000',
    jaRespondeuDecisao: true,
    perguntasJaFeitas: {
      prioridade: true,
      decisaoVenda: true,
      valor: false,
    },
  };

  it('remove narração de handoff e mantém conteúdo útil', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Transferindo para o especialista.\nPosso te explicar como funciona nossa avaliação premium?',
      houveHandoff: true,
      tipoAgente: 'OPENER',
      agenteQueRespondeuFormatado: 'PRESENTER',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa).toContain('avaliação premium');
    expect(result.respostaLimpa).not.toContain('Transferindo');
    expect(result.fallbackAplicado).toBe('HANDOFF_NARRATION_FILTER');
  });

  it('aplica fallback contextual quando handoff gera resposta vazia', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Vou te passar para o próximo agente',
      houveHandoff: true,
      tipoAgente: 'OPENER',
      agenteQueRespondeuFormatado: 'PRESENTER',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa.length).toBeGreaterThan(10);
    expect(result.fallbackAplicado).toBe('EMPTY_AFTER_HANDOFF');
  });

  it('usa fallback de tool crítica quando presenter executou tool e output veio vazio', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: '',
      houveHandoff: false,
      tipoAgente: 'PRESENTER',
      agenteQueRespondeuFormatado: 'PRESENTER',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: ['mover_para_fase'],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa).toContain('estratégia aumenta as visitas qualificadas');
    expect(result.fallbackAplicado).toBe('PRESENTER_TOOL_EMPTY_OUTPUT');
  });
});
