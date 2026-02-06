/**
 * ROTAS DE CONFIGURAÇÃO DE AGENTES
 * 
 * CRUD para ConfiguracaoAgente do tenant
 * Implementado: Week 1-2 Foundation
 */

import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';

const router = Router();

// ====================================
// HELPER PARA TENANT
// ====================================
const getTenantId = (req: Request): string | null => {
  // 1. Do middleware de autenticação
  if ((req as any).tenantId) {
    return (req as any).tenantId;
  }

  // 2. Header x-tenant-id
  if (req.headers['x-tenant-id']) {
    return req.headers['x-tenant-id'] as string;
  }

  return null;
};

// Schema de validação
const agenteSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  avatar: z.string().optional().nullable(),
  genero: z.string().default('feminino'), // 🆕
  personalidade: z.record(z.any()).default({}), // JSON
  expertise: z.record(z.any()).default({}),     // JSON
  scripts: z.record(z.any()).default({}),       // JSON
  regrasNegocio: z.record(z.any()).default({}), // JSON
  estaAtivo: z.boolean().default(true),
  sessaoWhatsappId: z.string().optional().nullable(),
  tipoAgente: z.enum(['SDR_CAPTACAO', 'SDR_VENDAS', 'SDR_LOCACAO', 'DOCUMENTOS', 'PERSONALIZADO']).optional(),
});

// GET /api/agentes - Lista TODOS os agentes do tenant
router.get('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado - tenant não identificado' });
    }

    // Busca todos os agentes do tenant
    const agentes = await prisma.configuracaoAgente.findMany({
      where: { tenantId },
      include: {
        sessaoWhatsapp: {
          select: {
            id: true,
            nome: true,
            numeroWhatsapp: true
          }
        }
      },
      orderBy: { criadoEm: 'desc' }
    });

    // Também retorna 'agente' (primeiro) para backward compatibility
    return res.json({
      agentes,
      agente: agentes[0] || null  // Backward compat com código antigo
    });

  } catch (error) {
    console.error('Erro ao buscar agentes:', error);
    return res.status(500).json({ erro: 'Erro interno ao buscar agentes' });
  }
});

// POST /api/agentes - Cria NOVO agente (para multi-agent support)
router.post('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado - tenant não identificado' });
    }

    // Validação
    const dados = agenteSchema.parse(req.body);

    // Pegar tipoAgente do body ou usar default
    const tipoAgente = req.body.tipoAgente || 'SDR_CAPTACAO';

    // Sempre cria novo agente
    const agente = await prisma.configuracaoAgente.create({
      data: {
        tenantId,
        nome: dados.nome,
        avatar: dados.avatar,
        genero: dados.genero,
        personalidade: dados.personalidade,
        expertise: dados.expertise,
        scripts: dados.scripts,
        regrasNegocio: dados.regrasNegocio,
        estaAtivo: dados.estaAtivo,
        tipoAgente: tipoAgente as any,
        modoCreacao: 'PRE_TREINADO',
        sessaoWhatsappId: dados.sessaoWhatsappId,
      },
      include: {
        sessaoWhatsapp: {
          select: {
            id: true,
            nome: true,
            numeroWhatsapp: true
          }
        }
      }
    });

    return res.status(201).json({ agente });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: error.errors });
    }
    console.error('Erro ao criar agente:', error);
    return res.status(500).json({ erro: 'Erro interno ao criar agente' });
  }
});

// DELETE /api/agentes - Reseta configuração (opcional)
router.delete('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado - tenant não identificado' });
    }

    await prisma.configuracaoAgente.deleteMany({
      where: {
        tenantId,
        tipoAgente: 'SDR_CAPTACAO'
      },
    });

    return res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao deletar agente:', error);
    return res.status(500).json({ erro: 'Erro ao remover configuração' });
  }
});

// ====================================
// ROTAS COM :id (CRUD individual)
// ====================================

