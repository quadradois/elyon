import { gerarFallbackContextual } from './conversation-state';
import type { EstadoConversa } from './conversation-state';
import type { TipoAgente } from './agent-chain';
import { sanitizarRespostaParaCliente } from './client-response-sanitizer';
import { logger } from '../lib/logger';
import { ehConsultaStatusAgendamento } from '../servicos/intencao-status-agendamento';
import { ehConsultaDisponibilidadeAgendamento } from '../servicos/intencao-disponibilidade-agendamento';

interface AplicarFiltrosRespostaParams {
  respostaFinal: string;
  houveHandoff: boolean;
  tipoAgente: TipoAgente;
  agenteQueRespondeuFormatado: TipoAgente;
  estadoConversaAtual: EstadoConversa;
  cotLog?: string | null;
  nomesToolsTurno: string[];
  nomesToolsSucessoTurno?: string[];
  fallbackAplicadoAtual: string;
  ultimaMsgAssistente?: string;
  ultimaMsgLead?: string;
}

interface AplicarFiltrosRespostaResult {
  respostaLimpa: string;
  fallbackAplicado: string;
}

function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function aplicarGuardrailLinguagemGovernanca(resposta: string, ultimaMsgLead?: string): string {
  let saida = resposta.trim();
  if (!saida) return '';

  const leadNormalizado = normalizarTexto(ultimaMsgLead || '');

  // Remove preâmbulos de justificativa longa antes da pergunta principal.
  saida = saida
    .replace(/(^|\n)\s*(entendo|certo|beleza|perfeito|show|ok)?\s*[—-]?\s*pergunto porque[^:\n?!.]{0,180}[:;]\s*/gi, '$1')
    .replace(/\bpergunto porque[^:\n?!.]{0,180}[:;]\s*/gi, '');

  // Remove gírias reativas de baixa qualidade.
  saida = saida.replace(/\bputz\b[,.!?]*/gi, 'Entendo.');

  // Só valida emoção quando houver evidência no texto do lead.
  const leadIndicouEmocao = /\b(chatead|frustrad|irritad|nervos|ansios)/.test(leadNormalizado);
  if (!leadIndicouEmocao) {
    const padraoEstadoEmocional = '(?:voce|voc[eê])\\s+(?:esteja|est[aá]|t[aá]|fique)';
    saida = saida
      .replace(new RegExp(`\\bfaz sentido que ${padraoEstadoEmocional}\\s+(?:chatead[oa]|frustrad[oa]|irritad[oa]|nervos[oa])\\.?`, 'gi'), 'Entendo.')
      .replace(new RegExp(`\\bentendo que ${padraoEstadoEmocional}\\s+(?:chatead[oa]|frustrad[oa]|irritad[oa]|nervos[oa])\\.?`, 'gi'), 'Entendo.');
  }

  // Evita afirmar "imóvel parado" sem evidência explícita.
  const leadIndicouParado = /\b(parad|encalhad|sem proposta|sem visita|nao vende|não vende)\b/.test(leadNormalizado);
  if (!leadIndicouParado) {
    saida = saida
      .replace(/\b(enquanto\s+)?(o\s+)?(im[oó]vel|apartamento)\s+(fica|est[aá])\s+parad[oa]\b/gi, '$3 esta anunciado')
      .replace(/\b(im[oó]vel|apartamento)\s+parad[oa]\b/gi, '$1 anunciado');
  }

  return saida
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function aplicarGuardrailConfirmacaoAgenda(resposta: string, nomesToolsSucessoTurno: string[]): string {
  const normalizada = normalizarTexto(resposta);
  const confirmouViaTool = nomesToolsSucessoTurno.some((nome) => /agendar_reuniao_closer/i.test(nome));
  const mencionaCalendar = /google\s+calendar|calendario|link/.test(normalizada);
  const alegaReservaAutomatica = /horario\s+(?:fica|ficou|esta)\s+travad|confirmad[oa]\s+automaticamente|especialista\s+ja\s+(?:recebeu|foi\s+avisado)|nao\s+preciso\s+validar/.test(normalizada);

  if (!confirmouViaTool && mencionaCalendar && alegaReservaAutomatica) {
    return 'O link apenas abre um evento pré-preenchido no Google Calendar; eu não consigo confirmar por aqui se ele foi salvo nem reservar a agenda do especialista. Qual data e horário você escolheu?';
  }
  return resposta;
}

function aplicarGuardrailConsultaStatusAgenda(
  resposta: string,
  nomesToolsSucessoTurno: string[],
  ultimaMsgLead?: string,
): string {
  const consultouViaTool = nomesToolsSucessoTurno.some((nome) => /consultar_status_agendamento/i.test(nome));
  if (ehConsultaStatusAgendamento(ultimaMsgLead) && !consultouViaTool) {
    return 'Ainda não consultei o status atualizado no sistema. Vou verificar antes de te confirmar.';
  }
  return resposta;
}

function aplicarGuardrailConsultaDisponibilidade(
  resposta: string,
  nomesToolsSucessoTurno: string[],
  ultimaMsgLead?: string,
): string {
  const consultouViaTool = nomesToolsSucessoTurno.some(
    (nome) => /consultar_horarios_disponiveis/i.test(nome)
  );
  if (ehConsultaDisponibilidadeAgendamento(ultimaMsgLead) && !consultouViaTool) {
    return 'Vou consultar agora os horários livres do especialista antes de te oferecer opções.';
  }
  return resposta;
}

function aplicarGuardrailCancelamentoAgenda(resposta: string, nomesToolsSucessoTurno: string[]): string {
  const normalizada = normalizarTexto(resposta);
  const possuiEvidenciaViaTool = nomesToolsSucessoTurno.some(
    (nome) => /cancelar_agendamento|consultar_status_agendamento/i.test(nome)
  );
  const alegaCancelamento =
    /(?:agendamento|horario|atendimento).{0,45}(?:foi|esta|ficou).{0,20}cancelad/.test(normalizada)
    || /(?:ja\s+)?cancelei|cancelamento.{0,30}(?:feito|concluido|confirmado)/.test(normalizada);

  if (!possuiEvidenciaViaTool && alegaCancelamento) {
    return 'Ainda não consegui registrar o cancelamento no sistema. Você confirma que deseja cancelar o agendamento atual?';
  }
  return resposta;
}

/**
 * Filtros de resposta pós-agente.
 * v2.0 — Simplificado após unificação SDR (Opener+Presenter merge).
 * Gates removidos: OPENER_CONVERSION_GATE, OPENER_PRESENTER_TRANSITION, RUNTIME_SPIN_TOOL_GATE.
 * Mantidos: EMPTY_AFTER_HANDOFF, SDR_TOOL_EMPTY_OUTPUT, GENERIC_FALLBACK, HANDOFF_NARRATION_FILTER.
 */
export function aplicarFiltrosRespostaOrchestrator(
  params: AplicarFiltrosRespostaParams
): AplicarFiltrosRespostaResult {
  const {
    respostaFinal,
    houveHandoff,
    agenteQueRespondeuFormatado,
    estadoConversaAtual,
    nomesToolsTurno,
    nomesToolsSucessoTurno = [],
    fallbackAplicadoAtual,
    ultimaMsgAssistente,
    ultimaMsgLead,
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

  // Sanitiza primeiro para remover vazamentos técnicos e metadados internos.
  const respostaSanitizada = sanitizarRespostaParaCliente(respostaFinal);

  const linhas = respostaSanitizada.split('\n');
  const linhasLimpas = linhas.filter((linha) => {
    const linhaTrimmed = linha.trim();
    if (!linhaTrimmed) return true;
    return !padroesHandoff.some((p) => p.test(linhaTrimmed));
  });
  let respostaLimpa = linhasLimpas.join('\n').trim();
  respostaLimpa = sanitizarRespostaParaCliente(respostaLimpa);
  const respostaAntesGovernanca = respostaLimpa;
  respostaLimpa = aplicarGuardrailLinguagemGovernanca(respostaLimpa, ultimaMsgLead);
  const respostaAntesGuardrailAgenda = respostaLimpa;
  respostaLimpa = aplicarGuardrailConfirmacaoAgenda(respostaLimpa, nomesToolsSucessoTurno);
  if (respostaAntesGuardrailAgenda !== respostaLimpa) {
    logger.warn('[ORCHESTRATOR] Guardrail bloqueou confirmação de agenda sem registro via tool.');
    fallbackAplicado = 'AGENDA_CONFIRMATION_GUARD';
  }
  const respostaAntesGuardrailConsultaAgenda = respostaLimpa;
  respostaLimpa = aplicarGuardrailConsultaStatusAgenda(respostaLimpa, nomesToolsSucessoTurno, ultimaMsgLead);
  if (respostaAntesGuardrailConsultaAgenda !== respostaLimpa) {
    logger.warn('[ORCHESTRATOR] Guardrail bloqueou resposta de status de agenda sem consulta ao banco.');
    fallbackAplicado = 'AGENDA_STATUS_GUARD';
  }
  const respostaAntesGuardrailDisponibilidade = respostaLimpa;
  respostaLimpa = aplicarGuardrailConsultaDisponibilidade(
    respostaLimpa,
    nomesToolsSucessoTurno,
    ultimaMsgLead,
  );
  if (respostaAntesGuardrailDisponibilidade !== respostaLimpa) {
    logger.warn('[ORCHESTRATOR] Guardrail exigiu consulta de horários antes de responder ao lead.');
    fallbackAplicado = 'AGENDA_AVAILABILITY_GUARD';
  }
  const respostaAntesGuardrailCancelamento = respostaLimpa;
  respostaLimpa = aplicarGuardrailCancelamentoAgenda(respostaLimpa, nomesToolsSucessoTurno);
  if (respostaAntesGuardrailCancelamento !== respostaLimpa) {
    logger.warn('[ORCHESTRATOR] Guardrail bloqueou confirmação de cancelamento sem registro via tool.');
    fallbackAplicado = 'AGENDA_CANCELLATION_GUARD';
  }
  if (respostaAntesGovernanca !== respostaLimpa) {
    logger.debug(`[ORCHESTRATOR] 🛡️ Guardrail de linguagem aplicado. Antes="${respostaAntesGovernanca.substring(0, 80)}" Depois="${respostaLimpa.substring(0, 80)}"`);
  }

  // ── Filtro 1: Resposta curta sem pergunta após handoff (narração provável) ──
  if (houveHandoff && respostaLimpa.length > 0 && respostaLimpa.length < 60 && !respostaLimpa.includes('?')) {
    logger.debug(`[ORCHESTRATOR] 🚫 Heurística: resposta curta sem pergunta após handoff, provavelmente narração: "${respostaLimpa}"`);
    respostaLimpa = '';
  }

  // ── Filtro 2: Resposta vazia após handoff (SDR→Admin) ──
  if (!respostaLimpa && houveHandoff) {
    logger.warn('[ORCHESTRATOR] ⚠️ Resposta vazia após handoff. Aplicando fallback contextual.');
    fallbackAplicado = 'EMPTY_AFTER_HANDOFF';

    if (agenteQueRespondeuFormatado === 'ADMIN') {
      respostaLimpa = 'Ótimo! Pra eu seguir com seu onboarding, posso começar confirmando seu CPF e e-mail?';
    } else {
      respostaLimpa = gerarFallbackContextual(estadoConversaAtual, agenteQueRespondeuFormatado, ultimaMsgAssistente);
    }
  }

  // ── Filtro 3: Resposta vazia sem handoff (falha LLM ou tool sem output) ──
  if (!respostaLimpa && !houveHandoff) {
    const sdrExecutouToolCritica =
      agenteQueRespondeuFormatado === 'SDR' &&
      nomesToolsTurno.some((nome) => /mover_para_fase|qualificar_lead/i.test(nome));

    if (sdrExecutouToolCritica) {
      logger.warn('[ORCHESTRATOR] ⚠️ SDR executou tool crítica, mas retornou resposta vazia. Aplicando fallback de continuidade.');
      respostaLimpa = gerarFallbackContextual(estadoConversaAtual, agenteQueRespondeuFormatado, ultimaMsgAssistente);
      fallbackAplicado = 'SDR_TOOL_EMPTY_OUTPUT';
    } else {
      logger.warn('[ORCHESTRATOR] ⚠️ LLM falhou em gerar resposta ou tool call. Usando fallback contextual.');
      respostaLimpa = gerarFallbackContextual(estadoConversaAtual, agenteQueRespondeuFormatado, ultimaMsgAssistente);
      fallbackAplicado = 'GENERIC_FALLBACK';
    }
  }

  // ── Log de filtro aplicado ──
  if (respostaLimpa !== respostaFinal.trim()) {
    logger.debug(`[ORCHESTRATOR] 🧹 Filtro aplicado. Original: "${respostaFinal.trim().substring(0, 80)}" → Limpo: "${respostaLimpa.substring(0, 80)}"`);
    if (fallbackAplicado === 'NONE') {
      fallbackAplicado = 'HANDOFF_NARRATION_FILTER';
    }
  }

  return { respostaLimpa, fallbackAplicado };
}
