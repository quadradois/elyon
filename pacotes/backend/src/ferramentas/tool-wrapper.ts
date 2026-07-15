/**
 * TOOL WRAPPER — Pre-validation, Result Validation & Structured Audit
 * 
 * Wrapper que envolve qualquer tool do @openai/agents SDK com:
 * 1. Pre-validation: valida args ANTES de executar (ex: impedir agendar sem data real)
 * 2. Result validation: intercepta success:false e melhora a mensagem pro LLM
 * 3. Structured audit: log JSON estruturado de cada tool call (args + result + timing)
 * 
 * @version 1.0
 * @date 11/04/2026
 */

import { logger } from '../lib/logger';

// ====================================
// TIPOS
// ====================================

export interface ToolPreValidator {
    /** Nome da tool (para matching) */
    toolName: string;
    /** Valida args antes da execução. Retorna null se OK, ou mensagem de erro se bloqueado. */
    validate: (args: Record<string, any>) => string | null;
}

export interface ToolResultEnricher {
    /** Nome da tool (para matching) */
    toolName: string;
    /** Transforma o resultado da tool antes de devolver ao LLM. Recebe o JSON parseado. */
    enrich: (result: any, args: Record<string, any>) => any;
}

function pareceValorMonetario(texto?: string | null): boolean {
    const t = (texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    if (!t) return false;

    if (/r\$\s*\d/.test(t)) return true;
    if (/\b\d+(?:[.,]\d+)?\s*(k|mil|mi|milhao|milhoes|reais?)\b/.test(t)) return true;
    if (
        /\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b/.test(t)
        && !/\b(m2|m²|metros?|metro\s+quadrado|metros\s+quadrados)\b/.test(t)
    ) {
        return true;
    }
    return false;
}

function tratarConfusaoAreaValor(args: Record<string, any>, toolName: string): void {
    if (!args.areaImovel || typeof args.areaImovel !== 'string') return;

    const areaOriginal = args.areaImovel.trim();
    if (!areaOriginal) return;

    if (pareceValorMonetario(areaOriginal)) {
        if (!args.valorPretendido || typeof args.valorPretendido !== 'string' || !args.valorPretendido.trim()) {
            args.valorPretendido = areaOriginal;
        }
        args.areaImovel = '';
        logger.warn(
            { toolName, areaImovel: areaOriginal, valorPretendido: args.valorPretendido },
            '[TOOL_WRAPPER] ⚠️ areaImovel detectado como valor monetário. Corrigindo para valorPretendido e limpando área.'
        );
    }
}

// ====================================
// PRE-VALIDATORS
// ====================================

/**
 * Valida que agendar_reuniao_closer só é chamada com data no formato DD/MM/YYYY HH:mm.
 * Bloqueia datas claramente inventadas (passado, muito distante).
 */
const validarAgendamento: ToolPreValidator = {
    toolName: 'agendar_reuniao_closer',
    validate: (args) => {
        const dataHora = args.dataHora;
        if (!dataHora || typeof dataHora !== 'string') {
            return 'BLOQUEADO: dataHora não informada. Pergunte ao lead qual dia e horário ele prefere.';
        }

        // Verificar formato DD/MM/YYYY HH:mm
        const regex = /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}$/;
        if (!regex.test(dataHora.trim())) {
            return `BLOQUEADO: formato de data inválido "${dataHora}". Use DD/MM/YYYY HH:mm.`;
        }

        // Parse e validar que é uma data futura razoável
        try {
            const [dataParte, horaParte] = dataHora.trim().split(/\s+/);
            const [dia, mes, ano] = dataParte.split('/').map(Number);
            const [hora, minuto] = horaParte.split(':').map(Number);
            const dataObj = new Date(ano, mes - 1, dia, hora, minuto);

            if (isNaN(dataObj.getTime())) {
                return `BLOQUEADO: data inválida "${dataHora}". Pergunte ao lead um dia e horário válido.`;
            }

            const agora = new Date();
            if (dataObj < agora) {
                return `BLOQUEADO: data "${dataHora}" é no passado. Pergunte ao lead uma data futura.`;
            }

            const maxFuturo = new Date();
            maxFuturo.setMonth(maxFuturo.getMonth() + 3);
            if (dataObj > maxFuturo) {
                return `BLOQUEADO: data "${dataHora}" é muito distante (>3 meses). Confirme a data com o lead.`;
            }

            // Verificar horário comercial razoável (7h-21h)
            if (hora < 7 || hora > 21) {
                return `BLOQUEADO: horário ${hora}:${String(minuto).padStart(2, '0')} está fora do horário comercial (7h-21h). Confirme com o lead.`;
            }
        } catch {
            return `BLOQUEADO: erro ao interpretar data "${dataHora}". Use DD/MM/YYYY HH:mm.`;
        }

        // Verificar contatoId
        if (!args.contatoId || typeof args.contatoId !== 'string' || args.contatoId.length < 10) {
            return 'BLOQUEADO: contatoId inválido ou ausente.';
        }

        return null; // OK
    }
};

