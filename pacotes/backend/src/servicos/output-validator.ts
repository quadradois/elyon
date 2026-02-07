/**
 * OUTPUT VALIDATOR
 * 
 * Valida respostas do LLM antes de enviar ao usuário.
 * Detecta e previne alucinações factuais.
 * 
 * Verificações:
 * 1. Preços - Não pode inventar valores fora do RAG
 * 2. Nomes de empreendimentos - Deve existir no contexto
 * 3. Promessas - Detecta compromissos arriscados
 * 4. Datas - Verifica datas mencionadas
 * 
 * @version 1.0
 * @date 07/02/2026
 */

export interface ContextoValidacao {
    contextoRAG: string;
    empreendimentosConhecidos?: string[];
    faixaPrecoMin?: number;
    faixaPrecoMax?: number;
}

export interface ResultadoValidacao {
    valido: boolean;
    score: number; // 0-100 (100 = totalmente confiável)
    alertas: AlertaValidacao[];
    resposta: string; // Resposta possivelmente corrigida
}

export interface AlertaValidacao {
    tipo: 'PRECO_INVENTADO' | 'NOME_DESCONHECIDO' | 'PROMESSA_ARRISCADA' | 'DATA_SUSPEITA' | 'AFIRMACAO_INCERTA';
    mensagem: string;
    severidade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
    trecho?: string;
}

class OutputValidator {

    /**
     * Valida a resposta do LLM contra o contexto RAG
     */
    validar(resposta: string, contexto: ContextoValidacao): ResultadoValidacao {
        const alertas: AlertaValidacao[] = [];
        let score = 100;

        // 1. Verificar preços inventados
        const alertasPreco = this.verificarPrecos(resposta, contexto);
        alertas.push(...alertasPreco);
        score -= alertasPreco.length * 15;

        // 2. Verificar nomes de empreendimentos
        const alertasNomes = this.verificarNomes(resposta, contexto);
        alertas.push(...alertasNomes);
        score -= alertasNomes.length * 20;

        // 3. Verificar promessas arriscadas
        const alertasPromessas = this.verificarPromessas(resposta);
        alertas.push(...alertasPromessas);
        score -= alertasPromessas.length * 10;

        // 4. Verificar datas suspeitas
        const alertasDatas = this.verificarDatas(resposta);
        alertas.push(...alertasDatas);
        score -= alertasDatas.length * 5;

        // 5. Verificar afirmações incertas
        const alertasAfirmacoes = this.verificarAfirmacoesIncertas(resposta);
        alertas.push(...alertasAfirmacoes);
        score -= alertasAfirmacoes.length * 5;

        // Garantir score mínimo 0
        score = Math.max(0, score);

        // Tentar corrigir resposta se necessário
        let respostaFinal = resposta;
        if (alertas.some(a => a.severidade === 'CRITICA')) {
            respostaFinal = this.corrigirResposta(resposta, alertas);
        }

        return {
            valido: score >= 70,
            score,
            alertas,
            resposta: respostaFinal
        };
    }

