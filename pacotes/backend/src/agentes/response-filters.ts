import { gerarFallbackContextual } from './conversation-state';
import type { EstadoConversa } from './conversation-state';
import type { TipoAgente } from './agent-chain';
import { logger } from '../lib/logger';

interface AplicarFiltrosRespostaParams {
  respostaFinal: string;
  houveHandoff: boolean;
  tipoAgente: TipoAgente;
  agenteQueRespondeuFormatado: TipoAgente;
  estadoConversaAtual: EstadoConversa;
  cotLog?: string | null;
  nomesToolsTurno: string[];
  fallbackAplicadoAtual: string;
}

interface AplicarFiltrosRespostaResult {
  respostaLimpa: string;
  fallbackAplicado: string;
}

export function aplicarFiltrosRespostaOrchestrator(
  params: AplicarFiltrosRespostaParams
): AplicarFiltrosRespostaResult {
  const {
    respostaFinal,
    houveHandoff,
    tipoAgente,
    agenteQueRespondeuFormatado,
    estadoConversaAtual,
    cotLog,
    nomesToolsTurno,
    fallbackAplicadoAtual,
  } = params;

  let fallbackAplicado = fallbackAplicadoAtual;

  const padroesHandoff = [
    /transferindo/i,
    /transfer[eê]ncia/i,
    /pr[oó]ximo\s+agente/i,
    /aguard[ea]\s+(s[oó]\s+)?um\s+(instante|momento)/i,
    /vou\s+te\s+passar/i,
    /vou\s+transferir/i,
    /s[oó]\s+um\s+instante/i,
    /j[aá]\s+estou\s+aqui/i,
    /pronto.*aqui/i,
    /agente\s+(apresentador|closer|admin)/i,
  ];

  const linhas = respostaFinal.split('\n');
  const linhasLimpas = linhas.filter((linha) => {
    const linhaTrimmed = linha.trim();
    if (!linhaTrimmed) return true;
    return !padroesHandoff.some((p) => p.test(linhaTrimmed));
  });
  let respostaLimpa = linhasLimpas.join('\n').trim();

  if (houveHandoff && respostaLimpa.length > 0 && respostaLimpa.length < 60 && !respostaLimpa.includes('?')) {
    logger.debug(`[ORCHESTRATOR] 🚫 Heurística: resposta curta sem pergunta após handoff, provavelmente narração: "${respostaLimpa}"`);
    respostaLimpa = '';
  }

  if (!respostaLimpa && houveHandoff) {
    logger.warn('[ORCHESTRATOR] ⚠️ Resposta vazia após handoff. Aplicando fallback contextual por agente.');
    fallbackAplicado = 'EMPTY_AFTER_HANDOFF';

    if (agenteQueRespondeuFormatado === 'ADMIN') {
      respostaLimpa = 'Ótimo! Pra eu seguir com seu onboarding, posso começar confirmando seu CPF e e-mail?';
    } else {
      respostaLimpa = gerarFallbackContextual(estadoConversaAtual, agenteQueRespondeuFormatado);
    }
  }

  if (!respostaLimpa && !houveHandoff) {
    const cotTexto = (cotLog || '').toLowerCase();
    const indicioTransicaoPresenter =
      tipoAgente === 'OPENER' &&
      /(transferir\s+para\s+presenter|handoff|transi(ç|c)[aã]o|diagn[oó]stico)/i.test(cotTexto);

    const presenterExecutouToolCritica =
      agenteQueRespondeuFormatado === 'PRESENTER' &&
      nomesToolsTurno.some((nome) => /mover_para_fase|qualificar_lead/i.test(nome));

    if (indicioTransicaoPresenter) {
      logger.warn('[ORCHESTRATOR] ⚠️ Falha na transição OPENER→PRESENTER detectada via CoT. Aplicando fallback consultivo.');
      respostaLimpa = gerarFallbackContextual(estadoConversaAtual, 'PRESENTER');
      fallbackAplicado = 'OPENER_PRESENTER_TRANSITION';
    } else if (presenterExecutouToolCritica) {
      logger.warn('[ORCHESTRATOR] ⚠️ Presenter executou tool crítica, mas retornou resposta vazia. Aplicando fallback de continuidade comercial.');
      respostaLimpa = 'Perfeito, faz total sentido. Posso te mostrar agora, em 1 minuto, como a nossa estratégia aumenta as visitas qualificadas no seu imóvel?';
      fallbackAplicado = 'PRESENTER_TOOL_EMPTY_OUTPUT';
    } else {
      logger.warn('[ORCHESTRATOR] ⚠️ Alerta: O LLM falhou em gerar resposta ou tool call. Usando fallback.');
      respostaLimpa = 'Desculpe, deu um pequeno erro aqui. Pode repetir por favor?';
      fallbackAplicado = 'GENERIC_FALLBACK';
    }
  }

  const presenterTentouMoverFase =
    agenteQueRespondeuFormatado === 'PRESENTER' &&
    nomesToolsTurno.some((nome) => /mover_para_fase/i.test(nome));

  const presenterQualificouNoTurno =
    agenteQueRespondeuFormatado === 'PRESENTER' &&
    nomesToolsTurno.some((nome) => /qualificar_lead/i.test(nome));

  if (presenterTentouMoverFase && !presenterQualificouNoTurno && fallbackAplicado === 'NONE') {
    logger.warn('[ORCHESTRATOR] ⚠️ Gate runtime SPIN/tools: mover_para_fase sem qualificar_lead no turno. Aplicando fallback de continuidade diagnóstica.');
    respostaLimpa = 'Pra eu fechar seu diagnóstico com precisão e te recomendar o melhor caminho: hoje pesa mais o custo do imóvel parado, a baixa procura, ou os dois?';
    fallbackAplicado = 'RUNTIME_SPIN_TOOL_GATE';
  }

  const openerSinalizouTransicao =
    agenteQueRespondeuFormatado === 'OPENER' &&
    /posso\s+te\s+fazer\s+uma\s+pergunta\s+r[aá]pida|entender\s+sua\s+prioridade|pergunta\s+direta\s+sobre\s+sua\s+decis[aã]o/i.test(respostaLimpa.toLowerCase());

  const openerConverteuOuQualificouNoTurno =
    agenteQueRespondeuFormatado === 'OPENER' &&
    nomesToolsTurno.some((nome) => /converter_para_lead|qualificar_lead/i.test(nome));

  if (openerSinalizouTransicao && !openerConverteuOuQualificouNoTurno && fallbackAplicado === 'NONE') {
    logger.warn('[ORCHESTRATOR] ⚠️ Gate runtime Opener: tentativa de transição sem converter/qualificar. Aplicando fallback de coleta mínima.');
    respostaLimpa = estadoConversaAtual.valorPretendido
      ? 'Perfeito, pra te direcionar melhor agora me confirma seu prazo: em quanto tempo você quer concluir essa venda?'
      : 'Perfeito, pra eu te direcionar melhor agora me confirma seu valor de venda em mente e o prazo ideal pra concluir?';
    fallbackAplicado = 'OPENER_CONVERSION_GATE';
  }

  if (respostaLimpa !== respostaFinal.trim()) {
    logger.debug(`[ORCHESTRATOR] 🧹 Filtro handoff aplicado. Original: "${respostaFinal.trim().substring(0, 80)}" → Limpo: "${respostaLimpa.substring(0, 80)}"`);
    if (fallbackAplicado === 'NONE') {
      fallbackAplicado = 'HANDOFF_NARRATION_FILTER';
    }
  }

  return { respostaLimpa, fallbackAplicado };
}