/**
 * Valida que converter_para_lead tem dados mínimos reais.
 * Detecta confusão entre areaImovel (metragem) e valorPretendido (preço).
 */
const validarConversao: ToolPreValidator = {
    toolName: 'converter_para_lead',
    validate: (args) => {
        const temTexto = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;
        const idResolvido = args.leadId ?? args.contatoId;

        if (!idResolvido || typeof idResolvido !== 'string' || idResolvido.length < 10) {
            return 'BLOQUEADO: leadId inválido ou ausente.';
        }
        if (!args.tipoInteresse) {
            return 'BLOQUEADO: tipoInteresse obrigatório (VENDA/LOCACAO/AMBOS).';
        }
        tratarConfusaoAreaValor(args, 'converter_para_lead');

        if (!temTexto(args.valorPretendido)) {
            return 'BLOQUEADO: descoberta incompleta. Falta valorPretendido — pergunte o valor em mente do proprietário.';
        }
        if (!temTexto(args.ocupacaoImovel)) {
            return 'BLOQUEADO: descoberta incompleta. Falta ocupacaoImovel — confirme se está ocupado, alugado ou vago.';
        }
        if (!temTexto(args.areaImovel)) {
            return 'BLOQUEADO: descoberta incompleta. Falta areaImovel (metragem).';
        }
        if (!temTexto(args.situacaoAtual) && !temTexto(args.timeline)) {
            return 'BLOQUEADO: descoberta incompleta. Falta contexto de anúncio (por conta própria vs imobiliária/corretores) ou timeline.';
        }
        return null;
    }
};

/**
 * Valida que qualificar_lead não é chamado com ID vazio.
 * Detecta confusão entre areaImovel (metragem) e valorPretendido (preço).
 */
const validarQualificacao: ToolPreValidator = {
    toolName: 'qualificar_lead',
    validate: (args) => {
        const idResolvido = args.leadId ?? args.contatoId;
        if (!idResolvido || typeof idResolvido !== 'string' || idResolvido.length < 10) {
            return 'BLOQUEADO: leadId inválido. Verifique os DADOS DO SISTEMA.';
        }
        tratarConfusaoAreaValor(args, 'qualificar_lead');
        return null;
    }
};

/**
 * Valida que agendar_followup receba data futura válida e motivo minimamente útil.
 */
const validarFollowup: ToolPreValidator = {
    toolName: 'agendar_followup',
    validate: (args) => {
        const dataRecontato = args.dataRecontato;
        if (!dataRecontato || typeof dataRecontato !== 'string') {
            return 'BLOQUEADO: dataRecontato não informada. Pergunte ao lead em qual dia deseja ser recontatado.';
        }

        const regex = /^\d{2}\/\d{2}\/\d{4}$/;
        if (!regex.test(dataRecontato.trim())) {
            return `BLOQUEADO: formato de data inválido "${dataRecontato}". Use DD/MM/YYYY.`;
        }

        if (!args.contatoId || typeof args.contatoId !== 'string' || args.contatoId.length < 10) {
            return 'BLOQUEADO: contatoId inválido ou ausente.';
        }

        const motivo = typeof args.motivo === 'string' ? args.motivo.trim() : '';
        if (motivo.length < 5) {
            return 'BLOQUEADO: motivo insuficiente. Registre em 1 frase curta por que o lead pediu tempo.';
        }

        try {
            const [dia, mes, ano] = dataRecontato.trim().split('/').map(Number);
            const dataObj = new Date(ano, mes - 1, dia, 9, 0, 0, 0);
            if (isNaN(dataObj.getTime())) {
                return `BLOQUEADO: data inválida "${dataRecontato}".`;
            }

            const hoje = new Date();
            const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);
            if (dataObj < inicioHoje) {
                return `BLOQUEADO: data "${dataRecontato}" está no passado. Confirme uma data futura com o lead.`;
            }

            const limite = new Date(inicioHoje);
            limite.setMonth(limite.getMonth() + 12);
            if (dataObj > limite) {
                return `BLOQUEADO: data "${dataRecontato}" está muito distante (>12 meses). Confirme com o lead.`;
            }
        } catch {
            return `BLOQUEADO: erro ao interpretar data "${dataRecontato}". Use DD/MM/YYYY.`;
        }

        return null;
    }
};

