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

import type { Lead } from '@prisma/client';

// ====================================
// TIPOS
// ====================================

export interface EstadoConversa {
    intencao: string | null;
    metragem: number | null;
    ocupacao: 'vazio' | 'ocupado' | 'alugado' | null;
    valorPretendido: string | null;
    /** Status de anúncio do imóvel (sim/não/desconhecido) */
    statusAnuncio?: 'sim' | 'nao' | null;
    /** Origem da divulgação quando o lead está anunciando */
    origemAnuncio?: 'conta_propria' | 'imobiliaria_corretores' | 'ambos' | null;
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
    /** Flag indicando se proprietário está ativo (usada pelo SDR para adaptar abordagem) */
    proprietarioAtivo?: boolean;
}

function extrairOrigemAnuncio(textoUsuarios: string): EstadoConversa['origemAnuncio'] {
    const porContaPropria = /\b(por conta proprio|por conta propria|sozinh[oa]|eu mesmo anuncio|eu anuncio|anuncio sozinho|olx|zap|viva real|imovelweb)\b/.test(textoUsuarios);
    const comCorretorOuImobiliaria = /\b(corretor(?:es)?|imobiliaria(?:s)?|imob|com corretor|com uma imobiliaria|varios corretores|muitos corretores)\b/.test(textoUsuarios);

    if (porContaPropria && comCorretorOuImobiliaria) return 'ambos';
    if (comCorretorOuImobiliaria) return 'imobiliaria_corretores';
    if (porContaPropria) return 'conta_propria';
    return null;
}

function extrairStatusAnuncio(textoUsuarios: string): EstadoConversa['statusAnuncio'] {
    const padroesNao = /\b(nao\s+estou\s+anunciando|não\s+estou\s+anunciando|ainda\s+nao\s+anunciei|ainda\s+não\s+anunciei|nao\s+anunciei|não\s+anunciei|nao\s+coloquei\s+anuncio|não\s+coloquei\s+anuncio|nao\s+to\s+anunciando|não\s+to\s+anunciando)\b/.test(textoUsuarios);
    if (padroesNao) return 'nao';

    const padroesSim = /\b(ja\s+to\s+anunciando|ja\s+estou\s+anunciando|ja\s+anuncio|estou\s+anunciando|to\s+anunciando|tenho\s+anuncio|ja\s+coloquei\s+anuncio|anunciei)\b/.test(textoUsuarios);
    if (padroesSim) return 'sim';

    return null;
}

