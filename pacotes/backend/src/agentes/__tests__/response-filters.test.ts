import { aplicarFiltrosRespostaOrchestrator } from '../response-filters';
import type { EstadoConversa } from '../conversation-state';

describe('aplicarFiltrosRespostaOrchestrator', () => {
  const estadoBase: EstadoConversa = {
    intencao: 'vender',
    metragem: 85,
    ocupacao: 'ocupado',
    valorPretendido: 'R$ 700.000',
    jaRespondeuDecisao: true,
    estaAnunciando: false,
    timeline: null,
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
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'ADMIN',
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
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'ADMIN',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa.length).toBeGreaterThan(10);
    expect(result.fallbackAplicado).toBe('EMPTY_AFTER_HANDOFF');
  });

  it('usa fallback de tool crítica quando SDR executou tool e output veio vazio', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: '',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: ['mover_para_fase'],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa.length).toBeGreaterThan(10);
    expect(result.fallbackAplicado).toBe('SDR_TOOL_EMPTY_OUTPUT');
  });

  it('aplica fallback genérico quando resposta vazia sem handoff e sem tool crítica', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: '',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa.length).toBeGreaterThan(10);
    expect(result.fallbackAplicado).toBe('GENERIC_FALLBACK');
  });

  it('não altera resposta normal sem handoff', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Oi, tudo bem? Posso te fazer uma pergunta rápida?',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa).toBe('Oi, tudo bem? Posso te fazer uma pergunta rápida?');
    expect(result.fallbackAplicado).toBe('NONE');
  });

  it('remove aspas envolventes quando a resposta inteira vem entre aspas', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: '"Perfeito — você já tem um valor em mente para vender seu apartamento?"',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa).toBe('Perfeito — você já tem um valor em mente para vender seu apartamento?');
    expect(result.fallbackAplicado).toBe('HANDOFF_NARRATION_FILTER');
  });

  it('remove aspas tipográficas envolventes mantendo quebras de linha', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: '“Perfeito — vi que você já está anunciando por R$350.000.\nMe confirma se ele está ocupado ou vago?”',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa).toBe(
      'Perfeito — vi que você já está anunciando por R$350.000.\nMe confirma se ele está ocupado ou vago?'
    );
    expect(result.fallbackAplicado).toBe('HANDOFF_NARRATION_FILTER');
  });

  it('preserva aspas internas de citação quando não são wrapper da frase inteira', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Entendi — você comentou "poucas visitas e muitos curiosos", certo?',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa).toBe('Entendi — você comentou "poucas visitas e muitos curiosos", certo?');
    expect(result.fallbackAplicado).toBe('NONE');
  });

  it('remove bloco textual de metadados internos (raciocinio/fase/pvam/spin)', () => {
    const respostaPoluida = `Tranquilo, faz sentido não saber na hora.
Isso tem atrapalhado algum plano seu (mudança/compra de outro imóvel) ou é mais só incômodo com visitas curiosas?

raciocinio: Lead respondeu não saber a implicação; abordagem deve ser empática.

fase: "DIAGNOSTICO_SPIN"

pvam: { "P": "DESCONHECIDO", "V": "DESCONHECIDO", "A": "ALTA", "M": "DESCONHECIDO" }

spin: { "dorFinanceira": "BAIXO", "necessidadeGestao": "ALTA", "sinalCompra": "ABERTO" }`;

    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: respostaPoluida,
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa).toBe(
      'Tranquilo, faz sentido não saber na hora.\nIsso tem atrapalhado algum plano seu (mudança/compra de outro imóvel) ou é mais só incômodo com visitas curiosas?'
    );
    expect(result.fallbackAplicado).toBe('HANDOFF_NARRATION_FILTER');
  });

  it('resposta curta sem pergunta após handoff é tratada como narração', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Pronto estou aqui',
      houveHandoff: true,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'ADMIN',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    // Resposta curta é limpa e fallback aplicado
    expect(result.fallbackAplicado).toBe('EMPTY_AFTER_HANDOFF');
  });

  it('remove payload interno em JSON no final da resposta', () => {
    const respostaPoluida = `Sim — trabalho com compradores buscando apartamentos no Reserva Buriti.
Qual valor você espera pelo seu apartamento?

{
  "respostaParaOCliente": "Sim — trabalho com compradores buscando apartamentos no Reserva Buriti.\\nQual valor você espera pelo seu apartamento?",
  "raciocinio": "Fase descoberta",
  "fase": "DESCOBERTA",
  "pvam": { "A": "ALTO" },
  "spin": { "sinalCompra": "ABERTO" }
}`;

    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: respostaPoluida,
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa).toBe(
      'Sim — trabalho com compradores buscando apartamentos no Reserva Buriti.\nQual valor você espera pelo seu apartamento?'
    );
    expect(result.fallbackAplicado).toBe('HANDOFF_NARRATION_FILTER');
  });

  it('remove preambulo "Pergunto porque" antes da pergunta principal', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Pergunto porque muita gente recebe curiosos: como ta o retorno do anuncio hoje?',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa).toBe('como ta o retorno do anuncio hoje?');
  });

  it('remove giria reativa "Putz" da resposta final', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Putz, 7 meses e muito tempo. Quer que eu te mostre um caminho melhor?',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(result.respostaLimpa).not.toContain('Putz');
    expect(result.respostaLimpa).toContain('Quer que eu te mostre um caminho melhor?');
  });

  it('remove assuncao de emocao sem evidencia no texto do lead', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Faz sentido que voce esteja chateado. Quer que eu te mostre como destravar?',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
      ultimaMsgLead: 'Estou anunciando ha 7 meses e com poucas visitas.',
    });

    expect(result.respostaLimpa).not.toContain('chateado');
    expect(result.respostaLimpa).toContain('Quer que eu te mostre como destravar?');
  });

  it('preserva validacao emocional quando lead verbalizou emocao', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Entendo que voce esteja chateada. Quer que eu te mostre como destravar?',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
      ultimaMsgLead: 'Estou chateada com essa demora.',
    });

    expect(result.respostaLimpa).toContain('chateada');
  });

  it('reescreve "imovel parado" quando nao houve evidencia explicita', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Voce ta pagando condominio enquanto o imovel fica parado?',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
      ultimaMsgLead: 'Eu moro no apartamento.',
    });

    expect(result.respostaLimpa).not.toContain('parado');
    expect(result.respostaLimpa).toContain('imovel esta anunciado');
  });

  it('bloqueia alegação de confirmação automática por link sem tool de agenda', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Quando você confirma pelo link do Google Calendar, o horário fica travado automaticamente e o especialista já recebe o aviso.',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
      ultimaMsgLead: 'Já agendei, consegue confirmar?',
    });

    expect(result.fallbackAplicado).toBe('AGENDA_CONFIRMATION_GUARD');
    expect(result.respostaLimpa).toContain('não consigo confirmar');
    expect(result.respostaLimpa).not.toContain('fica travado');
  });

  it('mantém confirmação de agenda quando a tool retornou sucesso', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'O horário fica travado automaticamente no Google Calendar.',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: ['agendar_reuniao_closer'],
      nomesToolsSucessoTurno: ['agendar_reuniao_closer'],
      fallbackAplicadoAtual: 'NONE',
      ultimaMsgLead: 'Pode ser amanhã às 9h.',
    });

    expect(result.fallbackAplicado).toBe('NONE');
    expect(result.respostaLimpa).toContain('fica travado');
  });

  it('bloqueia confirmação de agenda quando a tool foi chamada mas retornou falha', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'O horário fica travado automaticamente no Google Calendar.',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: ['agendar_reuniao_closer'],
      nomesToolsSucessoTurno: [],
      fallbackAplicadoAtual: 'NONE',
      ultimaMsgLead: 'Pode ser amanhã às 9h.',
    });

    expect(result.fallbackAplicado).toBe('AGENDA_CONFIRMATION_GUARD');
    expect(result.respostaLimpa).toContain('não consigo confirmar');
  });

  it('trata pergunta sobre cancelamento como consulta de status', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Sim, o agendamento foi cancelado. 😊',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
      ultimaMsgLead: 'O agendamento foi cancelado?',
    });

    expect(result.fallbackAplicado).toBe('AGENDA_STATUS_GUARD');
    expect(result.respostaLimpa).toContain('não consultei o status atualizado');
    expect(result.respostaLimpa).not.toContain('foi cancelado');
  });

  it('mantém confirmação de cancelamento quando a tool foi executada', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Sim, o agendamento foi cancelado. 😊',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: ['cancelar_agendamento'],
      nomesToolsSucessoTurno: ['cancelar_agendamento'],
      fallbackAplicadoAtual: 'NONE',
      ultimaMsgLead: 'Pode cancelar.',
    });

    expect(result.fallbackAplicado).toBe('NONE');
    expect(result.respostaLimpa).toContain('foi cancelado');
  });

  it('bloqueia confirmação quando cancelar_agendamento foi chamada mas retornou falha', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Sim, o agendamento foi cancelado. 😊',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: ['cancelar_agendamento'],
      nomesToolsSucessoTurno: [],
      fallbackAplicadoAtual: 'NONE',
      ultimaMsgLead: 'Pode cancelar.',
    });

    expect(result.fallbackAplicado).toBe('AGENDA_CANCELLATION_GUARD');
    expect(result.respostaLimpa).toContain('não consegui registrar');
  });

  it('bloqueia resposta de status baseada apenas no histórico da conversa', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Seu agendamento está confirmado para 03/08/2026 às 09:00 com Guilherme.',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: [],
      nomesToolsSucessoTurno: [],
      fallbackAplicadoAtual: 'NONE',
      ultimaMsgLead: 'Veja primeiro se está ativo o agendamento.',
    });

    expect(result.fallbackAplicado).toBe('AGENDA_STATUS_GUARD');
    expect(result.respostaLimpa).toContain('não consultei o status atualizado');
    expect(result.respostaLimpa).not.toContain('03/08/2026');
  });

  it('mantém resposta de cancelamento quando veio da consulta canônica', () => {
    const result = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: 'Não há agendamento ativo. O último consta como cancelado no sistema.',
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: null,
      nomesToolsTurno: ['consultar_status_agendamento'],
      nomesToolsSucessoTurno: ['consultar_status_agendamento'],
      fallbackAplicadoAtual: 'NONE',
      ultimaMsgLead: 'Meu agendamento foi cancelado?',
    });

    expect(result.fallbackAplicado).toBe('NONE');
    expect(result.respostaLimpa).toContain('consta como cancelado');
  });
});
