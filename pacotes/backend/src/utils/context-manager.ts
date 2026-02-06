/**
 * CONTEXT MANAGER
 * 
 * Gerencia a janela de contexto para enviada para o LLM.
 * Implementa a estratégia "Sliding Window + Summary".
 * 
 * Estratégia:
 * - Se histórico < LIMIT (ex: 10): Envia tudo.
 * - Se histórico > LIMIT:
 *   - Mantém as últimas N mensagens "raw" (ex: 6).
 *   - Resume as anteriores usando SummarizationService.
 *   - Concatena: [Resumo] + [Mensagens Recentes].
 */

import { summarizationService } from '../servicos/summarization-service';

export interface MensagemContexto {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export class ContextManager {
    // Configurações padrão
    private static JANELA_RECENTE = 6; // Últimas 6 mensagens mantidas na íntegra
    private static TRIGGER_RESUMO = 10; // Só resume se tiver mais que X mensagens

    /**
     * Otimiza o histórico de mensagens para caber no contexto e economizar tokens.
     */
    static async otimizarHistorico(
        historicoCompleto: MensagemContexto[],
        resumoExistente?: string
    ): Promise<{ mensagensFinais: MensagemContexto[]; novoResumo: string | null }> {

        // 1. Se for pequeno, retorna tudo na íntegra
        if (historicoCompleto.length <= this.TRIGGER_RESUMO) {
            // Se já tem resumo antigo, adiciona como primeira mensagem system/user
            const mensagensFinais = [...historicoCompleto];
            if (resumoExistente) {
                mensagensFinais.unshift({
                    role: 'system',
                    content: `RESUMO DA CONVERSA ANTERIOR:\n${resumoExistente}`
                });
            }
            return { mensagensFinais, novoResumo: null };
        }

        console.log(`[ContextManager] 📉 Otimizando histórico de ${historicoCompleto.length} mensagens...`);

        // 2. Dividir em "Antigas" (para resumir) e "Recentes" (para manter)
        // Cortamos deixando as N últimas no array recente
        const indiceCorte = historicoCompleto.length - this.JANELA_RECENTE;

        const mensagensParaResumir = historicoCompleto.slice(0, indiceCorte);
        const mensagensRecentes = historicoCompleto.slice(indiceCorte);

        // 3. Gerar Novo Resumo
        // Se já existia resumo, concatenamos ele no texto a ser resumido para não perder info
        let textoParaResumir = mensagensParaResumir;
        if (resumoExistente) {
            // Adiciona o resumo anterior como contexto para o novo resumo
            textoParaResumir = [
                { role: 'system', content: `RESUMO ANTERIOR: ${resumoExistente}` } as MensagemContexto,
                ...mensagensParaResumir
            ];
        }

        // Executar sumarização (pode demorar um pouco, idealmente seria async background mas no chat live tem que ser await)
        // TODO: Para máxima performance, o resumo deveria ser calculado em background após cada mensagem, e salvo no DB.
        // Para este MVP (Phase 8), faremos on-the-fly, mas usando gpt-4o-mini que é rápido.
        const novoResumo = await summarizationService.resumirConversa(textoParaResumir);

        // 4. Montar Contexto Final
        const contextoFinal: MensagemContexto[] = [
            {
                role: 'system',
                content: `RESUMO DA CONVERSA ANTERIOR:\n${novoResumo}`
            },
            ...mensagensRecentes
        ];

        return { mensagensFinais: contextoFinal, novoResumo };
    }
}