function pareceValorMonetario(texto?: string | null): boolean {
    const t = normalizarTexto(texto || '');
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

function extrairMetragemConfiavel(texto?: string | null): number | null {
    const t = normalizarTexto(texto || '');
    if (!t) return null;

    const matchComUnidade = t.match(
        /\b(\d{1,4}(?:[.,]\d{1,2})?)\s*(m2\b|m²|m\b|metros?\b|metro\s+quadrado\b|metros\s+quadrados\b)/
    );
    if (matchComUnidade) {
        const valor = Number(matchComUnidade[1].replace(',', '.'));
        return Number.isFinite(valor) ? Math.round(valor) : null;
    }

    if (pareceValorMonetario(t)) return null;

    const matchAreaPalavra = t.match(/\b(?:area|metragem)\s*(?:de)?\s*(\d{2,4}(?:[.,]\d{1,2})?)\b/);
    if (matchAreaPalavra) {
        const valor = Number(matchAreaPalavra[1].replace(',', '.'));
        return Number.isFinite(valor) ? Math.round(valor) : null;
    }

    const matchNumeroPuro = t.match(/^\s*(\d{2,4}(?:[.,]\d{1,2})?)\s*$/);
    if (matchNumeroPuro) {
        const valor = Number(matchNumeroPuro[1].replace(',', '.'));
        return Number.isFinite(valor) ? Math.round(valor) : null;
    }

    return null;
}

/**
 * Enriquece o estado extraído da conversa com dados persistidos no banco (leadRecord).
 * Campos nulos na conversa são preenchidos com o valor do banco.
 * Isso garante que guardrails e ESTADO RESUMIDO reflitam dados de sessões anteriores.
 */
export function enriquecerEstadoComLeadRecord(
    estado: EstadoConversa,
    leadRecord: Lead | null | undefined
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
            const metragemExtraida = extrairMetragemConfiavel(String(leadRecord.areaImovel));
            if (metragemExtraida) enriquecido.metragem = metragemExtraida;
        }
    }

    // Ocupação
    if (!enriquecido.ocupacao && leadRecord.ocupacaoImovel) {
        enriquecido.ocupacao = String(leadRecord.ocupacaoImovel).toLowerCase() as EstadoConversa['ocupacao'];
    }

    // Decisão de venda implícita se já existia lead ativo de venda
    if (!enriquecido.jaRespondeuDecisao && (
        leadRecord.interesseEm === 'vender' || leadRecord.interesseEm === 'venda'
        || leadRecord.comissaoAcordada || leadRecord.tipoAutorizacao
    )) {
        enriquecido.jaRespondeuDecisao = true;
    }

    // Origem de anúncio (quando disponível no banco)
    if (!enriquecido.origemAnuncio) {
        const leadAny = leadRecord as any;
        if (typeof leadAny?.comCorretorAtualmente === 'boolean') {
            enriquecido.origemAnuncio = leadAny.comCorretorAtualmente ? 'imobiliaria_corretores' : 'conta_propria';
        }
    }
    if (!enriquecido.statusAnuncio) {
        const leadAny = leadRecord as any;
        if (typeof leadAny?.comCorretorAtualmente === 'boolean') {
            enriquecido.statusAnuncio = 'sim';
        }
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
              statusAnuncio: null,
              origemAnuncio: null,
              jaRespondeuDecisao: false,
              estaAnunciando: false,
              timeline: null,
              perguntasJaFeitas: { prioridade: false, decisaoVenda: false, valor: false },
              collectedFields: []
          };

    function setField<K extends keyof EstadoConversa>(key: K, value: EstadoConversa[K]) {
        if (value !== null && value !== undefined) {
            (base as unknown as Record<string, unknown>)[key] = value;
            if (!base.collectedFields.includes(key as string)) {
                base.collectedFields.push(key as string);
            }
        }
    }

    setField('intencao', estado.intencao);
    setField('metragem', estado.metragem);
    setField('ocupacao', estado.ocupacao);
    setField('valorPretendido', estado.valorPretendido);
    setField('statusAnuncio', estado.statusAnuncio ?? null);
    setField('origemAnuncio', estado.origemAnuncio ?? null);
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

    const metragem = extrairMetragemConfiavel(textoUsuarios);

    const ocupacao = /desocupad|vazio/.test(textoUsuarios)
        ? 'vazio'
        : /morando|ocupad/.test(textoUsuarios)
            ? 'ocupado'
            : /alugad|inquilin|locat|locado/.test(textoUsuarios)
                ? 'alugado'
                : null;

    const valorMatch = textoUsuarios.match(/(\d{3,4})\s?(k|mil)|r\$\s?([\d\.]{3,7})/i);
    const valorPretendido = valorMatch ? valorMatch[0] : null;
    const origemAnuncio = extrairOrigemAnuncio(textoUsuarios);

    // Detecta status de anúncio (sim/não/desconhecido)
    const statusAnuncio = extrairStatusAnuncio(textoUsuarios);
    const estaAnunciando = statusAnuncio === 'sim';

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
        statusAnuncio,
        origemAnuncio,
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
 * Se recebe a última mensagem do assistente, tenta manter a continuidade conversacional.
 */
export function gerarFallbackContextual(
    estado: EstadoConversa,
    agente: string,
    ultimaMsgAssistente?: string
): string {
    // ── Continuidade conversacional: honrar promessas feitas na última mensagem ──
    if (ultimaMsgAssistente) {
        const norm = normalizarTexto(ultimaMsgAssistente);
        // O agente prometeu perguntar sobre o anúncio
        if (/pergunta.*anuncio|como anda.*anuncio|sobre.*anuncio/.test(norm)) {
            return 'Como tá o retorno do anúncio? Tá tendo visitas ou tá mais parado?';
        }
        // O agente prometeu uma pergunta rápida genérica
        if (/pergunta rapida|uma pergunta|entender.*situacao|entender.*cenario/.test(norm)) {
            if (estado.estaAnunciando) {
                return 'Quanto tempo faz que você tá anunciando? Tá recebendo bastante procura?';
            }
            if (!estado.metragem) {
                return 'Pra eu te orientar com precisão: qual é a metragem do apartamento?';
            }
            if (!estado.ocupacao) {
                return 'Hoje ele está ocupado, alugado ou vago?';
            }
            if (estado.valorPretendido && !estado.timeline) {
                return 'E em quanto tempo você gostaria de concluir essa venda?';
            }
            if (!estado.valorPretendido) {
                return 'Você já tem um valor em mente pra venda?';
            }
            return 'Como tá sendo o processo até agora? Já teve alguma proposta?';
        }
    }

    const temIntencao = !!estado.intencao;
    const temValor = !!estado.valorPretendido;
    const temMetragem = !!estado.metragem;
    const temOcupacao = !!estado.ocupacao;
    const temOrigemAnuncio = !!estado.origemAnuncio;
    const descobertaMinimaCompleta =
        temIntencao &&
        temValor &&
        temMetragem &&
        temOcupacao &&
        estado.statusAnuncio !== null &&
        (estado.estaAnunciando ? temOrigemAnuncio : true);

    // Só avança quando a descoberta mínima foi fechada
    if (descobertaMinimaCompleta) {
        return 'Entendi seu cenário! Posso te mostrar o que diferencia a gente e como chegamos em mais compradores qualificados?';
    }

    // Perguntar o que FALTA (ordem de prioridade)
    if (!temIntencao) {
        return 'Pra eu entender melhor: você tá pensando em vender ou alugar?';
    }
    if (!temValor) {
        return 'Legal! E você tem algum valor em mente pra venda?';
    }
    if (estado.statusAnuncio === null) {
        return 'Você já está anunciando esse apartamento ou ainda não?';
    }
    if (estado.estaAnunciando && !temOrigemAnuncio) {
        return 'Você está anunciando por conta própria ou com imobiliária/corretores?';
    }
    if (!temMetragem) {
        return 'Perfeito. Pra eu montar a referência certa, qual é a metragem do apartamento?';
    }
    if (!temOcupacao) {
        return 'E hoje ele está ocupado, alugado ou vago?';
    }

    // Caso geral com dados parciais
    return 'Pra eu fechar seu diagnóstico sem chute: você está anunciando por conta própria ou com imobiliária/corretores?';
}

