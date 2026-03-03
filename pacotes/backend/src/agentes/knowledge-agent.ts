import { Agent, tool } from '@openai/agents';
import { z } from 'zod';
import { conhecimentoCuradoService } from '../servicos/conhecimento-curado';
import { ElyonContext } from './elyon-context';

/**
 * AGENTE ESTRATEGISTA DE VENDAS (Sub-Agente de Conhecimento)
 * 
 * Especialista em psicologia de vendas, contorno de objeções e SPIN Selling.
 * Atua como um consultor interno para os agentes Opener, Presenter e Closer.
 */

// Tool interna para busca semântica no pgvector
const buscarConhecimentoInternoTool = tool({
    name: 'buscar_conhecimento_interno',
    description: 'Busca na base de dados curada de táticas de venda imobiliária.',
    parameters: z.object({
        perguntaOuObjecao: z.string().describe('A dúvida ou objeção do lead'),
        faseAtual: z.string().optional().describe('Fase do funil (Opener, Presenter, Closer)')
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

export const knowledgeAgent: any = new Agent<ElyonContext>({
    name: 'knowledge_agent',
    instructions: (context) => `
        Você é um **Estrategista de Vendas Sênior** com foco no mercado imobiliário.
        Seu objetivo é auxiliar outros agentes a contornarem objeções e conduzirem o lead no funil de vendas.

        **SUA MISSÃO:**
        1. Quando receber uma objeção, use a ferramenta 'buscar_conhecimento_interno'.
        2. Analise os resultados e forneça uma RECOMENDAÇÃO EXECUTIVA para o agente que te consultou.
        3. Não apenas repita o texto da base; explique POR QUE usar aquela abordagem e dê uma dica de TOM DE VOZ.

        **DIRETRIZES:**
        - Seja direto e profissional ("Seja empático, use a técnica do 'sentir-sentiu-descobriu'").
        - Se a base não tiver algo específico, use seu conhecimento geral de SPIN Selling e vendas.
        - Foco total em converter a dúvida em interesse.
    `,
    tools: [buscarConhecimentoInternoTool]
});
