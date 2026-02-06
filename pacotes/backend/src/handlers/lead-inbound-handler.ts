/**
 * LEAD INBOUND HANDLER
 * 
 * Responsável por lidar com mensagens de LEADS INBOUND (não prospecção).
 * - Cria Lead se não existir
 * - Gerencia conversa via Orchestrator (unificado)
 * 
 * REFATORADO em 2026-02-06:
 * - Removida dependência do ElyonCore
 * - Agora usa orquestradorService (OpenAI Agents SDK com BYOK)
 */

import { prisma } from '../lib/db';
import { MensagemEntrada } from '../utils/webhook-normalizer';
import { mediaService } from '../servicos/media-service';
import { orquestradorService } from '../servicos/orquestrador-service';
import { getWhatsAppService } from '../servicos/whatsapp';

export class LeadInboundHandler {

    /**
     * Processa fluxo de Lead Inbound
     */
    async handle(msg: MensagemEntrada): Promise<void> {
        console.log(`[LeadInboundHandler] 📨 Processando Inbound: ${msg.telefone}`);

        const ultimosDigitos = msg.telefone.slice(-8);

        // 1. Buscar ou Criar Lead
        let lead = await prisma.lead.findFirst({
            where: { telefone: { contains: ultimosDigitos } },
            include: { tenant: true }
        });

        let leadId = lead?.id;
        let tenantId = lead?.tenantId;

        if (!lead) {
            // Buscar Tenant pela sessão
            const sessao = await prisma.sessaoWhatsapp.findUnique({
                where: { instanceName: msg.instancia }
            });

            if (sessao) {
                console.log(`[LeadInboundHandler] ✨ Criando novo Lead para tenant ${sessao.tenantId}`);
                const novo = await prisma.lead.create({
                    data: {
                        nome: msg.pushName || `Lead ${msg.telefone}`,
                        telefone: msg.telefone,
                        status: 'NOVO',
                        origem: 'WHATSAPP_INBOUND',
                        tenantId: sessao.tenantId
                    }
                });
                leadId = novo.id;
                tenantId = sessao.tenantId;
            } else {
                console.warn(`[LeadInboundHandler] ⚠️ Sessão ${msg.instancia} não encontrada. Lead ignorado.`);
                return;
            }
        }

        if (leadId && tenantId) {
            // 2. Gerenciar Conversa
            let conversa = await prisma.conversa.findFirst({
                where: { leadId, canal: 'WHATSAPP', estadoConversa: 'ativa' }
            });

            if (!conversa) {
                conversa = await prisma.conversa.create({
                    data: {
                        leadId,
                        canal: 'WHATSAPP',
                        numeroOrigem: msg.telefone,
                        estadoConversa: 'ativa',
                        contexto: {}
                    }
                });
            }

            // 3. Processar Mídia (se houver)
            let conteudoMensagem = msg.conteudo;
            let urlMidia: string | undefined;

            if (msg.tipo === 'IMAGEM' || msg.tipo === 'AUDIO') {
                const resultadoMidia = await mediaService.processarMidia(msg.tipo, msg.base64, msg.conteudo);
                if (resultadoMidia.textoExtraido) conteudoMensagem = resultadoMidia.textoExtraido;
                if (resultadoMidia.urlMidia) urlMidia = resultadoMidia.urlMidia;
            }

            // 4. Salvar Mensagem do Usuário
            await prisma.mensagem.create({
                data: {
                    conversaId: conversa.id,
                    remetente: 'usuario',
                    conteudo: conteudoMensagem,
                    tipo: msg.tipo.toLowerCase(),
                    metadata: urlMidia ? { urlMidia } : undefined,
                    enviadaEm: new Date(msg.timestamp)
                }
            });

            // 5. Atualizar Última Interação
            await prisma.lead.update({
                where: { id: leadId },
                data: { ultimaInteracao: new Date() }
            });

            // 6. Carregar Histórico da Conversa
            const historicoDb = await prisma.mensagem.findMany({
                where: { conversaId: conversa.id },
                orderBy: { enviadaEm: 'desc' },
                take: 20
            });

            const historicoMensagens = historicoDb.reverse().map(m => ({
                role: m.remetente === 'usuario' ? 'user' as const : 'assistant' as const,
                content: m.conteudo
            }));

            // 7. Acionar Orchestrator (UNIFICADO - suporta BYOK)
            console.log(`[LeadInboundHandler] 🤖 Acionando Orchestrator para lead ${leadId} (tenant: ${tenantId})`);

            const resultado = await orquestradorService.processarMensagem(
                tenantId,
                msg.telefone,
                historicoMensagens,
                leadId
            );

            // 8. Enviar Resposta via WhatsApp
            if (resultado.resposta && !resultado.erro) {
                const whatsappService = getWhatsAppService(msg.instancia);
                if (whatsappService) {
                    await whatsappService.enviarMensagemTexto(msg.telefone, resultado.resposta);

                    // Salvar resposta no banco
                    await prisma.mensagem.create({
                        data: {
                            conversaId: conversa.id,
                            remetente: 'assistente',
                            conteudo: resultado.resposta,
                            tipo: 'texto',
                            enviadaEm: new Date()
                        }
                    });

                    console.log(`[LeadInboundHandler] ✅ Resposta enviada (agente: ${resultado.agente || 'default'})`);
                } else {
                    console.error(`[LeadInboundHandler] ❌ WhatsApp Service não disponível para ${msg.instancia}`);
                }
            } else if (resultado.erro) {
                console.error(`[LeadInboundHandler] ❌ Erro do Orchestrator: ${resultado.erro}`);
            }
        }
    }
}

export const leadInboundHandler = new LeadInboundHandler();