/**
 * Valida que mover_para_fase tem leadId válido.
 */
const validarMoverFase: ToolPreValidator = {
    toolName: 'mover_para_fase',
    validate: (args) => {
        if (!args.leadId || typeof args.leadId !== 'string' || args.leadId.length < 10) {
            return 'BLOQUEADO: leadId inválido ou ausente.';
        }
        if (!args.faseDestino) {
            return 'BLOQUEADO: faseDestino obrigatório.';
        }
        return null;
    }
};

// ====================================
// RESULT ENRICHERS
// ====================================

/**
 * Quando agendar_reuniao_closer falha, fornece instrução clara ao LLM
 * em vez de deixar ele improvisar "deu um problema técnico".
 */
const enricherAgendamento: ToolResultEnricher = {
    toolName: 'agendar_reuniao_closer',
    enrich: (result, _args) => {
        if (result.success === false) {
            if (result.error?.includes('não encontrado')) {
                result.instrucaoParaAgente = 'O contato não foi encontrado. Isso é um erro interno — NÃO diga "problema técnico". Diga: "Me passa seu nome completo pra eu confirmar aqui?" e tente novamente após validar.';
            } else if (result.disponivel === false) {
                result.instrucaoParaAgente = `Esse horário está OCUPADO. Apresente as alternativas: ${result.alternativas || 'pergunte outro horário ao lead'}.`;
            } else if (result.error?.includes('ainda não convertido')) {
                result.instrucaoParaAgente = 'O lead ainda não foi convertido. Chame converter_para_lead primeiro, depois agende.';
            } else {
                result.instrucaoParaAgente = 'Houve erro no agendamento. NÃO invente desculpas técnicas. Pergunte ao lead: "Qual dia e horário fica bom pra você?" e tente novamente.';
            }
        }
        return result;
    }
};

/**
 * Quando qualificar_lead falha por dados insuficientes, instrui o LLM a coletar mais.
 */
const enricherQualificacao: ToolResultEnricher = {
    toolName: 'qualificar_lead',
    enrich: (result, _args) => {
        if (result.success === false && result.camposObrigatoriosMinimos) {
            result.instrucaoParaAgente = `Dados insuficientes para qualificar. Campos mínimos: ${result.camposObrigatoriosMinimos.join(' OU ')}. Continue coletando na conversa antes de chamar novamente.`;
        }
        return result;
    }
};

/**
 * converter_para_lead é idempotente:
 * se o contato já virou lead, tratamos como sucesso lógico para evitar loops/retries.
 */
const enricherConversaoLead: ToolResultEnricher = {
    toolName: 'converter_para_lead',
    enrich: (result, _args) => {
        if (result?.success === false && result?.reasonCode === 'ALREADY_LEAD') {
            return {
                ...result,
                success: true,
                message: result?.message || 'Lead já estava convertido anteriormente.',
                instrucaoParaAgente: 'Lead já convertido. Continue a conversa sem tentar converter novamente.',
            };
        }
        return result;
    }
};

/**
 * Quando mover_para_fase é bloqueado por gate SPIN, instrui o LLM sobre o que falta.
 */
