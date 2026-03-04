import { gerarFallbackContextual } from './conversation-state';
import type { EstadoConversa } from './conversation-state';
import type { TipoAgente } from './agent-chain';

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
    console.log(`[ORCHESTRATOR] 🚫 Heurística: resposta curta sem pergunta após handoff, provavelmente narração: "${respostaLimpa}"`);
    respostaLimpa = '';
  }

  if (!respostaLimpa && houveHandoff) {
    console.warn('[ORCHESTRATOR] ⚠️ Resposta vazia após handoff. Aplicando fallback contextual por agente.');
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
      console.warn('[ORCHESTRATOR] ⚠️ Falha na transição OPENER→PRESENTER detectada via CoT. Aplicando fallback consultivo.');
      respostaLimpa = gerarFallbackContextual(estadoConversaAtual, 'PRESENTER');
      fallbackAplicado = 'OPENER_PRESENTER_TRANSITION';
    } else if (presenterExecutouToolCritica) {
      console.warn('[ORCHESTRATOR] ⚠️ Presenter executou tool crítica, mas retornou resposta vazia. Aplicando fallback de continuidade comercial.');
      respostaLimpa = 'Perfeito, faz total sentido. Posso te mostrar agora, em 1 minuto, como a nossa estratégia aumenta as visitas qualificadas no seu imóvel?';
      fallbackAplicado = 'PRESENTER_TOOL_EMPTY_OUTPUT';
    } else {
      console.warn('[ORCHESTRATOR] ⚠️ Alerta: O LLM falhou em gerar resposta ou tool call. Usando fallback.');
      respostaLimpa = 'Desculpe, deu um pequeno erro aqui. Pode repetir por favor?';
      fallbackAplicado = 'GENERIC_FALLBACK';
    }
  }

  if (respostaLimpa !== respostaFinal.trim()) {
    console.log(`[ORCHESTRATOR] 🧹 Filtro handoff aplicado. Original: "${respostaFinal.trim().substring(0, 80)}" → Limpo: "${respostaLimpa.substring(0, 80)}"`);
    if (fallbackAplicado === 'NONE') {
      fallbackAplicado = 'HANDOFF_NARRATION_FILTER';
    }
  }

  return { respostaLimpa, fallbackAplicado };
}
