import { responderErro } from '../utilitarios/resposta';
import { Router } from 'express';
import { prisma } from '../lib/db';
import { getTenantId } from '../utils/tenant';
import { getWhatsAppService } from '../servicos/whatsapp';

const router = Router();

async function validarAcessoLead(leadId: string, tenantId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, tenantId: true, telefone: true }
  });

  if (!lead) return { ok: false as const, status: 404 as const, erro: 'Lead não encontrado' };
  if (lead.tenantId !== tenantId) {
    console.warn(`[SECURITY][CHAT] Acesso cruzado bloqueado: lead=${leadId} tenantReq=${tenantId} tenantLead=${lead.tenantId}`);
    return { ok: false as const, status: 403 as const, erro: 'Acesso negado' };
  }

  return { ok: true as const, lead };
}

// GET /api/leads/:id/chat
router.get('/:id/chat', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id } = req.params;
    const acesso = await validarAcessoLead(id, tenantId);
    if (!acesso.ok) {
      return responderErro(res, acesso.status, acesso.erro);
    }

    // Busca a conversa ativa (ou a mais recente)
    const conversa = await prisma.conversa.findFirst({
      where: {
        leadId: id,
        canal: 'WHATSAPP'
      },
      include: {
        mensagens: {
          orderBy: {
            enviadaEm: 'asc'
          }
        }
      },
      orderBy: {
        iniciadaEm: 'desc'
      }
    });

    if (!conversa) {
      return res.json({ mensagens: [] });
    }

    const mensagensFormatadas = conversa.mensagens.map(msg => {
      const metadata = msg.metadata as any;
      const urlMidia = metadata?.urlMidia;
      return {
        id: msg.id,
        remetente: msg.remetente,
        papel: msg.remetente, // retrocompatibilidade
        conteudo: urlMidia || msg.conteudo,
        enviadaEm: msg.enviadaEm,
        lidaEm: msg.lidaEm ?? null,
        tipo: msg.tipo.toLowerCase(),
        legenda: urlMidia ? msg.conteudo : undefined,
      };
    });

    res.json({ mensagens: mensagensFormatadas });
  } catch (error) {
    console.error('Erro ao buscar chat:', error);
    responderErro(res, 500, 'Erro ao buscar histórico de chat.');
  }
});

// POST /api/leads/:id/chat
// Envio manual de mensagem no cockpit (humano assumindo conversa)
router.post('/:id/chat', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id } = req.params;
    const mensagem = String(req.body?.mensagem || '').trim();
    const telefoneBody = typeof req.body?.telefone === 'string' ? req.body.telefone : null;

    if (!mensagem) {
      return responderErro(res, 400, 'Mensagem é obrigatória.');
    }

    const acesso = await validarAcessoLead(id, tenantId);
    if (!acesso.ok) {
      return responderErro(res, acesso.status, acesso.erro);
    }

    const telefone = telefoneBody || acesso.lead.telefone;
    if (!telefone) {
      return responderErro(res, 400, 'Lead sem telefone para envio WhatsApp.');
    }

    const sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
      where: {
        tenantId,
        status: 'CONECTADO'
      },
      select: {
        id: true,
        instanceName: true,
      }
    });

    if (!sessaoWhatsapp || !sessaoWhatsapp.instanceName) {
      return responderErro(res, 400, 'Nenhuma sessão WhatsApp ativa encontrada para este tenant.');
    }

    const whatsappService = getWhatsAppService(sessaoWhatsapp.instanceName);
    const resultadoEnvio = await whatsappService.enviarMensagemTexto(telefone, mensagem);

    let conversa = await prisma.conversa.findFirst({
      where: { leadId: id, canal: 'WHATSAPP', estadoConversa: 'ativa' }
    });

    if (!conversa) {
      conversa = await prisma.conversa.create({
        data: {
          leadId: id,
          canal: 'WHATSAPP',
          numeroOrigem: telefone,
          estadoConversa: 'ativa',
          contexto: {}
        }
      });
    }

    await prisma.mensagem.create({
      data: {
        conversaId: conversa.id,
        remetente: 'usuario',
        conteudo: mensagem,
        enviadaEm: new Date()
      }
    });

    await prisma.conversa.update({
      where: { id: conversa.id },
      data: { ultimaMensagemEm: new Date() }
    });

    res.json({
      sucesso: true,
      mensagem: 'Mensagem enviada com sucesso',
      resultado: resultadoEnvio
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem manual no chat:', error);
    responderErro(res, 500, 'Erro ao enviar mensagem no chat.');
  }
});

export default router;
