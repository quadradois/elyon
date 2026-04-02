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
    /** Lead mencionou que JÁ está anunciando o imóvel (implica que sabe o preço e já decidiu vender) */
    estaAnunciando: boolean;
    /** Timeline de venda mencionada pelo lead (ex: "90 dias", "até março", "3 meses") */
    timeline: string | null;
    perguntasJaFeitas: {
        prioridade: boolean;
        decisaoVenda: boolean;
        valor: boolean;
    };
}

/**
 * Schema persistido entre turnos que representa tudo que já foi coletado.
 * Extende EstadoConversa adicionando flags auxiliares e lista de campos obtidos.
 */
export interface SchemaState extends EstadoConversa {
    collectedFields: string[];
}

/**
 * Enriquece o estado extraído da conversa com dados persistidos no banco (leadRecord).
 * Campos nulos na conversa são preenchidos com o valor do banco.
 * Isso garante que guardrails e ESTADO RESUMIDO reflitam dados de sessões anteriores.
 */
export function enriquecerEstadoComLeadRecord(
    estado: EstadoConversa,
    leadRecord: any
): EstadoConversa {
    if (!leadRecord) return estado;

    const enriquecido = { ...estado };

    // Intenção
    if (!enriquecido.intencao && leadRecord.interesseEm) {
        const interesse = String(leadRecord.interesseEm).toLowerCase();
        if (interesse === 'vender' || interesse === 'venda') enriquecido.intencao = 'vender';
        else if (interesse === 'alugar' || interesse === 'locacao' || interesse === 'aluguel') enriquecido.intencao = 'alugar';
    }

    // Valor pretendido
    if (!enriquecido.valorPretendido && leadRecord.valorPretendido) {
        enriquecido.valorPretendido = String(leadRecord.valorPretendido);
    }

    // Metragem — aceita campo imovelAreaTotal (Float) ou areaImovel (String)
    if (!enriquecido.metragem) {
        if (leadRecord.imovelAreaTotal) {
            enriquecido.metragem = Number(leadRecord.imovelAreaTotal);
        } else if (leadRecord.areaImovel) {
            const match = String(leadRecord.areaImovel).match(/(\d+)/);
            if (match) enriquecido.metragem = Number(match[1]);
        }
    }

    // Ocupação
    if (!enriquecido.ocupacao && leadRecord.ocupacaoImovel) {
        enriquecido.ocupacao = String(leadRecord.ocupacaoImovel).toLowerCase();
    }

    // Decisão de venda implícita se já existia lead ativo de venda
    if (!enriquecido.jaRespondeuDecisao && (
        leadRecord.interesseEm === 'vender' || leadRecord.interesseEm === 'venda') ||
        leadRecord.comissaoAcordada || leadRecord.tipoAutorizacao
    ) {
        enriquecido.jaRespondeuDecisao = true;
    }

    return enriquecido;
}

/**
 * Atualiza um schema anterior com os valores recém-extraídos de `estado`.
 * Campos não-nulos em `estado` sobrescrevem os valores anteriores e são
 * adicionados a `collectedFields`.
 */
export function atualizarSchemaState(
    previous: SchemaState | undefined,
    estado: EstadoConversa
): SchemaState {
    const base: SchemaState = previous
        ? { ...previous }
        : {
              intencao: null,
              metragem: null,
              ocupacao: null,
              valorPretendido: null,
              jaRespondeuDecisao: false,
              estaAnunciando: false,
              timeline: null,
              perguntasJaFeitas: { prioridade: false, decisaoVenda: false, valor: false },
              collectedFields: []
          };

    function setField<K extends keyof EstadoConversa>(key: K, value: EstadoConversa[K]) {
        if (value !== null && value !== undefined) {
            (base as any)[key] = value;
            if (!base.collectedFields.includes(key as string)) {
                base.collectedFields.push(key as string);
            }
        }
    }

    setField('intencao', estado.intencao);
    setField('metragem', estado.metragem);
    setField('ocupacao', estado.ocupacao);
    setField('valorPretendido', estado.valorPretendido);
    if (estado.jaRespondeuDecisao) setField('jaRespondeuDecisao', true);
    if (estado.estaAnunciando) setField('estaAnunciando', true);
    setField('timeline', estado.timeline);

    // Também marcamos perguntas feitas se estiverem true
    if (estado.perguntasJaFeitas.prioridade) setField('perguntasJaFeitas', { ...base.perguntasJaFeitas, prioridade: true });
    if (estado.perguntasJaFeitas.decisaoVenda) setField('perguntasJaFeitas', { ...base.perguntasJaFeitas, decisaoVenda: true });
    if (estado.perguntasJaFeitas.valor) setField('perguntasJaFeitas', { ...base.perguntasJaFeitas, valor: true });

    return base;
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
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const textoAssistente = mensagens
        .filter((m) => m.role === 'assistant')
        .map((m) => m.content || '')
        .join(' \n ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
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

    // Detecta se o lead mencionou que JÁ está anunciando o imóvel
    const estaAnunciando = /j[aá]\s+(t[oô]|estou|est[aá]|est[aá]\s+sendo|anuncia(ndo|do|i)|coloquei\s+an[uú]ncio|botei\s+an[uú]ncio|po(r|s)\s+an[uú]ncio)|j[aá]\s+t[eê]m\s+(imobili[aá]ria|corretor|anuncio)|j[aá]\s+est[aá]\s+(no\s+(mercado|zap|olx|viva|imovelweb))|anunci(ando|ei|ado)/.test(textoUsuarios);

    // Detecta timeline de venda mencionada pelo lead
    const timelineMatch = textoUsuarios.match(
        /(\d+)\s*(dias?|meses?|semanas?|anos?)|(at[eé]\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))|(em\s+\d+\s*(dias?|meses?|semanas?))/i
    );
    const timeline = timelineMatch ? timelineMatch[0] : null;

    const jaRespondeuDecisao =
        estaAnunciando ||
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
        estaAnunciando,
        timeline,
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

    // Lead que está anunciando → tem experiência → pular para apresentação
    if (estado.estaAnunciando || (temIntencao && (temValor || jaDecidiu || !!estado.timeline))) {
        return 'Entendi seu cenário! Posso te mostrar o que diferencia a gente e como chegamos em mais compradores qualificados?';
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
