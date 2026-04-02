/**
 * Rotas de Campanhas - CRUD e Operações Básicas
 * 
 * Responsabilidades:
 * - Criar, listar, buscar, deletar campanhas
 * - Atualizar status e briefing
 * - Cache de empreendimentos
 */

import { responderErro } from '../../utilitarios/resposta';
import { Router, Request } from 'express';
import { prisma } from '../../lib/db';
import { consultaCEP } from '../../servicos/cep';
import { ragEmpreendimentos } from '../../servicos/rag-empreendimentos';
import { z } from 'zod';

const router = Router();

// ============================================
// HELPER PARA TENANT
// ============================================

/**
 * Obtém o tenantId do header X-Tenant-Id
 * Retorna null se não encontrar (forçando o chamador a tratar)
 */
const getTenantIdFromHeader = (req: Request): string | null => {
  const tenantId = req.headers['x-tenant-id'];
  if (tenantId && typeof tenantId === 'string') {
    return tenantId;
  }
  return null;
};

// ============================================
// SCHEMAS DE VALIDAÇÃO
// ============================================

const criarCampanhaSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  nomeEmpreendimento: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  logradouro: z.string().nullable().optional(),
  numero: z.string().nullable().optional(),
  complemento: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  estado: z.string().nullable().optional().default('GO'),
  localizacao: z.string().nullable().optional(),
  tipoImovel: z.string().nullable().optional().default('Apartamento'),
  perfilImovel: z.string().nullable().optional(),
});

// ============================================
// ENDPOINTS DE CEP
// ============================================

/**
 * GET /cep/:cep
 * Consulta dados de endereço pelo CEP (ViaCEP)
 */
router.get('/cep/:cep', async (req, res) => {
  try {
    const { cep } = req.params;
    const dados = await consultaCEP.consultar(cep);
    
    if (!dados) {
      return responderErro(res, 404, 'CEP não encontrado', { cep });
    }
    
    return res.json({ sucesso: true, dados });
  } catch (error: any) {
    console.error('[Campanhas] Erro ao consultar CEP:', error);
    return responderErro(res, 500, 'Erro ao consultar CEP');
  }
});

// ============================================
// CRUD DE CAMPANHAS
// ============================================

/**
 * POST /
 * Cria uma campanha para preenchimento manual do briefing
 */
