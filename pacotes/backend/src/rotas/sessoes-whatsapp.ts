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

import { responderErro } from '../utilitarios/resposta';
import { Router, Request } from 'express';
import { prisma } from '../lib/db';
import { StatusConexao } from '@prisma/client';
import { getWhatsAppService, limparCacheWhatsApp } from '../servicos/whatsapp';
import axios from 'axios';
import { z } from 'zod';
import { verificarAutenticacao } from '../middleware/middleware-auth';
import { getTenantId } from '../utils/tenant';

const router = Router();

// Protege todas as rotas deste arquivo
router.use(verificarAutenticacao);

// ============================================
// HELPERS
// ============================================

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
 * ATUALIZADO: Agora verifica status real de cada sessão no Evolution API
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
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

    // Verificar status real de cada sessão no Evolution API
    const sessoesComStatusReal = await Promise.all(
      sessoes.map(async (s) => {
        try {
          const service = getWhatsAppService(s.instanceName);
          const statusEvolution = await service.verificarStatus();

          // Mapear estado do Evolution para nosso enum
          let statusReal: StatusConexao = s.status;
          let numeroAtualizado = s.numeroWhatsapp;
          let nomeAtualizado = s.nomeWhatsapp;

          if (statusEvolution?.instance?.state === 'open') {
            statusReal = StatusConexao.CONECTADO;

            // Buscar número e nome do perfil via fetchInstances (retorna dados completos)
            try {
              const apiUrl = process.env.EVOLUTION_API_URL || '';
              const apiKey = process.env.EVOLUTION_API_KEY || '';
              const instancesRes = await axios.get(
                `${apiUrl}/instance/fetchInstances?instanceName=${s.instanceName}`,
                { headers: { 'apikey': apiKey } }
              );
              const instanceData = instancesRes.data?.[0];
              if (instanceData?.ownerJid) {
                numeroAtualizado = instanceData.ownerJid.split('@')[0];
              }
              if (instanceData?.profileName) {
                nomeAtualizado = instanceData.profileName;
              }
            } catch (fetchErr) {
              console.warn(`[SessoesWhatsapp] Erro ao buscar dados da instância ${s.instanceName}:`, fetchErr);
            }
          } else if (statusEvolution?.instance?.state === 'connecting') {
            statusReal = StatusConexao.CONECTANDO;
          } else if (statusEvolution?.instance?.state === 'close' || !statusEvolution) {
            statusReal = StatusConexao.DESCONECTADO;
          }

          // Atualizar no banco se status mudou (para manter sincronizado)
          if (statusReal !== s.status || numeroAtualizado !== s.numeroWhatsapp) {
            await prisma.sessaoWhatsapp.update({
              where: { id: s.id },
              data: {
                status: statusReal,
                ultimoStatus: new Date(),
                numeroWhatsapp: statusReal === StatusConexao.DESCONECTADO ? null : numeroAtualizado,
                nomeWhatsapp: statusReal === StatusConexao.DESCONECTADO ? null : nomeAtualizado
              }
            }).catch(err => console.error('[SessoesWhatsapp] Erro ao atualizar status:', err));

            console.log(`[SessoesWhatsapp] 🔄 Status atualizado: ${s.instanceName} ${s.status} -> ${statusReal}`);
          }

          // Buscar configurações extras quando conectado
          let ignorarGrupos = false;
          let webhookBase64 = false;

          if (statusReal === StatusConexao.CONECTADO) {
            try {
              const config = await service.buscarConfiguracao();
              // Evolution API retorna groupsIgnore diretamente na raiz, não em settings
              ignorarGrupos = config?.groupsIgnore || false;
            } catch { }

            try {
              const apiUrl = process.env.EVOLUTION_API_URL || '';
              const apiKey = process.env.EVOLUTION_API_KEY || '';
              const webhookRes = await axios.get(
                `${apiUrl}/webhook/find/${s.instanceName}`,
                { headers: { 'apikey': apiKey } }
              );
              webhookBase64 = webhookRes.data?.webhookBase64 || false;
            } catch { }
          }

          return {
            id: s.id,
            nome: s.nome,
            descricao: s.descricao,
            instanceName: s.instanceName,
            numeroWhatsapp: statusReal === StatusConexao.DESCONECTADO ? null : numeroAtualizado,
            nomeWhatsapp: statusReal === StatusConexao.DESCONECTADO ? null : nomeAtualizado,
            status: statusReal,
            agente: s.agente,
            criadoEm: s.criadoEm,
            ignorarGrupos,
            webhookBase64
          };
        } catch (err) {
          // Se falhar ao verificar Evolution, retorna status do banco
          console.error(`[SessoesWhatsapp] Erro ao verificar ${s.instanceName}:`, err);
          return {
            id: s.id,
            nome: s.nome,
            descricao: s.descricao,
            instanceName: s.instanceName,
            numeroWhatsapp: s.numeroWhatsapp,
            nomeWhatsapp: s.nomeWhatsapp,
            status: s.status,
            agente: s.agente,
            criadoEm: s.criadoEm
          };
        }
      })
    );

    return res.json({
      sucesso: true,
      sessoes: sessoesComStatusReal
    });

  } catch (error: any) {
    console.error('[SessoesWhatsapp] Erro ao listar:', error);
    return responderErro(res, 500, 'Erro ao listar sessões');
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
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const dados = criarSessaoSchema.parse(req.body);

    // Gerar instanceName único
    const instanceName = gerarInstanceName(tenantId, dados.nome);

    // Verificar se já existe
    const existente = await prisma.sessaoWhatsapp.findUnique({
      where: { instanceName }
    });

    if (existente) {
      return responderErro(res, 400, 'Já existe uma sessão com este nome',
        {sugestao: 'Use um nome diferente'});
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
      return responderErro(res, 400, 'Dados inválidos', {detalhes: error.errors});
    }

    return responderErro(res, 500, 'Erro ao criar sessão');
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
      return responderErro(res, 401, 'Não autorizado');
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
      return responderErro(res, 404, 'Sessão não encontrada');
    }

    if (sessao.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    return res.json({ sucesso: true, sessao });

  } catch (error: any) {
    console.error('[SessoesWhatsapp] Erro ao buscar:', error);
    return responderErro(res, 500, 'Erro ao buscar sessão');
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
      return responderErro(res, 401, 'Não autorizado');
    }

    const { id } = req.params;

    const sessao = await prisma.sessaoWhatsapp.findUnique({ where: { id } });

    if (!sessao) {
      return responderErro(res, 404, 'Sessão não encontrada');
    }

    if (sessao.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
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
    return responderErro(res, 500, 'Erro ao deletar sessão');
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
      return responderErro(res, 401, 'Não autorizado');
    }

    const { id } = req.params;

    const sessao = await prisma.sessaoWhatsapp.findUnique({ where: { id } });

    if (!sessao) {
      return responderErro(res, 404, 'Sessão não encontrada');
    }

    if (sessao.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
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
      // Configurar webhook automaticamente quando conectado
      try {
        const backendUrl = process.env.BACKEND_URL || 'https://api.elyon.quadradois.com.br';
        const webhookUrl = `${backendUrl}/api/webhooks/whatsapp?instance=${sessao.instanceName}`;
        const apiUrl = process.env.EVOLUTION_API_URL || 'http://evolution:8080';
        
        await axios.post(
          `${apiUrl}/webhook/set/${sessao.instanceName}`,
          {
            webhook: {
              url: webhookUrl,
              webhook_by_events: true,
              events: [
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'MESSAGES_DELETE',
                'SEND_MESSAGE',
                'CONNECTION_UPDATE'
              ],
              base64: false
            }
          }
        );
        
        console.log(`[SessoesWhatsapp] ✅ Webhook configurado automaticamente para ${sessao.instanceName}`);
      } catch (webhookError: any) {
        console.error('[SessoesWhatsapp] ⚠️ Erro ao configurar webhook automaticamente:', webhookError.message);
        // Não falha a conexão se o webhook não conseguir ser configurado
      }
      
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
    return responderErro(res, 500, 'Erro interno do servidor');
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
      return responderErro(res, 401, 'Não autorizado');
    }

    const { id } = req.params;

    const sessao = await prisma.sessaoWhatsapp.findUnique({ where: { id } });

    if (!sessao) {
      return responderErro(res, 404, 'Sessão não encontrada');
    }

    if (sessao.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
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
    return responderErro(res, 500, 'Erro ao verificar status');
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
      return responderErro(res, 401, 'Não autorizado');
    }

    const { id } = req.params;

    const sessao = await prisma.sessaoWhatsapp.findUnique({ where: { id } });

    if (!sessao) {
      return responderErro(res, 404, 'Sessão não encontrada');
    }

    if (sessao.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
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
    return responderErro(res, 500, 'Erro ao desconectar');
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
      return responderErro(res, 401, 'Não autorizado');
    }

    const { id } = req.params;

    const sessao = await prisma.sessaoWhatsapp.findUnique({ where: { id } });

    if (!sessao) {
      return responderErro(res, 404, 'Sessão não encontrada');
    }

    if (sessao.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    const service = getWhatsAppService(sessao.instanceName);

    // Buscar settings da instância
    const settings = await service.buscarConfiguracao();

    // Buscar configuração do webhook
    let webhookConfig = null;
    try {
      const apiUrl = process.env.EVOLUTION_API_URL || '';
      const apiKey = process.env.EVOLUTION_API_KEY || '';

      const webhookResponse = await axios.get(
        `${apiUrl}/webhook/find/${sessao.instanceName}`,
        { headers: { 'apikey': apiKey } }
      );
      webhookConfig = webhookResponse.data;
    } catch (err) {
      console.warn('[SessoesWhatsapp] Webhook não encontrado para', sessao.instanceName);
    }

    return res.json({
      sucesso: true,
      config: {
        settings,
        webhook: webhookConfig
      }
    });

  } catch (error: any) {
    console.error('[SessoesWhatsapp] Erro ao buscar configuração:', error);
    return responderErro(res, 500, 'Erro ao buscar configuração');
  }
});

