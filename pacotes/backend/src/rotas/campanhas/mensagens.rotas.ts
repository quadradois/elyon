/**
 * Rotas de Mensagens - Chat e Histórico de Contatos
 * 
 * Responsabilidades:
 * - Buscar dados completos de um contato
 * - Buscar histórico de mensagens
 * - Enviar mensagens manuais
 * - Histórico de atividades
 */

import { Router } from 'express';
import { prisma } from '../../lib/db';

const router = Router();

// ============================================
// DADOS DO CONTATO
// ============================================

/**
 * GET /contatos/:id
 * Retorna os dados completos de um contato específico
 */
router.get('/contatos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const contato = await prisma.contato.findUnique({
      where: { id },
      include: {
        campanha: {
          select: {
            id: true,
            nome: true,
            tenantId: true,
            empreendimento: { select: { nome: true } }
          }
        }
      }
    });

    if (!contato) {
      return res.status(404).json({ erro: 'Contato não encontrado' });
    }

    return res.json(contato);

  } catch (error: any) {
    console.error('[Campanhas] Erro ao buscar contato:', error);
    return res.status(500).json({ erro: 'Erro ao buscar dados do contato' });
  }
});

// ============================================
// MENSAGENS
// ============================================

/**
 * GET /contatos/:id/mensagens
 * Retorna o histórico de mensagens de um contato específico
 */