router.post('/', async (req, res) => {
  try {
    console.log('[Campanhas] Criando campanha (modo manual)...');
    
    const dados = criarCampanhaSchema.parse(req.body);
    const localizacaoCompleta = dados.localizacao || 
      `${dados.bairro}, ${dados.cidade} - ${dados.estado}`;
    
    // Usar X-Tenant-Id do header
    const tenantId = getTenantIdFromHeader(req);
    if (!tenantId) {
      return responderErro(res, 400, 'Tenant não identificado. Envie o header X-Tenant-Id.');
    }
    
    // Verificar se tenant existe
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return responderErro(res, 400, 'Tenant não encontrado. Verifique o X-Tenant-Id.');
    }

    const campanha = await prisma.campanha.create({
      data: {
        tenantId: tenant.id,
        nome: dados.nome,
        tipo: 'MINERACAO',
        status: 'ATIVA',
        nomeEmpreendimento: dados.nomeEmpreendimento,
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento,
        bairro: dados.bairro,
        cidade: dados.cidade,
        estado: dados.estado,
        localizacao: localizacaoCompleta,
        tipoImovel: dados.tipoImovel,
        perfilImovel: dados.perfilImovel,
      },
    });

    console.log(`[Campanhas] ✅ Campanha criada (modo manual): ${campanha.id}`);

    return res.status(201).json({
      sucesso: true,
      campanha: {
        id: campanha.id,
        nome: campanha.nome,
        nomeEmpreendimento: campanha.nomeEmpreendimento,
        status: campanha.status,
      },
      mensagem: 'Campanha criada! Preencha o briefing do empreendimento.',
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao criar campanha:', error);
    
    if (error.name === 'ZodError') {
      return responderErro(res, 400, 'Dados inválidos', {detalhes: error.errors});
    }
    
    return responderErro(res, 500, 'Erro interno ao criar campanha');
  }
});

/**
 * POST /criar-com-pesquisa
 * @deprecated - Mantido para compatibilidade
 */
router.post('/criar-com-pesquisa', async (req, res) => {
  console.log('[Campanhas] ⚠️ Rota legada /criar-com-pesquisa chamada - redirecionando...');
  
  try {
    const dados = criarCampanhaSchema.parse(req.body);
    const localizacaoCompleta = dados.localizacao || 
      `${dados.bairro}, ${dados.cidade} - ${dados.estado}`;
    
    // Usar X-Tenant-Id do header
    const tenantId = getTenantIdFromHeader(req);
    if (!tenantId) {
      return responderErro(res, 400, 'Tenant não identificado. Envie X-Tenant-Id.');
    }
    
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return responderErro(res, 400, 'Tenant não encontrado.');
    }

    const campanha = await prisma.campanha.create({
      data: {
        tenantId: tenant.id,
        nome: dados.nome,
        tipo: 'MINERACAO',
        status: 'ATIVA',
        nomeEmpreendimento: dados.nomeEmpreendimento,
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento,
        bairro: dados.bairro,
        cidade: dados.cidade,
        estado: dados.estado,
        localizacao: localizacaoCompleta,
        tipoImovel: dados.tipoImovel,
        perfilImovel: dados.perfilImovel,
      },
    });

    return res.status(201).json({
      sucesso: true,
      campanha: { id: campanha.id, nome: campanha.nome },
      mensagem: 'Campanha criada. Pesquisa IA desativada - preencha o briefing manualmente.',
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro:', error);
    return responderErro(res, 500, 'Erro ao criar campanha');
  }
});

/**
 * GET /:id
 * Busca detalhes de uma campanha
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = getTenantIdFromHeader(req);
    
    if (!tenantId) {
      return responderErro(res, 401, 'Tenant não identificado.');
    }
    
    const campanha = await prisma.campanha.findUnique({
      where: { id: req.params.id },
      include: {
        contatos: { take: 10, orderBy: { criadoEm: 'desc' } },
        _count: { select: { contatos: true, leads: true } },
      },
    });

    if (!campanha) {
      return responderErro(res, 404, 'Campanha não encontrada');
    }
    
    // ✅ Verificar ownership
    if (campanha.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    const campanhaFormatada = {
      id: campanha.id,
      nome: campanha.nome,
      tenantId: campanha.tenantId,
      tipo: campanha.tipo,
      parametrosBusca: campanha.parametrosBusca,
      nomeEmpreendimento: campanha.nomeEmpreendimento,
      tipoImovel: campanha.tipoImovel,
      localizacao: campanha.localizacao,
      perfilImovel: campanha.perfilImovel,
      // Endereço detalhado
      cep: campanha.cep,
      logradouro: campanha.logradouro,
      numero: campanha.numero,
      complemento: campanha.complemento,
      bairro: campanha.bairro,
      cidade: campanha.cidade,
      estado: campanha.estado,
      // Briefing
      briefingCompleto: campanha.briefingCompleto,
      briefingEstruturado: campanha.briefingEstruturado,
      briefingGeradoEm: campanha.briefingGeradoEm,
      briefingConfiabilidade: campanha.briefingConfiabilidade
        ? parseFloat(campanha.briefingConfiabilidade.toString())
        : null,
      briefingValidado: campanha.briefingValidado,
      validadoPor: campanha.validadoPor,
      validadoEm: campanha.validadoEm,
      editadoPor: campanha.editadoPor,
      editadoEm: campanha.editadoEm,
      // Métricas
      totalContatos: campanha._count.contatos,
      totalLeads: campanha._count.leads,
      status: campanha.status,
      criadoEm: campanha.criadoEm,
      atualizadoEm: campanha.atualizadoEm,
    };

    return res.json({ campanha: campanhaFormatada });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao buscar campanha:', error);
    return responderErro(res, 500, 'Erro ao buscar campanha');
  }
});

/**
 * GET /
 * Lista todas as campanhas DO TENANT
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = getTenantIdFromHeader(req);
    
    if (!tenantId) {
      return responderErro(res, 401, 'Tenant não identificado. Envie o header X-Tenant-Id.');
    }
    
    const campanhas = await prisma.campanha.findMany({
      where: { tenantId }, // ✅ FILTRO DE SEGURANÇA
      orderBy: { criadoEm: 'desc' },
      include: { _count: { select: { contatos: true, leads: true } } },
    });

    return res.json({
      total: campanhas.length,
      campanhas: campanhas.map(c => ({
        id: c.id,
        nome: c.nome,
        empreendimento: c.nomeEmpreendimento,
        status: c.status,
        totalContatos: c._count.contatos,
        totalLeads: c._count.leads,
        temBriefing: !!c.briefingCompleto,
        confiabilidade: c.briefingConfiabilidade 
          ? parseFloat(c.briefingConfiabilidade.toString())
          : null,
        criadoEm: c.criadoEm,
      })),
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao listar campanhas:', error);
    return responderErro(res, 500, 'Erro ao listar campanhas');
  }
});

/**
 * PUT /:id/briefing
 * Atualizar e validar briefing da campanha
 */
router.put('/:id/briefing', async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = (req as any).usuario?.id || 'sistema';

    const schema = z.object({
      briefingCompleto: z.string().optional(),
      briefingEstruturado: z.any().optional(),
      validar: z.boolean().optional(),
    });

    const dados = schema.parse(req.body);

    const campanha = await prisma.campanha.findUnique({ where: { id } });
    if (!campanha) {
      return responderErro(res, 404, 'Campanha não encontrada');
    }
    
    // ✅ Verificar ownership
    const tenantId = getTenantIdFromHeader(req);
    if (!tenantId || campanha.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    const novaConfiabilidade = dados.briefingEstruturado?.confiabilidade;

    const campanhaAtualizada = await prisma.campanha.update({
      where: { id },
      data: {
        ...(dados.briefingCompleto && { briefingCompleto: dados.briefingCompleto }),
        ...(dados.briefingEstruturado && { briefingEstruturado: dados.briefingEstruturado as any }),
        ...(novaConfiabilidade !== undefined && { briefingConfiabilidade: String(novaConfiabilidade) }),
        editadoPor: usuarioId,
        editadoEm: new Date(),
        ...(dados.validar && {
          briefingValidado: true,
          validadoPor: usuarioId,
          validadoEm: new Date(),
        }),
      },
    });

    // Atualizar RAG se houver vínculo
    if (campanha.empreendimentoId) {
      console.log(`[RAG] Atualizando conhecimento vinculado: ${campanha.empreendimentoId}`);
      try {
        await ragEmpreendimentos.atualizar(campanha.empreendimentoId, {
          briefingCompleto: dados.briefingCompleto,
          briefingEstruturado: dados.briefingEstruturado,
          validado: dados.validar,
          validadoPor: dados.validar ? usuarioId : undefined
        });
        console.log('✅ [RAG] Conhecimento atualizado com sucesso!');
      } catch (ragError) {
        console.error('⚠️ [RAG] Falha ao atualizar conhecimento:', ragError);
      }
    }

    return res.json({ sucesso: true, campanha: campanhaAtualizada });
  } catch (error) {
    console.error('Erro ao atualizar briefing:', error);
    return responderErro(res, 500, 'Erro ao atualizar briefing');
  }
});

/**
 * PATCH /:id/status
 * Atualizar status da campanha
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({ status: z.enum(['ATIVA', 'PAUSADA', 'FINALIZADA']) });
    const { status } = schema.parse(req.body);

    const campanha = await prisma.campanha.findUnique({ where: { id } });
    if (!campanha) {
      return responderErro(res, 404, 'Campanha não encontrada');
    }
    
    // ✅ Verificar ownership
    const tenantId = getTenantIdFromHeader(req);
    if (!tenantId || campanha.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    const campanhaAtualizada = await prisma.campanha.update({
      where: { id },
      data: { status },
    });

    return res.json({
      sucesso: true,
      campanha: {
        id: campanhaAtualizada.id,
        nome: campanhaAtualizada.nome,
        status: campanhaAtualizada.status,
      },
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    return responderErro(res, 500, 'Erro ao atualizar status da campanha');
  }
});

/**
 * DELETE /:id
 * Exclui uma campanha e todos os seus contatos
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const campanha = await prisma.campanha.findUnique({
      where: { id },
      include: { _count: { select: { contatos: true } } }
    });

    if (!campanha) {
      return responderErro(res, 404, 'Campanha não encontrada');
    }
    
    // ✅ Verificar ownership
    const tenantId = getTenantIdFromHeader(req);
    if (!tenantId || campanha.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    console.log(`[Campanhas] Excluindo campanha "${campanha.nome}" com ${campanha._count.contatos} contatos...`);

    await prisma.campanha.delete({ where: { id } });

    console.log(`[Campanhas] ✅ Campanha "${campanha.nome}" excluída com sucesso`);

    return res.json({ 
      sucesso: true, 
      mensagem: `Campanha "${campanha.nome}" excluída com sucesso`,
      contatosExcluidos: campanha._count.contatos
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao excluir campanha:', error);
    return responderErro(res, 500, 'Erro ao excluir campanha');
  }
});

// ============================================
// CACHE DE EMPREENDIMENTOS
// ============================================

/**
 * GET /cache-empreendimentos
 * Lista todos os conhecimentos em cache
 */
router.get('/cache-empreendimentos', async (req, res) => {
  try {
    const conhecimentos = await ragEmpreendimentos.listarTodos();
    return res.json({ sucesso: true, total: conhecimentos.length, conhecimentos });
  } catch (error: any) {
    console.error('[Campanhas] Erro ao listar cache:', error);
    return responderErro(res, 500, 'Erro ao listar cache de empreendimentos');
  }
});

/**
 * DELETE /cache-empreendimentos/:id
 * Deleta um conhecimento específico do cache
 */
router.delete('/cache-empreendimentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await ragEmpreendimentos.deletar(id);
    return res.json({ sucesso: true, mensagem: 'Conhecimento removido do cache' });
  } catch (error: any) {
    console.error('[Campanhas] Erro ao deletar cache:', error);
    return responderErro(res, 500, 'Erro ao deletar conhecimento do cache');
  }
});

/**
 * POST /limpar-cache-empreendimento
 * Limpa o cache de um empreendimento pelo nome e localização
 */
router.post('/limpar-cache-empreendimento', async (req, res) => {
  try {
    const { nome, localizacao } = req.body;
    
    if (!nome || !localizacao) {
      return responderErro(res, 400, 'Nome e localização são obrigatórios');
    }
    
    const deletado = await ragEmpreendimentos.deletarPorNome(nome, localizacao);
    
    if (deletado) {
      return res.json({
        sucesso: true,
        mensagem: `Cache do empreendimento "${nome}" limpo com sucesso`
      });
    } else {
      return res.json({
        sucesso: false,
        mensagem: `Nenhum cache encontrado para "${nome}" em "${localizacao}"`
      });
    }
  } catch (error: any) {
    console.error('[Campanhas] Erro ao limpar cache:', error);
    return responderErro(res, 500, 'Erro ao limpar cache do empreendimento');
  }
});

export default router;
