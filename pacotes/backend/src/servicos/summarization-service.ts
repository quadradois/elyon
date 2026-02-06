import { openaiService } from './openai';

export class SummarizationService {
    /**
     * Resume um lote de mensagens antigas para economizar tokens.
     */
    async resumirConversa(mensagens: { role: string; content: string }[]): Promise<string> {
        if (!mensagens || mensagens.length === 0) return '';

        try {
            // Formatar para texto plano
            const conversaTexto = mensagens
                .map(m => `${m.role.toUpperCase()}: ${m.content}`)
                .join('\n');

            const prompt = `
            Você é um assistente especialista em resumir conversas de vendas/imobiliária.
            Seu objetivo é criar um resumo conciso mas rico em detalhes cruciais.
            
            MANTENHA:
            - Nome do cliente e dados pessoais (telefone, email, família)
            - Tipo de imóvel buscado ou ofertado (quartos, bairro, valor)
            - Status da negociação (agendou visita? enviou proposta?)
            - Objeções levantadas (preço alto, localização ruim)
            - Última ação combinada
            
            IGNORE:
            - Saudações ("oi", "bom dia")
            - Confirmações simples ("ok", "tá bom")
            - Conversa fiada fora do contexto
            
            CONVERSA ORIGINAL:
            ${conversaTexto}
            
            RESUMO (Máx 3 parágrafos):
            `;

            const resumo = await openaiService.gerarResposta(
                [{ role: 'user', content: prompt }],
                { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 500 }
            );

            return resumo;

        } catch (error) {
            console.error('[SummarizationService] Erro ao resumir:', error);
            return ''; // Falha silenciosa (retorna vazio para não quebrar fluxo)
        }
    }
}

export const summarizationService = new SummarizationService();
