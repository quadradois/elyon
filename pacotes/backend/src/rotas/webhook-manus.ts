/**
 * ROTAS DE WEBHOOK DO MANUS
 * 
 * Recebe notificações em tempo real do Manus quando:
 * - task_created: Tarefa foi criada
 * - task_progress: Tarefa está em progresso
 * - task_stopped: Tarefa foi concluída ou precisa de input
 * 
 * Endpoint: POST /webhooks/manus
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { 
  extrairJSONBriefing,
  gerarResumoTextual
} from '../servicos/manus';
import {
  autenticarWebhookManus,
  concluirEventoWebhook,
  hashPayload,
  liberarEventoWebhook,
  registrarEventoWebhook,
} from '../servicos/webhook-seguranca';

const router = Router();

// ============================================
// TIPOS
// ============================================

interface ManusWebhookPayload {
  event_id: string;
  event_type: 'task_created' | 'task_progress' | 'task_stopped';
  task_detail?: {
    task_id: string;
    task_title: string;
    task_url: string;
    message?: string;
    attachments?: Array<{
      file_name: string;
      url: string;
      size_bytes: number;
    }>;
    stop_reason?: 'finish' | 'ask';
  };
  progress_detail?: {
    task_id: string;
    progress_type: string;
    message: string;
  };
}

const manusWebhookSchema = z.object({
  event_id: z.string().min(1).max(255),
  event_type: z.enum(['task_created', 'task_progress', 'task_stopped']),
  task_detail: z.object({
    task_id: z.string().min(1),
    task_title: z.string(),
    task_url: z.string(),
    message: z.string().optional(),
    attachments: z.array(z.object({
      file_name: z.string(),
      url: z.string(),
      size_bytes: z.number(),
    })).optional(),
    stop_reason: z.enum(['finish', 'ask']).optional(),
  }).optional(),
  progress_detail: z.object({
    task_id: z.string().min(1),
    progress_type: z.string(),
    message: z.string(),
  }).optional(),
});

// ============================================
// WEBHOOK DO MANUS
// ============================================

/**
 * POST /webhooks/manus
 * Recebe notificações do Manus sobre tarefas
 */
export async function processarWebhookManus(req: Request, res: Response): Promise<unknown> {
  let registroId: string | undefined = req.get('x-elyon-inbox-id');
  try {
    const validacao = manusWebhookSchema.safeParse(req.body);
    if (!validacao.success) {
      return res.status(400).json({ sucesso: false, erro: 'Payload invalido' });
    }

    const payload = validacao.data as ManusWebhookPayload;
    if (!registroId) {
      const payloadHash = hashPayload(req.rawBody || Buffer.from(JSON.stringify(payload)));
      const registro = await registrarEventoWebhook({
        provedor: 'MANUS',
        eventoId: payload.event_id,
        tipo: payload.event_type,
        payloadHash,
        payload: { ...payload },
      });

      if (registro.duplicado) {
        return res.status(200).json({ sucesso: true, duplicado: true });
      }
      return res.status(202).json({ sucesso: true, eventoId: registro.registroId });
    }
    
    console.log(`[MANUS WEBHOOK] 📨 Recebido: ${payload.event_type}`);
    console.log(`[MANUS WEBHOOK] Event ID: ${payload.event_id}`);
    
    // Extrair task_id dependendo do tipo de evento
    let taskId: string | undefined;
    
    if (payload.task_detail) {
      taskId = payload.task_detail.task_id;
    } else if (payload.progress_detail) {
      taskId = payload.progress_detail.task_id;
    }
    
    if (!taskId) {
      console.log('[MANUS WEBHOOK] ⚠️ Payload sem task_id, ignorando');
      if (registroId) await concluirEventoWebhook(registroId);
      return res.status(200).json({ sucesso: true, ignorado: true });
    }
    
    console.log(`[MANUS WEBHOOK] Task ID: ${taskId}`);
    
    // Buscar pesquisa associada
    const pesquisa = await prisma.pesquisaManus.findFirst({
      where: { taskId }
    });
    
    if (!pesquisa) {
      console.log(`[MANUS WEBHOOK] ⚠️ Pesquisa não encontrada para task: ${taskId}`);
      // Retornar 200 mesmo assim para não causar retries
      if (registroId) await concluirEventoWebhook(registroId);
      return res.status(200).json({ sucesso: true, pesquisaNaoEncontrada: true });
    }
    
    console.log(`[MANUS WEBHOOK] Pesquisa encontrada: ${pesquisa.id}`);
    
    // Processar conforme tipo de evento
    switch (payload.event_type) {
      case 'task_created':
        await processarTaskCreated(pesquisa.id, payload);
        break;
        
      case 'task_progress':
        await processarTaskProgress(pesquisa.id, payload);
        break;
        
      case 'task_stopped':
        await processarTaskStopped(pesquisa.id, payload);
        break;
        
      default:
        console.log(`[MANUS WEBHOOK] Evento desconhecido: ${payload.event_type}`);
    }
    
    if (registroId) await concluirEventoWebhook(registroId);
    return res.status(200).json({ sucesso: true });
    
  } catch (error: any) {
    if (registroId) await liberarEventoWebhook(registroId).catch(() => undefined);
    console.error('[MANUS WEBHOOK] ❌ Erro:', error.message);
    return res.status(500).json({ sucesso: false, erro: 'Falha ao processar webhook' });
  }
}