/**
 * Fallback específico para quando a guarda anti-repetição é acionada.
 * Garante que a mensagem é DIFERENTE da que foi bloqueada e avança a conversa.
 *
 * REGRA PRINCIPAL: Se o lead já deu dados suficientes (valor + timeline + anúncio),
 * o fallback deve AVANÇAR para apresentação, NÃO fazer mais perguntas.
 */
export function gerarFallbackAntiRepeticao(
    estado: EstadoConversa,
    agente: string,
    mensagensBloqueadas: string[]
): string {
    const opcoes: string[] = [];

    const temDadosSuficientes =
        estado.intencao &&
        estado.valorPretendido &&
        estado.statusAnuncio !== null &&
        estado.metragem &&
        estado.ocupacao &&
        (!estado.estaAnunciando || !!estado.origemAnuncio);

    if (temDadosSuficientes) {
        // Lead já respondeu tudo → AVANÇAR (oferecer apresentação/diagnóstico)
        opcoes.push(
            'Vi que você já tem bastante clareza sobre o que quer. Posso te mostrar como a gente trabalha pra acelerar essa venda?',
            'Beleza, já entendi bem o seu cenário! Deixa eu te mostrar o diferencial da nossa estratégia pra conseguir compradores qualificados.',
            'Perfeito, com essas informações já consigo te ajudar. Quer que eu te explique como funciona nosso processo de captação de compradores?',
            'Ótimo, já tenho o suficiente pra te direcionar. Posso te apresentar nossa estratégia personalizada pro seu imóvel?',
        );
    } else if (estado.estaAnunciando) {
        opcoes.push(
            'Pra agilizar: onde tá anunciando hoje e como tá o retorno até agora?',
            'Me conta: o que mais tá te incomodando na venda até agora?',
            'E as visitas, como tão? Tá recebendo bastante interesse?',
            'Entendi! E o que te fez procurar uma alternativa agora?',
        );
    } else if (estado.timeline) {
        opcoes.push(
            'Com esse prazo, cada semana conta. Me conta: como tá a divulgação do seu imóvel hoje?',
            'Pra eu entender melhor sua situação: onde tá anunciando e como tá o retorno?',
            'Legal! E como tá a divulgação do seu imóvel hoje? Tá tendo visitas?',
            'Entendi seu prazo! Já chegou a anunciar o imóvel ou tá começando agora?',
        );
    } else {
        opcoes.push(
            'Me conta: o que te fez pensar em vender agora?',
            'E como tá a situação do imóvel hoje? Já chegou a anunciar ou ainda não?',
            'Legal! E você tem algum prazo pra concluir a venda?',
            'Entendi! E qual valor você tem em mente pro imóvel?',
        );
    }

    // Filtra opções que já foram usadas (normaliza para comparação)
    const normBloqueadas = mensagensBloqueadas.map(m => normalizarTexto(m));
    const opcoesFiltradas = opcoes.filter(o => !normBloqueadas.includes(normalizarTexto(o)));

    if (opcoesFiltradas.length > 0) return opcoesFiltradas[0];

    // Se TODAS as opções foram bloqueadas, usar fallback final que avança a conversa
    return 'Entendi seu cenário! Posso te mostrar como a gente trabalha pra acelerar a venda do seu imóvel?';
}
