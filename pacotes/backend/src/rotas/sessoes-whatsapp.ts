/**
 * ROTAS DE SESSÕES WHATSAPP
 * 
 * Gerencia múltiplas sessões WhatsApp por tenant
 * Cada sessão pode ser vinculada a um agente IA
 * 
 * Endpoints:
 * - GET    /api/sessoes-whatsapp              - Lista sessões do tenant
 * - POST   /api/sessoes-whatsapp              - Cria nova sessão
 * - GET    /api/sessoes-whatsapp/:id          - Obtém sessão específica
 * - DELETE /api/sessoes-whatsapp/:id          - Remove sessão
 * - POST   /api/sessoes-whatsapp/:id/conectar - Conecta (gera QR Code)
 * - GET    /api/sessoes-whatsapp/:id/status   - Status de conexão
 * - POST   /api/sessoes-whatsapp/:id/desconectar - Desconecta
 */

import { Router, Request } from 'express';
import { prisma } from '../lib/db';
import { getWhatsAppService, limparCacheWhatsApp } from '../servicos/whatsapp';
import axios from 'axios';
import { z } from 'zod';

const router = Router();

// ============================================
// HELPERS
// ============================================

/**
 * Extrai tenantId do request
 */
const getTenantId = (req: Request): string | null => {
  if ((req as any).tenantId) return (req as any).tenantId;
  if (req.headers['x-tenant-id']) return req.headers['x-tenant-id'] as string;
  if (req.query.tenantId) return req.query.tenantId as string;
  return null;
};

/**
 * Gera instanceName único para a sessão
 */
const gerarInstanceName = (tenantId: string, slug: string): string => {
  // Remove caracteres especiais do slug
  const slugLimpo = slug.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `elyon_${tenantId.substring(0, 8)}_${slugLimpo}`;
};

// ============================================
// SCHEMAS ZOD
// ============================================

const criarSessaoSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  descricao: z.string().optional(),
  agenteId: z.string().optional(), // Vincular a agente existente
});

// ============================================
// ROTAS
// ============================================

/**
 * GET /api/sessoes-whatsapp
 * Lista todas as sessões do tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado - tenant não identificado' });
    }

    const sessoes = await prisma.sessaoWhatsapp.findMany({
      where: { tenantId },
      include: {
        agente: {
          select: { id: true, nome: true, tipoAgente: true }
        }
      },
      orderBy: { criadoEm: 'desc' }
    });

    return res.json({
      sucesso: true,
      sessoes: sessoes.map(s => ({
        id: s.id,
        nome: s.nome,
        descricao: s.descricao,
        instanceName: s.instanceName,
        numeroWhatsapp: s.numeroWhatsapp,
        nomeWhatsapp: s.nomeWhatsapp,
        status: s.status,
        agente: s.agente,
        criadoEm: s.criadoEm
      }))
    });

  } catch (error: any) {
    console.error('[SessoesWhatsapp] Erro ao listar:', error);
    return res.status(500).json({ erro: 'Erro ao listar sessões' });
  }
});

/**
 * POST /api/sessoes-whatsapp
 * Cria nova sessão WhatsApp
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado - tenant não identificado' });
    }

    const dados = criarSessaoSchema.parse(req.body);
    
    // Gerar instanceName único
    const instanceName = gerarInstanceName(tenantId, dados.nome);
    
    // Verificar se já existe
    const existente = await prisma.sessaoWhatsapp.findUnique({
      where: { instanceName }
    });
    
    if (existente) {
      return res.status(400).json({ 
        erro: 'Já existe uma sessão com este nome',
        sugestao: 'Use um nome diferente'
      });
    }

    // Criar sessão no banco
    const sessao = await prisma.sessaoWhatsapp.create({
      data: {
        tenantId,
        nome: dados.nome,
        descricao: dados.descricao,
        instanceName,
        status: 'DESCONECTADO'
      }
    });

    // Se tem agenteId, vincular
    if (dados.agenteId) {
      await prisma.configuracaoAgente.update({
        where: { id: dados.agenteId },
        data: { sessaoWhatsappId: sessao.id }
      });
    }

    console.log(`[SessoesWhatsapp] ✅ Sessão criada: ${sessao.nome} (${instanceName})`);

    return res.status(201).json({
      sucesso: true,
      sessao: {
        id: sessao.id,
        nome: sessao.nome,
        instanceName: sessao.instanceName,
        status: sessao.status
      }
    });

  } catch (error: any) {
    console.error('[SessoesWhatsapp] Erro ao criar:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: error.errors });
    }
    
    return res.status(500).json({ erro: 'Erro ao criar sessão' });
  }
});

/**
 * GET /api/sessoes-whatsapp/:id
 * Obtém sessão específica
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    const { id } = req.params;

    const sessao = await prisma.sessaoWhatsapp.findUnique({
      where: { id },
      include: {
        agente: {
          select: { id: true, nome: true, tipoAgente: true, status: true }
        }
      }
    });

    if (!sessao) {
      return res.status(404).json({ erro: 'Sessão não encontrada' });
    }

    if (sessao.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    return res.json({ sucesso: true, sessao });

  } catch (error: any) {
    console.error('[SessoesWhatsapp] Erro ao buscar:', error);
    return res.status(500).json({ erro: 'Erro ao buscar sessão' });
  }
});

/**
 * DELETE /api/sessoes-whatsapp/:id
 * Remove sessão (desconecta primeiro)
 */
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    const { id } = req.params;

    const sessao = await prisma.sessaoWhatsapp.findUnique({ where: { id } });

    if (!sessao) {
      return res.status(404).json({ erro: 'Sessão não encontrada' });
    }

    if (sessao.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    // Tentar deletar instância na Evolution API
    try {
      await axios.delete(
        `${process.env.EVOLUTION_API_URL}/instance/delete/${sessao.instanceName}`,
        { headers: { apikey: process.env.EVOLUTION_API_KEY } }
      );
    } catch (e) {
      console.log('[SessoesWhatsapp] Instância já não existia na Evolution');
    }

    // Limpar cache
    limparCacheWhatsApp(sessao.instanceName);

    // Deletar do banco
    await prisma.sessaoWhatsapp.delete({ where: { id } });

    console.log(`[SessoesWhatsapp] ✅ Sessão deletada: ${sessao.nome}`);

    return res.json({ sucesso: true, mensagem: 'Sessão removida' });

  } catch (error: any) {
    console.error('[SessoesWhatsapp] Erro ao deletar:', error);
    return res.status(500).json({ erro: 'Erro ao deletar sessão' });
  }
});