router.post('/manus', autenticarWebhookManus, processarWebhookManus);

// ============================================
// PROCESSADORES DE EVENTOS
// ============================================

async function processarTaskCreated(pesquisaId: string, payload: ManusWebhookPayload) {
  console.log(`[MANUS WEBHOOK] ✅ Task criada confirmada para pesquisa: ${pesquisaId}`);
  
  // Atualizar status para PROCESSANDO se estava PENDENTE
  await prisma.pesquisaManus.update({
    where: { id: pesquisaId },
    data: {
      status: 'PROCESSANDO',
    }
  });
}

async function processarTaskProgress(pesquisaId: string, payload: ManusWebhookPayload) {
  const message = payload.progress_detail?.message || '';
  console.log(`[MANUS WEBHOOK] 🔄 Progresso: ${message.substring(0, 100)}...`);
  
  // Opcional: salvar progresso no banco se quisermos mostrar na UI
  // Por enquanto, apenas logamos
}

async function processarTaskStopped(pesquisaId: string, payload: ManusWebhookPayload) {
  const detail = payload.task_detail;
  if (!detail) return;
  
  const stopReason = detail.stop_reason;
  const message = detail.message || '';
  
  console.log(`[MANUS WEBHOOK] 🛑 Task parada. Razão: ${stopReason}`);
  console.log(`[MANUS WEBHOOK] Mensagem: ${message.substring(0, 200)}...`);
  
  if (stopReason === 'finish') {
    // Tarefa concluída com sucesso!
    let resultado = message;
    let resultadoJson: Record<string, any> | null = null;
    
    // Tentar extrair JSON estruturado
    const extracao = extrairJSONBriefing(message);
    
    if (extracao.sucesso && extracao.dados) {
      resultadoJson = extracao.dados;
      resultado = gerarResumoTextual(extracao.dados);
      console.log(`[MANUS WEBHOOK] ✅ JSON estruturado extraído!`);
    } else {
      console.log(`[MANUS WEBHOOK] ⚠️ Usando texto original (sem JSON estruturado)`);
    }
    
    // Atualizar pesquisa como concluída
    await prisma.pesquisaManus.update({
      where: { id: pesquisaId },
      data: {
        status: 'CONCLUIDO',
        resultado,
        resultadoJson: resultadoJson || undefined,
        concluidaEm: new Date(),
      }
    });
    
    console.log(`[MANUS WEBHOOK] ✅ Pesquisa ${pesquisaId} marcada como CONCLUIDO`);
    
    // Se tiver anexos, logar para referência futura
    if (detail.attachments && detail.attachments.length > 0) {
      console.log(`[MANUS WEBHOOK] 📎 ${detail.attachments.length} anexo(s):`);
      detail.attachments.forEach(att => {
        console.log(`   - ${att.file_name} (${att.size_bytes} bytes): ${att.url}`);
      });
    }
    
  } else if (stopReason === 'ask') {
    // Tarefa precisa de input do usuário
    console.log(`[MANUS WEBHOOK] ⏸️ Tarefa aguardando input do usuário`);
    
    await prisma.pesquisaManus.update({
      where: { id: pesquisaId },
      data: {
        status: 'AGUARDANDO_INPUT',
        erro: `A IA precisa de mais informações: ${message.substring(0, 500)}`,
      }
    });
  }
}

/**
 * GET /webhooks/manus/test
 * Endpoint de teste para verificar se o webhook está acessível
 */
router.get('/manus/test', (req: Request, res: Response) => {
  res.status(200).json({ 
    sucesso: true, 
    mensagem: 'Webhook Manus configurado e acessível',
    timestamp: new Date().toISOString()
  });
});

export default router;