    /**
     * Verifica se há preços mencionados que não existem no contexto RAG
     */
    private verificarPrecos(resposta: string, contexto: ContextoValidacao): AlertaValidacao[] {
        const alertas: AlertaValidacao[] = [];

        // Padrão para capturar valores em reais
        const padraoPreco = /R\$\s*([\d.,]+)\s*(mil|milhão|milhões|k|M)?/gi;
        const precosResposta: number[] = [];

        let match;
        while ((match = padraoPreco.exec(resposta)) !== null) {
            let valor = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
            const sufixo = match[2]?.toLowerCase();

            if (sufixo === 'mil' || sufixo === 'k') valor *= 1000;
            if (sufixo === 'milhão' || sufixo === 'milhões' || sufixo === 'm') valor *= 1000000;

            precosResposta.push(valor);
        }

        // Extrair preços do contexto RAG
        const precosContexto: number[] = [];
        const matchesContexto = contexto.contextoRAG.match(/R\$\s*([\d.,]+)\s*(mil|milhão|milhões|k|M)?/gi) || [];

        for (const m of matchesContexto) {
            const parsed = m.match(/R\$\s*([\d.,]+)\s*(mil|milhão|milhões|k|M)?/i);
            if (parsed) {
                let valor = parseFloat(parsed[1].replace(/\./g, '').replace(',', '.'));
                const sufixo = parsed[2]?.toLowerCase();
                if (sufixo === 'mil' || sufixo === 'k') valor *= 1000;
                if (sufixo === 'milhão' || sufixo === 'milhões' || sufixo === 'm') valor *= 1000000;
                precosContexto.push(valor);
            }
        }

        // Usar faixa de preço do contexto se disponível
        const precoMin = contexto.faixaPrecoMin || Math.min(...precosContexto, Infinity);
        const precoMax = contexto.faixaPrecoMax || Math.max(...precosContexto, 0);

        // Verificar cada preço na resposta
        for (const preco of precosResposta) {
            if (preco < 10000) continue; // Ignora valores muito pequenos (podem ser metragem, etc)

            // Verifica se está dentro da faixa conhecida (com 20% de margem)
            const margemMin = precoMin * 0.8;
            const margemMax = precoMax * 1.2;

            if (preco < margemMin || preco > margemMax) {
                // Verifica se está próximo de algum preço do contexto
                const estaProximo = precosContexto.some(pc =>
                    Math.abs(preco - pc) / pc < 0.15 // 15% de tolerância
                );

                if (!estaProximo && precosContexto.length > 0) {
                    alertas.push({
                        tipo: 'PRECO_INVENTADO',
                        mensagem: `Preço R$ ${preco.toLocaleString('pt-BR')} não encontrado no contexto`,
                        severidade: 'ALTA',
                        trecho: `R$ ${preco.toLocaleString('pt-BR')}`
                    });
                }
            }
        }

        return alertas;
    }

    /**
     * Verifica se nomes de empreendimentos mencionados existem no contexto
     */
    private verificarNomes(resposta: string, contexto: ContextoValidacao): AlertaValidacao[] {
        const alertas: AlertaValidacao[] = [];

        if (!contexto.empreendimentosConhecidos?.length) {
            // Tenta extrair nomes do contexto RAG
            // Padrão: palavras capitalizadas que podem ser nomes de empreendimentos
            const padrao = /(?:Residencial|Condomínio|Edifício|Village|Park|Garden|Plaza)\s+[A-Z][a-záéíóúãõ]+(?:\s+[A-Z][a-záéíóúãõ]+)*/g;
            const nomesContexto = contexto.contextoRAG.match(padrao) || [];
            contexto.empreendimentosConhecidos = [...new Set(nomesContexto)];
        }

        if (contexto.empreendimentosConhecidos.length === 0) {
            return alertas; // Sem nomes para validar
        }

        // Mesmo padrão para encontrar nomes na resposta
        const padrao = /(?:Residencial|Condomínio|Edifício|Village|Park|Garden|Plaza)\s+[A-Z][a-záéíóúãõ]+(?:\s+[A-Z][a-záéíóúãõ]+)*/g;
        const nomesResposta = resposta.match(padrao) || [];

        for (const nome of nomesResposta) {
            const existeNoContexto = contexto.empreendimentosConhecidos.some(
                nc => nc.toLowerCase().includes(nome.toLowerCase()) ||
                    nome.toLowerCase().includes(nc.toLowerCase())
            );

            if (!existeNoContexto) {
                alertas.push({
                    tipo: 'NOME_DESCONHECIDO',
                    mensagem: `Empreendimento "${nome}" não encontrado no contexto`,
                    severidade: 'CRITICA',
                    trecho: nome
                });
            }
        }

        return alertas;
    }

