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
import { 
  extrairJSONBriefing,
  gerarResumoTextual
} from '../servicos/manus';

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

// ============================================
// WEBHOOK DO MANUS
// ============================================

/**
 * POST /webhooks/manus
 * Recebe notificações do Manus sobre tarefas
 */
router.post('/manus', async (req: Request, res: Response) => {
  try {
    const payload = req.body as ManusWebhookPayload;
    
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
    
    return res.status(200).json({ sucesso: true });
    
  } catch (error: any) {
    console.error('[MANUS WEBHOOK] ❌ Erro:', error.message);
    // Retornar 200 para evitar retries desnecessários
    return res.status(200).json({ sucesso: false, erro: error.message });
  }
});

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