/**
 * POST /api/sessoes-whatsapp/:id/configurar
 * Configurações da sessão (ex: ignorar grupos, webhookBase64)
 */
router.post('/:id/configurar', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado');
    }

    const { id } = req.params;
    const { ignorarGrupos, webhookBase64 } = req.body;

    const sessao = await prisma.sessaoWhatsapp.findUnique({ where: { id } });

    if (!sessao) {
      return responderErro(res, 404, 'Sessão não encontrada');
    }

    if (sessao.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    const service = getWhatsAppService(sessao.instanceName);

    // Se foi passado ignorarGrupos, atualiza
    if (typeof ignorarGrupos === 'boolean') {
      await service.atualizarConfiguracao(ignorarGrupos);
    }

    // Se foi passado webhookBase64, atualiza o webhook
    if (typeof webhookBase64 === 'boolean') {
      const backendUrl = process.env.BACKEND_URL || 'https://api.elyon.quadradois.com.br';
      const webhookUrl = `${backendUrl}/api/webhooks/whatsapp?instance=${sessao.instanceName}`;

      const apiUrl = process.env.EVOLUTION_API_URL || '';
      const apiKey = process.env.EVOLUTION_API_KEY || '';

      try {
        await axios.post(
          `${apiUrl}/webhook/set/${sessao.instanceName}`,
          {
            webhook: {
              url: webhookUrl,
              enabled: true,
              byEvents: false,
              base64: webhookBase64,
              events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE']
            }
          },
          { headers: { 'Content-Type': 'application/json', 'apikey': apiKey } }
        );
        console.log(`[SessoesWhatsapp] Webhook Base64 ${webhookBase64 ? 'ativado' : 'desativado'} para ${sessao.instanceName}`);
      } catch (webhookError: any) {
        console.error('[SessoesWhatsapp] Erro ao configurar webhook:', webhookError.message);
        return responderErro(res, 500, 'Erro ao configurar webhook Base64');
      }
    }

    return res.json({ sucesso: true, mensagem: 'Configuração atualizada' });

  } catch (error: any) {
    console.error('[SessoesWhatsapp] Erro ao configurar:', error);
    return responderErro(res, 500, 'Erro ao atualizar configuração');
  }
});

export default router;
