/**
 * TOOL: Consultar Preço de Mercado
 * 
 * Nova ferramenta para os agentes SDR estimarem o valor de mercado
 * de um imóvel cruzando dados de IPTU, cache de avaliações anteriores
 * e briefings de empreendimentos no RAG.
 * 
 * Retorna uma faixa estimada (ex: "R$ 450k - R$ 520k") para que o
 * agente possa responder perguntas como "meu imóvel vale quanto?"
 * 
 * @version 1.0
 * @date 02/04/2026
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { ragEmpreendimentos } from '../servicos/rag-empreendimentos';

export const consultarPrecoMercadoTool = tool({
    name: 'consultar_preco_mercado',
    description: `Estima o valor de mercado de um imóvel cruzando dados reais disponíveis.
Use quando o lead perguntar "quanto vale meu imóvel?", "qual o preço?", "vale a pena vender agora?"

Fontes consultadas:
1. Dados de IPTU (valor venal oficial)
2. Cache de avaliações anteriores do mesmo edifício
3. Briefing do empreendimento no RAG (preço médio/m²)

Retorna uma FAIXA ESTIMADA, nunca um valor exato.
IMPORTANTE: Deixe claro ao lead que é uma estimativa e que uma avaliação presencial é necessária para valor preciso.`,

    parameters: z.object({
        nomeEdificio: z.string().describe('Nome do edifício ou empreendimento'),
        tipoImovel: z.string().optional().describe('Tipo: apartamento, casa, terreno'),
        areaM2: z.number().optional().describe('Área em m² (se conhecida)'),
        quartos: z.number().optional().describe('Número de quartos (se conhecido)'),
        bairro: z.string().optional().describe('Bairro ou localização'),
    }),

    execute: async (args) => {
        try {
            console.log(`[TOOL] consultar_preco_mercado — Edifício: ${args.nomeEdificio}`);

            const fontes: string[] = [];
            let valorMinimo = 0;
            let valorMaximo = 0;
            let precoM2Medio = 0;
            let encontrouDados = false;

            // ====================================
            // FONTE 1: Dados de IPTU (valor venal)
            // ====================================
            try {
                const imoveis = await prisma.imovel.findMany({
                    where: {
                        nomeEdificio: { contains: args.nomeEdificio, mode: 'insensitive' }
                    },
                    take: 20,
                });

                if (imoveis.length > 0) {
                    const valoresVenais = (imoveis as any[])
                        .map((i: any) => parseFloat(String(i.valorVenal || i.valorVenalTerreno || '0')))
                        .filter((v: number) => v > 0);

                    if (valoresVenais.length > 0) {
                        const mediaVenal = valoresVenais.reduce((a, b) => a + b, 0) / valoresVenais.length;
                        // Valor de mercado é tipicamente 1.5x a 2.5x o valor venal
                        valorMinimo = mediaVenal * 1.5;
                        valorMaximo = mediaVenal * 2.5;
                        encontrouDados = true;
                        fontes.push(`IPTU: ${imoveis.length} unidades analisadas, valor venal médio R$ ${mediaVenal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`);

                        // Calcular preço/m² se tiver área
                        const areas = (imoveis as any[])
                            .map((i: any) => parseFloat(String(i.areaConstruida || i.areaTerreno || '0')))
                            .filter((a: number) => a > 0);
                        if (areas.length > 0) {
                            const areaMedia = areas.reduce((a, b) => a + b, 0) / areas.length;
                            precoM2Medio = ((valorMinimo + valorMaximo) / 2) / areaMedia;
                        }
                    }
                }
            } catch (err) {
                console.warn('[TOOL] consultar_preco_mercado — erro ao consultar IPTU:', err);
            }

            // ====================================
            // FONTE 2: RAG de Empreendimentos (briefing)
            // ====================================
            try {
                const ragResultados = await ragEmpreendimentos.buscarSemantico(
                    `${args.nomeEdificio} ${args.bairro || ''} preço valor`.trim(),
                    3
                );

                if (ragResultados && ragResultados.length > 0) {
                    for (const r of ragResultados) {
                        const briefing = typeof r.briefingEstruturado === 'string'
                            ? JSON.parse(r.briefingEstruturado)
                            : r.briefingEstruturado;

                        if (briefing?.preco_medio_m2) {
                            const precoRag = parseFloat(briefing.preco_medio_m2);
                            if (precoRag > 0) {
                                precoM2Medio = precoM2Medio > 0
                                    ? (precoM2Medio + precoRag) / 2 // Média com IPTU
                                    : precoRag;
                                fontes.push(`RAG: ${r.nome} — preço médio/m² R$ ${precoRag.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`);
                                encontrouDados = true;
                            }
                        }

                        if (briefing?.valor_estimado_minimo && briefing?.valor_estimado_maximo) {
                            const ragMin = parseFloat(briefing.valor_estimado_minimo);
                            const ragMax = parseFloat(briefing.valor_estimado_maximo);
                            if (ragMin > 0 && ragMax > 0) {
                                valorMinimo = valorMinimo > 0 ? (valorMinimo + ragMin) / 2 : ragMin;
                                valorMaximo = valorMaximo > 0 ? (valorMaximo + ragMax) / 2 : ragMax;
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn('[TOOL] consultar_preco_mercado — erro ao consultar RAG:', err);
            }

            // ====================================
            // CALCULAR ESTIMATIVA FINAL
            // ====================================

            // Se tiver preço/m² e área informada, calcular diretamente
            if (precoM2Medio > 0 && args.areaM2 && args.areaM2 > 0) {
                const valorEstimado = precoM2Medio * args.areaM2;
                valorMinimo = valorEstimado * 0.85; // -15%
                valorMaximo = valorEstimado * 1.15; // +15%
                fontes.push(`Cálculo: ${args.areaM2}m² × R$ ${precoM2Medio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/m²`);
                encontrouDados = true;
            }

            if (!encontrouDados) {
                return JSON.stringify({
                    success: false,
                    mensagem: `Não encontrei dados suficientes para estimar o valor do ${args.nomeEdificio}. Sugira ao lead uma avaliação presencial gratuita para valor preciso.`,
                    fontes: []
                });
            }

            const formatarValor = (v: number) => {
                if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
                return `R$ ${(v / 1_000).toFixed(0)}k`;
            };

            return JSON.stringify({
                success: true,
                estimativa: {
                    faixaMinima: formatarValor(valorMinimo),
                    faixaMaxima: formatarValor(valorMaximo),
                    precoM2: precoM2Medio > 0 ? `R$ ${precoM2Medio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/m²` : null,
                },
                fontes,
                disclaimer: 'Estimativa baseada em dados públicos. Uma avaliação presencial é necessária para valor preciso.',
                mensagem: `Com base nos dados disponíveis, o ${args.nomeEdificio} tem uma estimativa de mercado entre ${formatarValor(valorMinimo)} e ${formatarValor(valorMaximo)}${precoM2Medio > 0 ? ` (aprox. R$ ${precoM2Medio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/m²)` : ''}. Recomende ao lead uma avaliação presencial para valor preciso.`
            });

        } catch (error: any) {
            console.error('[TOOL] consultar_preco_mercado — Erro:', error);
            return JSON.stringify({
                success: false,
                error: error.message || 'Erro ao consultar preço de mercado'
            });
        }
    }
});
