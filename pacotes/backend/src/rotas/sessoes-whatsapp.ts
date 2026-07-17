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
import {
  getWhatsAppService,
  limparCacheWhatsApp,
  listarInstanciasEvolution,
  deletarInstanciaEvolutionPorId,
} from '../servicos/whatsapp';
import { z } from 'zod';
import { verificarAutenticacao, verificarSuperAdmin } from '../middleware/middleware-auth';
import { getTenantId } from '../utils/tenant';
import { logger } from '../lib/logger';
import { publicConnectionFailure } from '../servicos/evolution-error';

const router = Router();

// Protege todas as rotas deste arquivo
router.use(verificarAutenticacao);

// ============================================
// HELPERS
// ============================================

/**
 * Prefixo que identifica instâncias do Elyon no Evolution GO.
 * O servidor é COMPARTILHADO com outros projetos (ex.: QuadraDois usa `tenant_*`),
 * então toda operação administrativa em massa DEVE filtrar por este prefixo.
 */
const PREFIXO_ELYON = 'elyon_';

/**
 * Gera instanceName único para a sessão
 */
const gerarInstanceName = (tenantId: string, slug: string): string => {
  // Remove caracteres especiais do slug
  const slugLimpo = slug.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${PREFIXO_ELYON}${tenantId.substring(0, 8)}_${slugLimpo}`;
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
// RECONCILIAÇÃO (ADMIN) — instâncias órfãs no Evolution GO
// ============================================

interface RelatorioReconciliacao {
  totalInstanciasElyon: number;
  totalSessoesBanco: number;
  orfas: Array<{ id: string; name: string; connected: boolean; createdAt: string | null }>;
  fantasmas: Array<{ instanceName: string; nome: string }>; // sessão no banco sem instância no servidor
}

export async function restaurarStatusSeTentativaAtual(
  sessaoId: string,
  tentativaIniciadaEm: Date,
): Promise<boolean> {
  const result = await prisma.sessaoWhatsapp.updateMany({
    where: {
      id: sessaoId,
      status: StatusConexao.CONECTANDO,
      ultimoStatus: tentativaIniciadaEm,
    },
    data: { status: StatusConexao.DESCONECTADO, ultimoStatus: new Date() },
  });
  return result.count === 1;
}

/**
 * Cruza as instâncias do Evolution GO (filtradas pelo prefixo do Elyon) com as
 * sessões do banco e identifica divergências:
 *  - órfãs:    instância existe no Evolution GO mas NÃO há sessão no banco (lixo a remover)
 *  - fantasmas: sessão existe no banco mas NÃO há instância no servidor (apenas informativo)
 */
async function montarRelatorioReconciliacao(): Promise<RelatorioReconciliacao> {
  const [instancias, sessoes] = await Promise.all([
    listarInstanciasEvolution(),
    prisma.sessaoWhatsapp.findMany({
      select: { instanceName: true, evolutionInstanceId: true, nome: true },
    }),
  ]);

  // Só consideramos instâncias do Elyon — o servidor é compartilhado.
  const instanciasElyon = instancias.filter(
    (i: any) => typeof i?.name === 'string' && i.name.startsWith(PREFIXO_ELYON),
  );

  const nomesBanco = new Set(sessoes.map((s) => s.instanceName));
  const idsBanco = new Set(sessoes.map((s) => s.evolutionInstanceId).filter(Boolean));

  const orfas = instanciasElyon
    .filter((i: any) => !nomesBanco.has(i.name) && !idsBanco.has(i.id))
    .map((i: any) => ({
      id: i.id,
      name: i.name,
      connected: !!i.connected,
      createdAt: i.createdAt || null,
    }));

  const nomesServidor = new Set(instanciasElyon.map((i: any) => i.name));
  const fantasmas = sessoes
    .filter((s) => !nomesServidor.has(s.instanceName))
    .map((s) => ({ instanceName: s.instanceName, nome: s.nome }));

  return {
    totalInstanciasElyon: instanciasElyon.length,
    totalSessoesBanco: sessoes.length,
    orfas,
    fantasmas,
  };
}

/**
 * GET /api/sessoes-whatsapp/admin/reconciliacao
 * Dry-run: lista instâncias órfãs do Elyon no Evolution GO (não remove nada).
 * Restrito a SUPER_ADMIN.
 */
router.get('/admin/reconciliacao', verificarSuperAdmin, async (_req, res) => {
  try {
    const relatorio = await montarRelatorioReconciliacao();
    return res.json({ sucesso: true, ...relatorio });
  } catch (error: any) {
    logger.error('[SessoesWhatsapp] Erro na reconciliação dry-run');
    return responderErro(res, 502, 'Não foi possível consultar o Evolution GO');
  }
});

/**
 * POST /api/sessoes-whatsapp/admin/reconciliacao
 * Executa a faxina: remove do Evolution GO as instâncias órfãs do Elyon.
 * Restrito a SUPER_ADMIN.
 */
router.post('/admin/reconciliacao', verificarSuperAdmin, async (_req, res) => {
  try {
    const relatorio = await montarRelatorioReconciliacao();

    const removidas: string[] = [];
    const falhas: Array<{ name: string; erro: string }> = [];

    for (const orfa of relatorio.orfas) {
      try {
        await deletarInstanciaEvolutionPorId(orfa.id);
        limparCacheWhatsApp(orfa.name);
        removidas.push(orfa.name);
        logger.info(
          { remoteIdPresent: true },
          '[Reconciliação] Instância órfã removida do Evolution Go',
        );
      } catch (e: any) {
        falhas.push({ name: orfa.name, erro: e?.message || 'erro desconhecido' });
        logger.error('[Reconciliação] Falha ao remover instância órfã');
      }
    }

    return res.json({
      sucesso: true,
      analisadas: relatorio.orfas.length,
      removidas,
      falhas,
      fantasmas: relatorio.fantasmas,
    });
  } catch (error: any) {
    logger.error('[SessoesWhatsapp] Erro na execução da reconciliação');
    return responderErro(res, 502, 'Não foi possível consultar o Evolution GO');
  }
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

            if (statusEvolution.instance.profileName) {
              nomeAtualizado = statusEvolution.instance.profileName;
            }

            // Buscar número do WhatsApp (jid) via /instance/all
            try {
              const detalhes = await service.buscarDetalhesInstancia();
              if (detalhes?.ownerJid) {
                numeroAtualizado = String(detalhes.ownerJid).split('@')[0].split(':')[0];
              }
              if (detalhes?.profileName) {
                nomeAtualizado = detalhes.profileName;
              }
            } catch (fetchErr) {
              logger.warn('[SessoesWhatsapp] Erro ao buscar dados da instância');
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
            }).catch(() => logger.error('[SessoesWhatsapp] Erro ao atualizar status'));

            logger.info(
              { previousStatus: s.status, currentStatus: statusReal },
              '[SessoesWhatsapp] Status atualizado',
            );
          }

          // Buscar configurações extras quando conectado
          let ignorarGrupos = false;

          if (statusReal === StatusConexao.CONECTADO) {
            try {
              const config = await service.buscarConfiguracao();
              ignorarGrupos = config?.groupsIgnore || false;
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
            ignorarGrupos
          };
        } catch (err) {
          // Se falhar ao verificar Evolution, retorna status do banco
          logger.error('[SessoesWhatsapp] Erro ao verificar instância');
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
    logger.error('[SessoesWhatsapp] Erro ao listar sessões');
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

    logger.info('[SessoesWhatsapp] Sessão criada');

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
    logger.error('[SessoesWhatsapp] Erro ao criar sessão');

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
    logger.error('[SessoesWhatsapp] Erro ao buscar sessão');
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

    // Deletar instância no Evolution GO ANTES de remover o registro local.
    // Se a remoção remota falhar de verdade (rede/5xx), abortamos e mantemos
    // o registro — assim o usuário pode retentar e não acumulamos instâncias
    // órfãs no Evolution GO.
    try {
      const resultado = await getWhatsAppService(sessao.instanceName).deletarInstancia();
      if (resultado === 'inexistente') {
        logger.info('[SessoesWhatsapp] Instância já não existia no Evolution Go');
      }
    } catch (e: any) {
      logger.error('[SessoesWhatsapp] Falha ao deletar instância no Evolution Go; exclusão local abortada');
      return responderErro(
        res,
        502,
        'Não foi possível remover a instância no Evolution GO. A sessão foi mantida — tente novamente em instantes.',
      );
    }

    // Limpar cache
    limparCacheWhatsApp(sessao.instanceName);

    // Deletar do banco (apenas após confirmar remoção no Evolution GO)
    await prisma.sessaoWhatsapp.delete({ where: { id } });

    logger.info('[SessoesWhatsapp] Sessão deletada localmente e no Evolution Go');

    return res.json({ sucesso: true, mensagem: 'Sessão removida' });

  } catch (error: any) {
    logger.error('[SessoesWhatsapp] Erro ao deletar sessão');
    return responderErro(res, 500, 'Erro ao deletar sessão');
  }
});

/**
 * POST /api/sessoes-whatsapp/:id/conectar
 * Conecta sessão (gera QR Code)
 */
router.post('/:id/conectar', async (req, res) => {
  let sessaoEmConexaoId: string | undefined;
  let tentativaIniciadaEm: Date | undefined;
  let evolutionInstanceIdPresent = false;
  let evolutionTokenPresent = false;

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

    evolutionInstanceIdPresent = !!sessao.evolutionInstanceId;
    evolutionTokenPresent = !!sessao.evolutionToken;

    // Atualizar status
    const marcadorTentativa = new Date();
    await prisma.sessaoWhatsapp.update({
      where: { id },
      data: { status: StatusConexao.CONECTANDO, ultimoStatus: marcadorTentativa }
    });
    sessaoEmConexaoId = sessao.id;
    tentativaIniciadaEm = marcadorTentativa;

    // Obter serviço para esta instância
    const service = getWhatsAppService(sessao.instanceName);

    logger.info({ stage: 'instance/connect' }, '[SessoesWhatsapp] Iniciando conexão');

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
      // O webhook já é configurado pelo conectarInstancia (/instance/connect).
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
    if (sessaoEmConexaoId && tentativaIniciadaEm) {
      try {
        const restored = await restaurarStatusSeTentativaAtual(sessaoEmConexaoId, tentativaIniciadaEm);
        if (!restored) {
          logger.warn(
            { reasonCode: 'WHATSAPP_CONNECTION_ATTEMPT_SUPERSEDED' },
            '[SessoesWhatsapp] Rollback ignorado para tentativa de conexão substituída',
          );
        }
      } catch {
        logger.error(
          { stage: 'banco', reasonCode: 'WHATSAPP_STATUS_ROLLBACK_FAILED' },
          '[SessoesWhatsapp] Falha ao restaurar status após erro de conexão',
        );
      }
    }

    const failure = publicConnectionFailure(error);
    logger.error(
      {
        stage: failure.stage,
        route: failure.route,
        upstreamStatus: failure.upstreamStatus,
        reasonCode: failure.reasonCode,
        instanceAlreadyExisted: failure.instanceAlreadyExisted,
        remoteIdPresent: evolutionInstanceIdPresent,
        instanceAuthPresent: evolutionTokenPresent,
      },
      '[SessoesWhatsapp] Erro ao conectar',
    );

    return responderErro(res, failure.httpStatus, 'Falha ao conectar WhatsApp', {
      reasonCode: failure.reasonCode,
      correlationId: req.correlationId,
      stage: failure.stage,
      ...(failure.upstreamStatus ? { upstreamStatus: failure.upstreamStatus } : {}),
      ...(failure.route ? { upstreamRoute: failure.route } : {}),
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
        } catch {
          console.error('Erro sanitizado ao buscar detalhes extras');
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
    logger.error('[SessoesWhatsapp] Erro ao verificar status');
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

    // Logout no Evolution GO
    try {
      await getWhatsAppService(sessao.instanceName).desconectarInstancia();
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

    logger.info('[SessoesWhatsapp] Sessão desconectada');

    return res.json({ sucesso: true, mensagem: 'Sessão desconectada' });

  } catch (error: any) {
    logger.error('[SessoesWhatsapp] Erro ao desconectar');
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

    return res.json({
      sucesso: true,
      config: {
        settings,
        webhook: { url: sessao.webhookUrl || null }
      }
    });

  } catch (error: any) {
    logger.error('[SessoesWhatsapp] Erro ao buscar configuração');
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
    const { ignorarGrupos } = req.body;

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

    return res.json({ sucesso: true, mensagem: 'Configuração atualizada' });

  } catch (error: any) {
    logger.error('[SessoesWhatsapp] Erro ao configurar sessão');
    return responderErro(res, 500, 'Erro ao atualizar configuração');
  }
});

export default router;