    /**
     * Detecta promessas arriscadas que podem gerar problemas legais
     */
    private verificarPromessas(resposta: string): AlertaValidacao[] {
        const alertas: AlertaValidacao[] = [];
        const respostaLower = resposta.toLowerCase();

        const promessasArriscadas = [
            { padrao: /garanto|garantimos|com certeza/i, msg: 'Garantia sem base' },
            { padrao: /valorização (de|garantida|certa)/i, msg: 'Promessa de valorização' },
            { padrao: /você vai conseguir|vai aprovar/i, msg: 'Promessa de aprovação' },
            { padrao: /preço vai subir|vai aumentar/i, msg: 'Promessa de aumento de preço' },
            { padrao: /último(s)? disponível|últimas unidades/i, msg: 'Urgência artificial' },
            { padrao: /melhor investimento|retorno garantido/i, msg: 'Promessa de retorno' }
        ];

        for (const p of promessasArriscadas) {
            if (p.padrao.test(respostaLower)) {
                const match = resposta.match(p.padrao);
                alertas.push({
                    tipo: 'PROMESSA_ARRISCADA',
                    mensagem: p.msg,
                    severidade: 'MEDIA',
                    trecho: match?.[0]
                });
            }
        }

        return alertas;
    }

    /**
     * Verifica datas mencionadas que podem ser suspeitas
     */
    private verificarDatas(resposta: string): AlertaValidacao[] {
        const alertas: AlertaValidacao[] = [];

        // Padrão para datas
        const padraoData = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})|(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/gi;
        const datasEncontradas = resposta.match(padraoData) || [];

        const anoAtual = new Date().getFullYear();

        for (const data of datasEncontradas) {
            // Extrair ano
            const matchAno = data.match(/(\d{4})/);
            if (matchAno) {
                const ano = parseInt(matchAno[1]);
                // Alerta se a data é muito no futuro (>3 anos) ou no passado
                if (ano < anoAtual - 1 || ano > anoAtual + 3) {
                    alertas.push({
                        tipo: 'DATA_SUSPEITA',
                        mensagem: `Data ${data} pode estar incorreta`,
                        severidade: 'BAIXA',
                        trecho: data
                    });
                }
            }
        }

        return alertas;
    }

    /**
     * Detecta afirmações que parecem incertas ou vagas
     */
    private verificarAfirmacoesIncertas(resposta: string): AlertaValidacao[] {
        const alertas: AlertaValidacao[] = [];
        const respostaLower = resposta.toLowerCase();

        // Padrões que indicam incerteza mas são apresentados como fatos
        const padroesIncertos = [
            /acredito que\s+(?!seja\s+importante|você)/i,
            /acho que/i,
            /talvez\s+(?:tenha|seja|consiga)/i,
            /provavelmente/i,
            /não tenho certeza mas/i,
            /deve\s+(?:ser|ter|custar)/i
        ];

        for (const padrao of padroesIncertos) {
            if (padrao.test(respostaLower)) {
                const match = resposta.match(padrao);
                alertas.push({
                    tipo: 'AFIRMACAO_INCERTA',
                    mensagem: 'Afirmação vaga pode indicar alucinação',
                    severidade: 'MEDIA',
                    trecho: match?.[0]
                });
            }
        }

        return alertas;
    }

    /**
     * Tenta corrigir a resposta removendo ou atenuando trechos problemáticos
     */
    private corrigirResposta(resposta: string, alertas: AlertaValidacao[]): string {
        let respostaCorrigida = resposta;

        for (const alerta of alertas) {
            if (alerta.severidade === 'CRITICA' && alerta.trecho) {
                // Para nomes desconhecidos, substitui por termo genérico
                if (alerta.tipo === 'NOME_DESCONHECIDO') {
                    respostaCorrigida = respostaCorrigida.replace(
                        alerta.trecho,
                        'o empreendimento'
                    );
                }
                // Para preços inventados, remove o valor específico
                if (alerta.tipo === 'PRECO_INVENTADO') {
                    respostaCorrigida = respostaCorrigida.replace(
                        new RegExp(`R\\$\\s*${alerta.trecho?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
                        'a faixa de preço'
                    );
                }
            }
        }

        return respostaCorrigida;
    }
}

export const outputValidator = new OutputValidator();