// GET /api/agentes/:id - Buscar agente específico
router.get('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado - tenant não identificado' });
    }

    const agente = await prisma.configuracaoAgente.findFirst({
      where: { id, tenantId }, // Segurança: valida tenant
      include: {
        sessaoWhatsapp: {
          select: {
            id: true,
            nome: true,
            numeroWhatsapp: true
          }
        }
      }
    });

    if (!agente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    return res.json({ agente });
  } catch (error) {
    console.error('Erro ao buscar agente por ID:', error);
    return res.status(500).json({ erro: 'Erro interno ao buscar agente' });
  }
});

// PUT /api/agentes/:id - Atualizar agente específico
router.put('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado - tenant não identificado' });
    }

    // Verificar propriedade
    const existente = await prisma.configuracaoAgente.findFirst({
      where: { id, tenantId }
    });

    if (!existente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    const dados = agenteSchema.partial().parse(req.body);

    const agente = await prisma.configuracaoAgente.update({
      where: { id },
      data: {
        ...(dados.nome && { nome: dados.nome }),
        ...(dados.avatar !== undefined && { avatar: dados.avatar }),
        ...(dados.genero && { genero: dados.genero }),
        ...(dados.personalidade && { personalidade: dados.personalidade }),
        ...(dados.expertise && { expertise: dados.expertise }),
        ...(dados.scripts && { scripts: dados.scripts }),
        ...(dados.regrasNegocio && { regrasNegocio: dados.regrasNegocio }),
        ...(dados.estaAtivo !== undefined && { estaAtivo: dados.estaAtivo }),
        ...(dados.sessaoWhatsappId !== undefined && { sessaoWhatsappId: dados.sessaoWhatsappId }),
        ...(dados.tipoAgente && { tipoAgente: dados.tipoAgente as any }),
      }
    });

    return res.json({ agente });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: error.errors });
    }
    console.error('Erro ao atualizar agente:', error);
    return res.status(500).json({ erro: 'Erro interno ao atualizar agente' });
  }
});

// PATCH /api/agentes/:id/ativar - Ativar agente
router.patch('/:id/ativar', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    const existente = await prisma.configuracaoAgente.findFirst({
      where: { id, tenantId }
    });

    if (!existente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    const agente = await prisma.configuracaoAgente.update({
      where: { id },
      data: { estaAtivo: true }
    });

    return res.json({ agente, mensagem: 'Agente ativado com sucesso' });
  } catch (error) {
    console.error('Erro ao ativar agente:', error);
    return res.status(500).json({ erro: 'Erro ao ativar agente' });
  }
});

// PATCH /api/agentes/:id/desativar - Desativar agente
router.patch('/:id/desativar', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    const existente = await prisma.configuracaoAgente.findFirst({
      where: { id, tenantId }
    });

    if (!existente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    const agente = await prisma.configuracaoAgente.update({
      where: { id },
      data: { estaAtivo: false }
    });

    return res.json({ agente, mensagem: 'Agente desativado com sucesso' });
  } catch (error) {
    console.error('Erro ao desativar agente:', error);
    return res.status(500).json({ erro: 'Erro ao desativar agente' });
  }
});

// PATCH /api/agentes/:id/aceitar-termos - Aceitar termos de uso
router.patch('/:id/aceitar-termos', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { versao } = req.body;

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    const existente = await prisma.configuracaoAgente.findFirst({
      where: { id, tenantId }
    });

    if (!existente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    const agente = await prisma.configuracaoAgente.update({
      where: { id },
      data: {
        termosAceitos: true,
        termosVersao: versao || '1.0',
        termosAceitosEm: new Date()
      }
    });

    return res.json({ agente, mensagem: 'Termos aceitos com sucesso' });
  } catch (error) {
    console.error('Erro ao aceitar termos:', error);
    return res.status(500).json({ erro: 'Erro ao aceitar termos' });
  }
});

// DELETE /api/agentes/:id - Remover agente específico
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    const existente = await prisma.configuracaoAgente.findFirst({
      where: { id, tenantId }
    });

    if (!existente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    await prisma.configuracaoAgente.delete({
      where: { id }
    });

    return res.json({ sucesso: true, mensagem: 'Agente removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar agente:', error);
    return res.status(500).json({ erro: 'Erro ao remover agente' });
  }
});


export default router;

