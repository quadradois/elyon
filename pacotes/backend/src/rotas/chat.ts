import { responderErro } from '../utilitarios/resposta';
import { Router } from 'express';
import { prisma } from '../lib/db';

const router = Router();

// GET /api/leads/:id/chat
router.get('/:id/chat', async (req, res) => {
  try {
    const { id } = req.params;

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
        papel: msg.remetente,
        conteudo: urlMidia || msg.conteudo,
        enviadaEm: msg.enviadaEm,
        tipo: msg.tipo.toLowerCase(),
        legenda: urlMidia ? msg.conteudo : undefined
      };
    });

    res.json({ mensagens: mensagensFormatadas });
  } catch (error) {
    console.error('Erro ao buscar chat:', error);
    responderErro(res, 500, 'Erro ao buscar histórico de chat.');
  }
});

export default router;
