import { Router } from 'express';
import { prisma } from '../servidor';

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

    const mensagensFormatadas = conversa.mensagens.map(msg => ({
      id: msg.id,
      papel: msg.papel,
      conteudo: msg.urlMidia || msg.conteudo, // Se tiver mídia, usa a URL/Base64
      enviadaEm: msg.enviadaEm,
      tipo: msg.tipo.toLowerCase(), // AUDIO -> audio, IMAGEM -> image
      legenda: msg.urlMidia ? msg.conteudo : undefined // Se tem mídia, o conteudo vira legenda (se for texto)
    }));

    res.json({ mensagens: mensagensFormatadas });
  } catch (error) {
    console.error('Erro ao buscar chat:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico de chat.' });
  }
});

export default router;