/**
 * POST /api/sessoes-whatsapp/:id/conectar
 * Conecta sessão (gera QR Code)
 */
router.post('/:id/conectar', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    const { id } = req.params;

    const sessao = await prisma.sessaoWhatsapp.findUnique({ where: { id } });

    if (!sessao) {
      return res.status(404).json({ erro: 'Sessão não encontrada' });
    }

    if (sessao.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    // Atualizar status
    await prisma.sessaoWhatsapp.update({
      where: { id },
      data: { status: 'CONECTANDO', ultimoStatus: new Date() }
    });

    // Obter serviço para esta instância
    const service = getWhatsAppService(sessao.instanceName);
    
    console.log(`[SessoesWhatsapp] 🔄 Conectando: ${sessao.instanceName}`);
    
    const resultado = await service.conectarInstancia();

    // Verificar resposta
    if (resultado?.base64 || resultado?.qrcode) {
      const qrCode = resultado.base64 || resultado.qrcode;
      return res.json({ 
        sucesso: true, 
        qrcode: qrCode,
        instanceName: sessao.instanceName
      });
    }

    // Verificar se já está conectado
    const status = await service.verificarStatus();
    if (status?.instance?.state === 'open') {
      await prisma.sessaoWhatsapp.update({
        where: { id },
        data: { status: 'CONECTADO', ultimoStatus: new Date() }
      });
      return res.json({ sucesso: true, status: 'CONECTADO' });
    }

    return res.json({ 
      sucesso: true, 
      status: status?.instance?.state || 'AGUARDANDO'
    });

  } catch (error: any) {
    console.error('[SessoesWhatsapp] Erro ao conectar:', error);
    return res.status(500).json({ 
      erro: 'Erro ao conectar',
      detalhes: error.message 
    });
  }
});

/**
 * GET /api/sessoes-whatsapp/:id/status
 * Verifica status de conexão
 */
