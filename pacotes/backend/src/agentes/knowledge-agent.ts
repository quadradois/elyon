import { Agent, tool } from '@openai/agents';
import { z } from 'zod';
import { conhecimentoCuradoService } from '../servicos/conhecimento-curado';
import { ragEmpreendimentos } from '../servicos/rag-empreendimentos';
import { ElyonContext, criarModeloBYOK } from './elyon-context';
import { MODELO_PADRAO_AUXILIAR } from './byok-resolver';
import { logger } from '../lib/logger';
import type { ElyonAgent } from './types';

/**
 * AGENTE ESTRATEGISTA DE VENDAS (Sub-Agente de Conhecimento)
 * 
 * Especialista em psicologia de vendas, contorno de objeções e SPIN Selling.
 * Atua como um consultor interno para os agentes SDR e Admin.
 * 
 * @version 3.0 — conectado ao RAG de Empreendimentos (02/04/2026)
 */

// Tool 1: Busca semântica de técnicas de venda curadas
const buscarConhecimentoInternoTool = tool({
    name: 'buscar_conhecimento_interno',
    description: 'Busca na base de dados curada de táticas de venda imobiliária.',
    parameters: z.object({
        perguntaOuObjecao: z.string().describe('A dúvida ou objeção do lead'),
        faseAtual: z.string().optional().describe('Fase do funil (SDR ou Admin)')
    }),
    execute: async (args) => {
        const resultados = await conhecimentoCuradoService.buscar({
            query: args.perguntaOuObjecao,
            categoria: args.faseAtual || 'Captacao_Outbound',
            limite: 3
        });

        if (!resultados || resultados.length === 0) {
            return "Nenhuma tática específica encontrada. Recomende ao agente usar bom senso e empatia.";
        }

        return JSON.stringify(resultados.map(r => ({
            titulo: r.titulo,
            argumento: r.texto,
            contexto: r.contextoUso,
            exemplo: r.exemplo
        })));
    }
});

// ✅ TASK-IA-01: Tool 2 — Busca semântica de dados de empreendimentos
const buscarInfoEmpreendimentoTool = tool({
    name: 'buscar_info_empreendimento',
    description: `Busca informações reais sobre empreendimentos imobiliários: localização, preço, características, diferenciais.
Use quando o lead perguntar sobre um empreendimento específico, tipo de imóvel, metragem, preço, localização ou facilidades.
Exemplos: "quanto custa?", "onde fica?", "tem varanda gourmet?", "quantos quartos tem?"`,
    parameters: z.object({
        consulta: z.string().describe('A pergunta do lead sobre o empreendimento (ex: "preço do apartamento 3 quartos no Aurora")'),
    }),
    execute: async (args) => {
        try {
            const resultados = await ragEmpreendimentos.buscarSemantico(args.consulta, 3);

            if (!resultados || resultados.length === 0) {
                return "Nenhum empreendimento encontrado na base de dados. Oriente o agente a perguntar mais detalhes ao lead ou consultar o corretor responsável.";
            }

            return JSON.stringify(resultados.map((r: Record<string, unknown>) => ({
                nome: r.nome,
                localizacao: r.localizacao,
                tipo: r.tipo,
                briefing: typeof r.briefingEstruturado === 'string' 
                    ? JSON.parse(r.briefingEstruturado) 
                    : r.briefingEstruturado,
                confiabilidade: r.confiabilidade,
                similaridade: r.similaridade,
            })));
        } catch (error) {
            logger.warn({ err: error }, '[KNOWLEDGE-AGENT] Erro ao buscar dados');
            return "Erro ao consultar base de empreendimentos. Continue a conversa normalmente.";
        }
    }
});

/**
 * Cria uma instância do knowledge agent com BYOK do tenant.
 * Usa gpt-4.1-mini por padrão (custo baixo — é um sub-agente).
 */
export function criarKnowledgeAgent(config?: {
    model?: string;
    apiKey?: string;
    baseUrl?: string;
}): ElyonAgent {
    const modelInstance = config ? criarModeloBYOK(config, MODELO_PADRAO_AUXILIAR) : MODELO_PADRAO_AUXILIAR;

    return new Agent<ElyonContext>({
        name: 'knowledge_agent',
        model: modelInstance,
        instructions: (context) => `
            Você é um **Estrategista de Vendas Sênior** com foco no mercado imobiliário.
            Seu objetivo é auxiliar outros agentes a contornarem objeções e conduzirem o lead no funil de vendas.

            **SUA MISSÃO:**
            1. Quando receber uma objeção ou dúvida sobre técnica de vendas, use 'buscar_conhecimento_interno'.
            2. Quando receber uma pergunta sobre empreendimento, preço, localização ou características, use 'buscar_info_empreendimento'.
            3. Analise os resultados e forneça uma RECOMENDAÇÃO EXECUTIVA para o agente que te consultou.
            4. Não apenas repita o texto da base; explique POR QUE usar aquela abordagem e dê uma dica de TOM DE VOZ.

            **DIRETRIZES:**
            - Seja direto e profissional ("Seja empático, use a técnica do 'sentir-sentiu-descobriu'").
            - Se a base não tiver algo específico, use seu conhecimento geral de SPIN Selling e vendas.
            - Para perguntas sobre preço ou características de empreendimentos, SEMPRE consulte 'buscar_info_empreendimento' antes de responder.
            - Foco total em converter a dúvida em interesse.
        `,
        tools: [buscarConhecimentoInternoTool, buscarInfoEmpreendimentoTool]
    });
}

/** @deprecated Use criarKnowledgeAgent() — mantido para retrocompatibilidade */
export const knowledgeAgent: ElyonAgent = criarKnowledgeAgent();