const enricherMoverFase: ToolResultEnricher = {
    toolName: 'mover_para_fase',
    enrich: (result, _args) => {
        if (result.success === false && Array.isArray(result.camposFaltantesQualificacao) && result.camposFaltantesQualificacao.length > 0) {
            result.instrucaoParaAgente = `Transição bloqueada. Dados faltantes: ${JSON.stringify(result.camposFaltantesQualificacao)}. Colete esses dados na conversa antes de tentar mover novamente.`;
        }

        if (result.success === false && result.reasonCode === 'PHASE_TRANSITION_BLOCKED') {
            result.instrucaoParaAgente = `Transição bloqueada pelo gate de fase. ${result.gateDetalhes || 'Avance somente 1 etapa por vez.'}`;
        }
        return result;
    }
};

/**
 * Quando agendar_followup falha, orienta o próximo passo em linguagem operacional.
 */
const enricherFollowup: ToolResultEnricher = {
    toolName: 'agendar_followup',
    enrich: (result, _args) => {
        if (result.success === false) {
            if (result.error?.toLowerCase?.().includes('data')) {
                result.instrucaoParaAgente = 'A data de recontato é inválida. Pergunte ao lead em qual dia (DD/MM/YYYY) prefere ser chamado novamente.';
            } else {
                result.instrucaoParaAgente = 'Não foi possível registrar o follow-up agora. Confirme dia de recontato com o lead e tente novamente.';
            }
        } else if (result.success === true) {
            result.instrucaoParaAgente = 'Confirme ao lead que o recontato ficou registrado para a data combinada.';
        }
        return result;
    }
};

// ====================================
// REGISTROS
// ====================================

const PRE_VALIDATORS: ToolPreValidator[] = [
    validarAgendamento,
    validarConversao,
    validarQualificacao,
    validarFollowup,
    validarMoverFase,
];

const RESULT_ENRICHERS: ToolResultEnricher[] = [
    enricherAgendamento,
    enricherQualificacao,
    enricherConversaoLead,
    enricherFollowup,
    enricherMoverFase,
];

// ====================================
// WRAPPER PRINCIPAL
// ====================================

export type TipoEfeitoTool = 'READ_ONLY' | 'POSTGRES_MUTATION' | 'EXTERNAL_EFFECT';

const TIPOS_EFEITO_TOOL: Record<string, TipoEfeitoTool> = {
    consultar_preco_mercado: 'READ_ONLY',
    qualificar_lead: 'POSTGRES_MUTATION',
    registrar_optout: 'POSTGRES_MUTATION',
    converter_para_lead: 'POSTGRES_MUTATION',
    agendar_followup: 'POSTGRES_MUTATION',
    encaminhar_corretor: 'POSTGRES_MUTATION',
    mover_para_fase: 'POSTGRES_MUTATION',
    gerar_link_contrato: 'POSTGRES_MUTATION',
    atualizar_dados_lead: 'POSTGRES_MUTATION',
    salvar_dados_imovel: 'POSTGRES_MUTATION',
    registrar_indicacao: 'POSTGRES_MUTATION',
    enviar_link_agendamento: 'POSTGRES_MUTATION',
    enviar_para_crm: 'EXTERNAL_EFFECT',
    agendar_reuniao_closer: 'EXTERNAL_EFFECT',
};

export function classificarEfeitoTool(toolName: string, override?: TipoEfeitoTool): TipoEfeitoTool {
    const tipo = override || TIPOS_EFEITO_TOOL[toolName];
    if (!tipo) throw new Error(`TOOL_EFFECT_CLASSIFICATION_MISSING:${toolName}`);
    return tipo;
}

/**
 * Envolve a função execute de uma tool com pre-validation, result enrichment e audit log.
 * 
 * @param toolName Nome da tool para matching nos registros
 * @param originalExecute A função execute original da tool
 * @returns Nova função execute com as camadas adicionais
 */
