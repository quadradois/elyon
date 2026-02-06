import {
    processarMensagemOrquestrada,
    buscarConfiguracaoTenant,
    buscarContextoConversa,
    ConfiguracaoOrquestrador,
    ContextoConversa
} from '../agentes/orchestrator';
import { ragEmpreendimentos } from './rag-empreendimentos';
import { ContextManager } from '../utils/context-manager';

export class OrquestradorService {
    /**
     * Processa uma mensagem usando o Orquestrador de 4 Agentes
     */
    async processarMensagem(
        tenantId: string,
        telefone: string,
        mensagensHistorico: { role: 'user' | 'assistant'; content: string }[],
        leadId?: string
    ): Promise<{ resposta?: string; agente?: string; erro?: string }> {
        try {
            // 1. Buscar Configuração do Tenant
            const config = await buscarConfiguracaoTenant(tenantId);
            if (!config) {
                return { erro: 'Configuração do tenant não encontrada' };
            }

            // 2. Buscar Contexto da Conversa
            const contexto = await buscarContextoConversa(telefone, tenantId);

            // Sobrescrever leadId se passado explicitamente
            if (leadId) contexto.leadId = leadId;

            // 3. 🧠 BUSCAR CONHECIMENTO RAG (NOVO)
            let baseConhecimento = '';

            // A) Se sabemos o empreendimento, buscamos o briefing completo
            if (contexto.empreendimento) {
                console.log(`[OrquestradorService] 🏢 Buscando conhecimento do empreendimento: ${contexto.empreendimento}`);
                // Tenta buscar exato (assumindo que contexto.empreendimento é o nome correto)
                const empreendimentoConhecimento = await ragEmpreendimentos.buscarPorNome(
                    contexto.empreendimento,
                    config.cidade || '' // Usa cidade do tenant como filtro de localização se houver
                );

                if (empreendimentoConhecimento) {
                    baseConhecimento = empreendimentoConhecimento.briefingCompleto;
                    console.log('[OrquestradorService] ✅ Briefing exato encontrado');
                } else {
                    // Fallback: Busca semântica pelo nome do empreendimento
                    const resultados = await ragEmpreendimentos.buscarSemantico(contexto.empreendimento, 1);
                    if (resultados.length > 0) {
                        baseConhecimento = resultados[0].briefingCompleto;
                        console.log(`[OrquestradorService] ⚠️ Briefing encontrado por similaridade: ${resultados[0].nome}`);
                    }
                }
            }
            // B) Se não sabemos, e a mensagem for uma dúvida, podemos fazer busca semântica genérica (Opcional - MVP ignora)
            else {
                // MVP: Se não tem empreendimento vinculado, não injeta contexto pesado para não confundir
                // Futuro: Detectar intenção de busca de imóvel e buscar no RAG
            }

            // 4. OTIMIZAR HISTÓRICO (Cost Optimization)
            // Importar ContextManager (assumindo import)
            const { mensagensFinais, novoResumo } = await ContextManager.otimizarHistorico(
                mensagensHistorico,
                contexto.resumoConversa // Assumindo que adicionaremos isso ao contexto
            );

            // TODO: Se novoResumo for gerado, deveríamos salvar no banco/Redis
            // Por enquanto, apenas usamos na memória para esta execução
            // Para persistência real, atualizaríamos o contexto ou o lead.

            // 5. Executar Orquestrador
            const resultado = await processarMensagemOrquestrada(
                mensagensFinais, // Usa histórico otimizado
                config,
                contexto,
                0, // Profundidade inicial
                baseConhecimento // Injeta o contexto RAG
            );

            if (!resultado.sucesso) {
                return { erro: resultado.erro };
            }

            return {
                resposta: resultado.resposta,
                agente: resultado.agenteUsado
            };

        } catch (error: any) {
            console.error('[OrquestradorService] Erro fatal:', error);
            return { erro: error.message };
        }
    }
}

export const orquestradorService = new OrquestradorService();
