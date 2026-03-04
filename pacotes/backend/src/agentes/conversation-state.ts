/**
 * CONVERSATION STATE — Análise de estado e NLP da conversa
 * 
 * Extraído do orchestrator.ts para separação de responsabilidades.
 * Contém toda a lógica de análise de estado da conversa:
 * - Extração de intenção, metragem, ocupação, valor
 * - Detecção de repetições e perguntas críticas
 * - Fallbacks contextuais baseados no estado
 * - Heurísticas de transição entre agentes
 * 
 * @version 1.0
 * @date 04/03/2026
 */

// ====================================
// TIPOS
// ====================================

export interface EstadoConversa {
    intencao: string | null;
    metragem: number | null;
    ocupacao: string | null;
    valorPretendido: string | null;
    jaRespondeuDecisao: boolean;
    perguntasJaFeitas: {
        prioridade: boolean;
        decisaoVenda: boolean;
        valor: boolean;
    };
}

// ====================================
// NORMALIZAÇÃO
// ====================================

export function normalizarTexto(texto?: string): string {
    return (texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// ====================================
// EXTRAÇÃO DE ESTADO
// ====================================

export function extrairEstadoConversa(
    mensagens: Array<{ role: 'user' | 'assistant'; content: string }>
): EstadoConversa {
    const textoUsuarios = mensagens
        .filter((m) => m.role === 'user')
        .map((m) => m.content || '')
        .join(' \n ')
        .toLowerCase();

    const textoAssistente = mensagens
        .filter((m) => m.role === 'assistant')
        .map((m) => m.content || '')
        .join(' \n ')
        .toLowerCase();

    const intencao = /\bvender\b/.test(textoUsuarios)
        ? 'vender'
        : /\balugar|loca(ç|c)(ã|a)o\b/.test(textoUsuarios)
            ? 'alugar'
            : null;

    const metragemMatch = textoUsuarios.match(/\b(\d{2,3})\s?m2?|\b(\d{2,3})\s?m²/i);
    const metragem = metragemMatch ? Number((metragemMatch[1] || metragemMatch[2])) : null;

    const ocupacao = /desocupad|vazio/.test(textoUsuarios)
        ? 'vazio'
        : /morando|ocupad/.test(textoUsuarios)
            ? 'ocupado'
            : null;

    const valorMatch = textoUsuarios.match(/(\d{3,4})\s?(k|mil)|r\$\s?([\d\.]{3,7})/i);
    const valorPretendido = valorMatch ? valorMatch[0] : null;

    const jaRespondeuDecisao =
        /ja\s+estou\s+anunciando|ja\s+decidi|decidid[oa]\s+a\s+vend|estou\s+decidid[oa]\s+a\s+vend|esta\s+decido\s+a\s+vend|preciso\s+(de\s+)?vender|quero\s+vender|tenho\s+que\s+vender|necessidade\s+de\s+vender|tenho\s+interesse\s+em\s+vender|vender\s+mesmo|sim.*\bvend/.test(textoUsuarios);

    const perguntasJaFeitas = {
        prioridade: /posso\s+te\s+fazer\s+uma\s+pergunta\s+r[aá]pida/.test(textoAssistente),
        decisaoVenda: /j[aá]\s+decidiu\s+vender|ainda\s+t[aá]\s+s[oó]\s+avaliando/.test(textoAssistente),
        valor: /j[aá]\s+tem\s+algum\s+valor\s+em\s+mente/.test(textoAssistente)
    };

    return {
        intencao,
        metragem,
        ocupacao,
        valorPretendido,
        jaRespondeuDecisao,
        perguntasJaFeitas
    };
}

// ====================================
// DETECÇÃO DE RESPOSTAS CURTAS
// ====================================

export function respostaPositivaCurta(texto?: string): boolean {
    const t = normalizarTexto(texto);
    if (!t) return false;

    if (/\b(nao|agora nao|depois|talvez)\b/.test(t)) return false;

    return /^(sim|pode|pode sim|pode ser|claro|ok|okay|beleza|bora|vamos|fechado|quero|com certeza|manda)(\b|$)/.test(t);
}

// ====================================
// TRANSIÇÃO DETERMINÍSTICA OPENER → PRESENTER
// ====================================

export function deveForcarTransicaoParaPresenter(
    mensagens: Array<{ role: 'user' | 'assistant'; content: string }>
): boolean {
    if (!mensagens || mensagens.length < 2) return false;

    let idxUltimaUser = -1;
    for (let i = mensagens.length - 1; i >= 0; i--) {
        if (mensagens[i].role === 'user') {
            idxUltimaUser = i;
            break;
        }
    }

    if (idxUltimaUser <= 0) return false;

    let ultimaAssistente = '';
    for (let i = idxUltimaUser - 1; i >= 0; i--) {
        if (mensagens[i].role === 'assistant') {
            ultimaAssistente = mensagens[i].content;
            break;
        }
    }

    if (!ultimaAssistente) return false;

    const perguntaTransicao = normalizarTexto(ultimaAssistente);
    const ehPerguntaPrioridade =
        /posso te fazer uma pergunta rapida/.test(perguntaTransicao) ||
        /entender sua prioridade/.test(perguntaTransicao) ||
        /prioridade agora/.test(perguntaTransicao);

    if (!ehPerguntaPrioridade) return false;

    return respostaPositivaCurta(mensagens[idxUltimaUser].content);
}

// ====================================
// DETECÇÃO DE REPETIÇÃO
// ====================================

export function respostaRepetePerguntaCritica(
    resposta: string,
    mensagens: Array<{ role: 'user' | 'assistant'; content: string }>
): boolean {
    const respostaNorm = normalizarTexto(resposta);
    if (!respostaNorm) return false;

    const ultimasAssistente = mensagens
        .filter((m) => m.role === 'assistant')
        .slice(-6)
        .map((m) => normalizarTexto(m.content));

    const repetiuMesmoTexto = ultimasAssistente.includes(respostaNorm);

    const repetiuPerguntaPrioridade =
        /posso te fazer uma pergunta rapida/.test(respostaNorm) &&
        ultimasAssistente.some((t) => /posso te fazer uma pergunta rapida/.test(t));

    const repetiuPerguntaDecisao =
        /ja decidiu vender|ainda ta so avaliando/.test(respostaNorm) &&
        ultimasAssistente.some((t) => /ja decidiu vender|ainda ta so avaliando/.test(t));

    return repetiuMesmoTexto || repetiuPerguntaPrioridade || repetiuPerguntaDecisao;
}

// ====================================
// FALLBACK CONTEXTUAL
// ====================================

/**
 * Gera fallback contextual baseado no estado real da conversa.
 * NUNCA pergunta algo que o lead já respondeu.
 */
export function gerarFallbackContextual(
    estado: EstadoConversa,
    agente: string
): string {
    const temIntencao = !!estado.intencao;
    const temValor = !!estado.valorPretendido;
    const temOcupacao = !!estado.ocupacao;
    const jaDecidiu = estado.jaRespondeuDecisao;

    // Se já temos dados suficientes → empurrar para apresentação
    if (temIntencao && (temValor || jaDecidiu)) {
        return 'Entendi seu cenário completo! Posso te mostrar como a gente trabalha pra conseguir vender mais rápido?';
    }

    // Perguntar o que FALTA (ordem de prioridade)
    if (!temIntencao) {
        return 'Pra eu entender melhor: você tá pensando em vender ou alugar?';
    }
    if (!temOcupacao) {
        return 'E sobre o imóvel: ele tá ocupado ou vazio no momento?';
    }
    if (!temValor) {
        return 'Legal! E você tem algum valor em mente pra venda?';
    }

    // Caso geral com dados parciais
    return 'Entendi! Posso te mostrar como a gente trabalha pra conseguir mais visitas qualificadas no seu imóvel?';
}