export function wrapToolExecute<TArgs = any>(
    toolName: string,
    originalExecute: (args: TArgs, runContext?: any) => Promise<string>,
    effectTypeOverride?: TipoEfeitoTool,
): (args: TArgs, runContext?: any) => Promise<string> {
    return async (args: TArgs, runContext?: any): Promise<string> => {
        const inicio = Date.now();
        const argsLog = redactSensitiveFields(args as any);
        const assertFencing = runContext?.context?.assertFencing as (() => Promise<void>) | undefined;
        const withFencedTransaction = runContext?.context?.withFencedTransaction as (<T>(command: () => Promise<T>) => Promise<T>) | undefined;
        const executeExternalEffect = runContext?.context?.executeExternalEffect as ((toolName: string, command: () => Promise<string>) => Promise<string>) | undefined;
        const effectType = classificarEfeitoTool(toolName, effectTypeOverride);

        // ── 1. PRE-VALIDATION ──
        const validator = PRE_VALIDATORS.find(v => v.toolName === toolName);
        if (validator) {
            const erro = validator.validate(args as any);
            if (erro) {
                const duracao = Date.now() - inicio;
                logger.warn({
                    tool: toolName,
                    fase: 'pre-validation',
                    bloqueado: true,
                    motivo: erro,
                    args: argsLog,
                    duracaoMs: duracao,
                }, `[TOOL_AUDIT] ${toolName} BLOQUEADO pela pre-validation`);

                return JSON.stringify({
                    success: false,
                    bloqueadoPorValidacao: true,
                    error: erro,
                });
            }
        }

        // ── 2. EXECUÇÃO ORIGINAL ──
        let resultStr: string;
        try {
            if (effectType !== 'POSTGRES_MUTATION') await assertFencing?.();
            if (effectType === 'POSTGRES_MUTATION' && withFencedTransaction) {
                resultStr = await withFencedTransaction(() => originalExecute(args, runContext));
            } else if (effectType === 'EXTERNAL_EFFECT' && executeExternalEffect) {
                // Reserva/execução externa ocorre deliberadamente fora da transação PostgreSQL.
                resultStr = await executeExternalEffect(toolName, () => originalExecute(args, runContext));
            } else {
                resultStr = await originalExecute(args, runContext);
            }
            if (effectType !== 'POSTGRES_MUTATION') await assertFencing?.();
        } catch (e: any) {
            const duracao = Date.now() - inicio;
            logger.error({
                tool: toolName,
                fase: 'execucao',
                erro: e?.message || 'Erro desconhecido',
                args: argsLog,
                duracaoMs: duracao,
            }, `[TOOL_AUDIT] ${toolName} ERRO na execução`);
            throw e;
        }

        // ── 3. RESULT ENRICHMENT ──
        let resultEnriched = resultStr;
        const enricher = RESULT_ENRICHERS.find(r => r.toolName === toolName);
        if (enricher) {
            try {
                const parsed = JSON.parse(resultStr);
                const enriched = enricher.enrich(parsed, args as any);
                resultEnriched = JSON.stringify(enriched);
            } catch {
                // Se não for JSON válido (ex: ler_skill retorna MD), ignora
            }
        }

        // ── 4. STRUCTURED AUDIT LOG ──
        const duracao = Date.now() - inicio;
        let resultSummary: any;
        try {
            const parsed = JSON.parse(resultEnriched);
            resultSummary = {
                success: parsed.success,
                error: parsed.error,
                bloqueadoPorValidacao: parsed.bloqueadoPorValidacao,
                instrucaoParaAgente: parsed.instrucaoParaAgente ? '(presente)' : undefined,
            };
        } catch {
            resultSummary = { raw: resultEnriched.substring(0, 100) + (resultEnriched.length > 100 ? '...' : '') };
        }

        const logLevel = resultSummary.success === false ? 'warn' : 'info';
        logger[logLevel]({
            tool: toolName,
            fase: 'completo',
            args: argsLog,
            result: resultSummary,
            duracaoMs: duracao,
        }, `[TOOL_AUDIT] ${toolName} ${resultSummary.success === false ? 'FALHOU' : 'OK'} (${duracao}ms)`);

        return resultEnriched;
    };
}

/**
 * Remove campos sensíveis do log (ex: observações muito longas, conteúdo de skills).
 */
function redactSensitiveFields(args: Record<string, any>): Record<string, any> {
    if (!args || typeof args !== 'object') return args;
    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string' && value.length > 200) {
            redacted[key] = value.substring(0, 100) + `...(${value.length} chars)`;
        } else {
            redacted[key] = value;
        }
    }
    return redacted;
}