router.get('/contatos/:id/mensagens', async (req, res) => {
  try {
    const { id } = req.params;

    const contato = await prisma.contato.findUnique({
      where: { id },
      include: { campanha: { select: { nome: true, tenantId: true } } }
    });

    if (!contato) {
      return res.status(404).json({ erro: 'Contato não encontrado' });
    }

    const mensagens = await prisma.mensagemProspeccao.findMany({
      where: { contatoId: id },
      orderBy: { dataHora: 'asc' },
      select: {
        id: true,
        tipo: true,
        direcao: true,
        conteudo: true,
        dataHora: true,
        messageId: true,
      }
    });

    const mensagensFormatadas = mensagens.map((msg: {
      id: string;
      tipo: string;
      direcao: string;
      conteudo: string;
      dataHora: Date;
      messageId: string | null;
    }) => ({
      id: msg.id,
      tipo: msg.direcao === 'SAIDA' ? 'ENVIADA' : 'RECEBIDA',
      conteudo: msg.conteudo,
      timestamp: msg.dataHora.toISOString(),
      remetente: msg.direcao === 'SAIDA' ? 'Agente IA' : contato.nome
    }));

    return res.json({
      mensagens: mensagensFormatadas,
      contato: {
        id: contato.id,
        nome: contato.nome,
        telefone: contato.telefone,
        ultimoContato: contato.ultimaTentativa,
      }
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao buscar mensagens:', error);
    return res.status(500).json({ erro: 'Erro ao buscar histórico de mensagens' });
  }
});

/**
 * POST /contatos/:id/mensagens
 * Envia uma mensagem manual para um contato (corretor → cliente)
 */
router.post('/contatos/:id/mensagens', async (req, res) => {
  try {
    const { id } = req.params;
    const { conteudo } = req.body;

    if (!conteudo || conteudo.trim() === '') {
      return res.status(400).json({ erro: 'Conteúdo da mensagem é obrigatório' });
    }

    const contato = await prisma.contato.findUnique({
      where: { id },
      include: { campanha: true }
    });

    if (!contato) {
      return res.status(404).json({ erro: 'Contato não encontrado' });
    }

    if (!contato.telefone) {
      return res.status(400).json({ erro: 'Contato não possui telefone cadastrado' });
    }

    // 🆕 Multi-Tenant: Buscar instância do banco baseada no Tenant
    const { getInstanceName } = await import('../../servicos/whatsapp-resolver');
    const instanciaWhatsApp = await getInstanceName(contato.campanha.tenantId);

    let telefoneFormatado = contato.telefone.replace(/\D/g, '');
    if (!telefoneFormatado.startsWith('55')) {
      telefoneFormatado = '55' + telefoneFormatado;
    }

    const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    const evolutionKey = process.env.EVOLUTION_API_KEY || '';

    const responseEvolution = await fetch(
      `${evolutionUrl}/message/sendText/${instanciaWhatsApp}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionKey,
        },
        body: JSON.stringify({
          number: telefoneFormatado,
          text: conteudo.trim(),
        }),
      }
    );

    if (!responseEvolution.ok) {
      const erroEvolution = await responseEvolution.text();
      console.error('[Campanhas] Erro ao enviar mensagem Evolution:', erroEvolution);
      return res.status(500).json({ erro: 'Erro ao enviar mensagem pelo WhatsApp' });
    }

    const resultadoEvolution = await responseEvolution.json() as { key?: { id?: string } };

    const mensagemSalva = await prisma.mensagemProspeccao.create({
      data: {
        contatoId: id,
        direcao: 'SAIDA',
        tipo: 'TEXTO',
        conteudo: conteudo.trim(),
        telefone: telefoneFormatado,
        messageId: resultadoEvolution.key?.id || null,
        dataHora: new Date(),
      }
    });

    await prisma.contato.update({
      where: { id },
      data: { ultimaTentativa: new Date() }
    });

    return res.status(201).json({
      sucesso: true,
      mensagem: {
        id: mensagemSalva.id,
        tipo: 'ENVIADA',
        conteudo: mensagemSalva.conteudo,
        timestamp: mensagemSalva.dataHora.toISOString(),
        remetente: 'Corretor',
      }
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao enviar mensagem:', error);
    return res.status(500).json({ erro: 'Erro ao enviar mensagem' });
  }
});

// ============================================
// HISTÓRICO DE ATIVIDADES
// ============================================

/**
 * GET /contatos/:id/historico
 * Retorna o histórico de atividades de um contato
 */
router.get('/contatos/:id/historico', async (req, res) => {
  try {
    const { id } = req.params;

    const contato = await prisma.contato.findUnique({ where: { id } });

    if (!contato) {
      return res.status(404).json({ erro: 'Contato não encontrado' });
    }

    const historico: Array<{
      id: string;
      tipo: string;
      titulo: string;
      descricao: string;
      data: string;
      status: string;
      resultado: string | null;
    }> = [];

    // Evento de criação
    historico.push({
      id: `criacao-${contato.id}`,
      tipo: 'CRIACAO',
      titulo: 'Contato criado',
      descricao: 'Contato adicionado à campanha',
      data: contato.criadoEm.toISOString(),
      status: 'CONCLUIDA',
      resultado: null,
    });

    // Primeira mensagem
    const primeiraMensagem = await prisma.mensagemProspeccao.findFirst({
      where: { contatoId: id },
      orderBy: { dataHora: 'asc' }
    });

    if (primeiraMensagem) {
      historico.push({
        id: `msg-${primeiraMensagem.id}`,
        tipo: 'PRIMEIRO_CONTATO',
        titulo: 'Primeiro contato',
        descricao: 'Início da prospecção via WhatsApp',
        data: primeiraMensagem.dataHora.toISOString(),
        status: 'CONCLUIDA',
        resultado: null,
      });
    }

    // Quando respondeu
    if (contato.respondeu && contato.primeiraResposta) {
      historico.push({
        id: `resposta-${contato.id}`,
        tipo: 'RESPOSTA',
        titulo: 'Contato respondeu',
        descricao: 'Proprietário respondeu à mensagem',
        data: contato.primeiraResposta.toISOString(),
        status: 'CONCLUIDA',
        resultado: null,
      });
    }

    // Quando virou lead
    if (contato.virouLead && contato.virouLeadEm) {
      historico.push({
        id: `lead-${contato.id}`,
        tipo: 'CONVERSAO',
        titulo: 'Convertido para Lead',
        descricao: 'Proprietário convertido para lead qualificado',
        data: contato.virouLeadEm.toISOString(),
        status: 'CONCLUIDA',
        resultado: 'LEAD',
      });
    }

    // Recontato agendado
    if (contato.dataRecontato) {
      historico.push({
        id: `recontato-${contato.id}`,
        tipo: 'RECONTATO',
        titulo: 'Recontato agendado',
        descricao: contato.motivoRecontato || 'Follow-up programado',
        data: contato.dataRecontato.toISOString(),
        status: new Date() > contato.dataRecontato ? 'PENDENTE' : 'AGENDADO',
        resultado: null,
      });
    }

    // Ordenar por data decrescente
    historico.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    return res.json({ historico });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao buscar histórico:', error);
    return res.status(500).json({ erro: 'Erro ao buscar histórico' });
  }
});

export default router;
