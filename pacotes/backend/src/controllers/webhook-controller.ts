/**
 * WEBHOOK CONTROLLER
 * 
 * Ponto de entrada das requisições da Evolution API.
 * Responsabilidade: Orquestrar o fluxo de entrada.
 * 
 * Fluxo:
 * 1. Normalizar Request (WebhookNormalizer)
 * 2. Tentar Prospecção Ativa (ProspeccaoHandler)
 * 3. Se não for prospecção, tratar como Lead Inbound (LeadInboundHandler)
 */

import { Request, Response } from 'express';
import { WebhookNormalizer } from '../utils/webhook-normalizer';
import { prospeccaoHandler } from '../handlers/prospeccao-handler';
import { leadInboundHandler } from '../handlers/lead-inbound-handler';

export class WebhookController {

    /**
     * Recebe POST do Webhook
     */
    async handle(req: Request, res: Response) {
        try {
            const agora = new Date().toISOString();
            // console.log(`--- WEBHOOK CTRL [${agora}] ---`);

            // 1. Normalizar
            const mensagens = WebhookNormalizer.normalizar(req.body);

            if (mensagens.length > 0) {
                console.log(`[WebhookCtrl] Processando ${mensagens.length} mensagens...`);
            }

            for (const msg of mensagens) {
                // Ignore messages sent by me
                if (msg.isFromMe) {
                    console.log('[WebhookCtrl] Ignorando fromMe=true');
                    continue;
                }

                console.log(`[WebhookCtrl] 📨 ${msg.telefone}: "${msg.conteudo.substring(0, 50)}${msg.conteudo.length > 50 ? '...' : ''}" [${msg.tipo}]`);

                // 2. Tentar Fluxo de Prospecção (SDR)
                const processadoComoProspeccao = await prospeccaoHandler.handle(msg);

                if (processadoComoProspeccao) {
                    // Se foi tratado como prospecção (SDR Active), encerramos aqui para não duplicar
                    continue;
                }

                // 3. Tentar Fluxo de Lead Inbound (Atendimento Geral)
                await leadInboundHandler.handle(msg);
            }

            return res.status(200).json({ status: 'success' });

        } catch (error: any) {
            console.error('[WebhookCtrl] Erro fatal:', error);
            // Retornar 200 para não travar a Evolution (retry loop infinito)
            // Apenas logamos o erro
            return res.status(200).json({ status: 'error', message: error.message });
        }
    }
}

export const webhookController = new WebhookController();
