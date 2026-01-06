import OpenAI from 'openai';
import { toolsDefinition, toolsExecution } from './ferramentas';

const MODELO_PADRAO = 'gpt-4o-mini';

// Cliente OpenAI (será instanciado com a chave do ambiente)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export class AgenteV2 {
    /**
     * Processa uma mensagem utilizando OpenAI Chat Completions manual com Function Calling loop.
     */
    async processarMensagem(
        historicoMensagens: any[],
        novaMensagem: string,
        instrucoesDoSistema: string
    ): Promise<string> {
        console.log(`[AgenteV2] Iniciando Chat Completions (${MODELO_PADRAO})...`);

        try {
            // Preparar mensagens iniciais
            const messages: any[] = [
                { role: "system", content: instrucoesDoSistema },
                ...historicoMensagens.map(m => ({ role: m.role, content: m.content })),
                { role: "user", content: novaMensagem }
            ];

            // Loop de execução (máximo 5 iterações para evitar loops infinitos)
            let iteracoes = 0;
            const MAX_ITERACOES = 5;

            while (iteracoes < MAX_ITERACOES) {
                iteracoes++;

                const response = await openai.chat.completions.create({
                    model: MODELO_PADRAO,
                    messages: messages,
                    tools: toolsDefinition,
                    tool_choice: "auto",
                });

                const responseMessage = response.choices[0].message;

                // Adiciona a resposta do assistente ao histórico da conversa atual
                messages.push(responseMessage);

                // Se houver chamadas de ferramenta
                if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                    console.log(`[AgenteV2] O modelo solicitou ${responseMessage.tool_calls.length} ferramentas.`);

                    for (const toolCall of (responseMessage.tool_calls as any[])) {
                        const functionName = toolCall.function.name;
                        const functionArgs = JSON.parse(toolCall.function.arguments);

                        console.log(`[AgenteV2] Executando ferramenta: ${functionName}`);

                        const executor = toolsExecution[functionName];
                        let functionResponse = JSON.stringify({ erro: "Ferramenta não encontrada" });

                        if (executor) {
                            try {
                                functionResponse = await executor(functionArgs);
                            } catch (error) {
                                console.error(`[AgenteV2] Erro na execução da ferramenta ${functionName}:`, error);
                                functionResponse = JSON.stringify({ erro: "Erro interno na execução da ferramenta" });
                            }
                        }

                        // Adiciona o resultado da ferramenta ao histórico
                        messages.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            name: functionName,
                            content: functionResponse,
                        });
                    }
                    // O loop continua para enviar os resultados de volta ao modelo
                } else {
                    // Sem tool calls, é a resposta final
                    return responseMessage.content || "Sem resposta textual.";
                }
            }

            return "Limite de iterações do agente atingido.";

        } catch (error) {
            console.error('[AgenteV2] Erro crítico:', error);
            // Fallback amigável
            return "Desculpe, tive um problema técnico momentâneo. Tente novamente em instantes.";
        }
    }
}

export const agenteV2 = new AgenteV2();