router.get('/:id/status', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    const { id } = req.params;

    const sessao = await prisma.sessaoWhatsapp.findUnique({ where: { id } });

    if (!sessao) {
      return res.status(404).json({ erro: 'Sessão não encontrada' });
    }

    if (sessao.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const service = getWhatsAppService(sessao.instanceName);
    const status = await service.verificarStatus();

    // Mapear status Evolution para nosso enum
    let novoStatus = sessao.status;
    let numeroWhatsapp = sessao.numeroWhatsapp;
    let nomeWhatsapp = sessao.nomeWhatsapp;

    if (status?.instance?.state === 'open') {
      novoStatus = 'CONECTADO';
      
      // Tentar capturar número e nome se disponíveis
      // Evolution v2 geralmente retorna ownerJid no formato 5511999999999@s.whatsapp.net
      if ((status.instance as any).ownerJid) {
        const jid = (status.instance as any).ownerJid;
        numeroWhatsapp = jid.split('@')[0];
      } else {
        // Se não veio no status, tentar buscar detalhes da instância
        // Isso é mais pesado, mas garante que pegamos o número
        try {
          const detalhes = await service.buscarDetalhesInstancia();
          // Na API v2, o objeto vem direto, com ownerJid
          if (detalhes?.ownerJid) {
            const jid = detalhes.ownerJid;
            numeroWhatsapp = jid.split('@')[0];
          }
          if (detalhes?.profileName) {
            nomeWhatsapp = detalhes.profileName;
          }
        } catch (err) {
          console.error('Erro ao buscar detalhes extras:', err);
        }
      }
      
      if ((status.instance as any).profileName) {
        nomeWhatsapp = (status.instance as any).profileName;
      }
    } else if (status?.instance?.state === 'connecting') {
      novoStatus = 'CONECTANDO';
    } else if (status?.instance?.state === 'close') {
      novoStatus = 'DESCONECTADO';
    }

    // Atualizar no banco se mudou status ou descobriu número
    if (novoStatus !== sessao.status || numeroWhatsapp !== sessao.numeroWhatsapp) {
      await prisma.sessaoWhatsapp.update({
        where: { id },
        data: { 
          status: novoStatus, 
          ultimoStatus: new Date(),
          numeroWhatsapp,
          nomeWhatsapp
        }
      });
    }

    return res.json({
      sucesso: true,
      status: novoStatus,
      instanceName: sessao.instanceName,
      numeroWhatsapp,
      detalhes: status?.instance
    });

  } catch (error: any) {
    console.error('[SessoesWhatsapp] Erro ao verificar status:', error);
    return res.status(500).json({ erro: 'Erro ao verificar status' });
  }
});

/**
 * POST /api/sessoes-whatsapp/:id/desconectar
 * Desconecta sessão (logout)
 */
router.post('/:id/desconectar', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    const { id } = req.params;

    const sessao = await prisma.sessaoWhatsapp.findUnique({ where: { id } });

    if (!sessao) {
      return res.status(404).json({ erro: 'Sessão não encontrada' });
    }

    if (sessao.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    // Logout na Evolution API
    try {
      await axios.delete(
        `${process.env.EVOLUTION_API_URL}/instance/logout/${sessao.instanceName}`,
        { headers: { apikey: process.env.EVOLUTION_API_KEY } }
      );
    } catch (e) {
      console.log('[SessoesWhatsapp] Logout falhou (pode já estar desconectado)');
    }

    // Atualizar status
    await prisma.sessaoWhatsapp.update({
      where: { id },
      data: { 
        status: 'DESCONECTADO', 
        ultimoStatus: new Date(),
        numeroWhatsapp: null,
        nomeWhatsapp: null
      }
    });

    // Limpar cache
    limparCacheWhatsApp(sessao.instanceName);

    console.log(`[SessoesWhatsapp] ✅ Sessão desconectada: ${sessao.nome}`);

    return res.json({ sucesso: true, mensagem: 'Sessão desconectada' });

  } catch (error: any) {
    console.error('[SessoesWhatsapp] Erro ao desconectar:', error);
    return res.status(500).json({ erro: 'Erro ao desconectar' });
  }
});

/**
 * GET /api/sessoes-whatsapp/:id/configurar
 * Obtém configurações da sessão
 */
router.get('/:id/configurar', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    const { id } = req.params;

    const sessao = await prisma.sessaoWhatsapp.findUnique({ where: { id } });

    if (!sessao) {
      return res.status(404).json({ erro: 'Sessão não encontrada' });
    }

    if (sessao.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const service = getWhatsAppService(sessao.instanceName);
    const config = await service.buscarConfiguracao();

    return res.json({ sucesso: true, config });

  } catch (error: any) {
    console.error('[SessoesWhatsapp] Erro ao buscar configuração:', error);
    return res.status(500).json({ erro: 'Erro ao buscar configuração' });
  }
});

/**
 * POST /api/sessoes-whatsapp/:id/configurar
 * Configurações da sessão (ex: ignorar grupos)
 */
router.post('/:id/configurar', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    const { id } = req.params;
    const { ignorarGrupos } = req.body;

    const sessao = await prisma.sessaoWhatsapp.findUnique({ where: { id } });

    if (!sessao) {
      return res.status(404).json({ erro: 'Sessão não encontrada' });
    }

    if (sessao.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const service = getWhatsAppService(sessao.instanceName);
    
    // Se foi passado ignorarGrupos, atualiza
    if (typeof ignorarGrupos === 'boolean') {
      await service.atualizarConfiguracao(ignorarGrupos);
    }

    return res.json({ sucesso: true, mensagem: 'Configuração atualizada' });

  } catch (error: any) {
    console.error('[SessoesWhatsapp] Erro ao configurar:', error);
    return res.status(500).json({ erro: 'Erro ao atualizar configuração' });
  }
});

export default router;
