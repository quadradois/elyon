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
import { resumoEstruturalEmpreendimento } from '../../servicos/resumo-estrutural-empreendimento';
import { z } from 'zod';
import { ServicoAuditoria } from '../../servicos/servico-auditoria';

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

const prepararConhecimentoMapa = async (dados: {
  tenantId: string;
  nomeEmpreendimento?: string | null;
  tipoImovel?: string | null;
  localizacao: string;
  cep?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
}) => {
  const resumo = await resumoEstruturalEmpreendimento.buscarResumo({
    nomeEmpreendimento: dados.nomeEmpreendimento,
    logradouro: dados.logradouro,
    bairro: dados.bairro,
  });

  if (!resumo) return {};

  const nome = dados.nomeEmpreendimento || resumo.nomeEdificio;
  const tipo = dados.tipoImovel || 'RESIDENCIAL';

  const existente = await prisma.empreendimentoConhecimento.findUnique({
    where: {
      nome_localizacao: {
        nome,
        localizacao: dados.localizacao,
      },
    },
  });

  const briefingCompleto = resumoEstruturalEmpreendimento.anexarBlocoTexto(
    existente?.briefingCompleto,
    resumo
  ) || '';
  const briefingEstruturado = resumoEstruturalEmpreendimento.mesclarBriefingEstruturado(
    existente?.briefingEstruturado,
    resumo
  );

  const empreendimento = existente
    ? await prisma.empreendimentoConhecimento.update({
        where: { id: existente.id },
        data: {
          briefingCompleto,
          briefingEstruturado: briefingEstruturado as any,
          ultimaAtualizacao: new Date(),
          versao: { increment: 1 },
        },
      })
    : await prisma.empreendimentoConhecimento.create({
        data: {
          tenantId: dados.tenantId,
          nome,
          localizacao: dados.localizacao,
          cep: dados.cep,
          tipo,
          briefingCompleto,
          briefingEstruturado: briefingEstruturado as any,
          confiabilidade: 0.55,
          versao: 1,
        },
      });

  return {
    empreendimentoId: empreendimento.id,
    briefingCompleto,
    briefingEstruturado,
    briefingGeradoEm: new Date(),
    briefingConfiabilidade: '0.55',
  };
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
  responsavelCorretorId: z.string().uuid().nullable().optional(),
  fallbackCorretorId: z.string().uuid().nullable().optional(),
});

async function validarCorretorDoTenant(params: {
  tenantId: string;
  corretorId?: string | null;
  campo: 'responsavelCorretorId' | 'fallbackCorretorId';
}): Promise<string | null> {
  const corretorId = params.corretorId || null;
  if (!corretorId) return null;

  const corretor = await prisma.usuario.findFirst({
    where: {
      id: corretorId,
      tenantId: params.tenantId,
    },
    select: { id: true }
  });

  if (!corretor) {
    throw new Error(`${params.campo} inválido: usuário não pertence ao tenant`);
  }

  return corretor.id;
}

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

    const conhecimentoMapa = await prepararConhecimentoMapa({
      tenantId: tenant.id,
      nomeEmpreendimento: dados.nomeEmpreendimento,
      tipoImovel: dados.tipoImovel,
      localizacao: localizacaoCompleta,
      cep: dados.cep,
      logradouro: dados.logradouro,
      bairro: dados.bairro,
    });

    const responsavelCorretorId = await validarCorretorDoTenant({
      tenantId: tenant.id,
      corretorId: dados.responsavelCorretorId,
      campo: 'responsavelCorretorId',
    });
    const fallbackCorretorId = await validarCorretorDoTenant({
      tenantId: tenant.id,
      corretorId: dados.fallbackCorretorId,
      campo: 'fallbackCorretorId',
    });

    const campanha: any = await (prisma.campanha as any).create({
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
        responsavelCorretorId,
        fallbackCorretorId,
        ...conhecimentoMapa,
      },
    });

    console.log(`[Campanhas] ✅ Campanha criada (modo manual): ${campanha.id}`);

    ServicoAuditoria.registrar({
      tenantId: tenant.id,
      usuarioId: req.headers['x-usuario-id'] as string || undefined,
      acao: 'CRIAR_CAMPANHA',
      entidade: 'Campanha',
      entidadeId: campanha.id,
      detalhes: { nome: campanha.nome },
      ip: req.socket.remoteAddress || req.headers['x-forwarded-for'] as string
    });

    return res.status(201).json({
      sucesso: true,
      campanha: {
        id: campanha.id,
        nome: campanha.nome,
        nomeEmpreendimento: campanha.nomeEmpreendimento,
        empreendimentoId: campanha.empreendimentoId,
        status: campanha.status,
        responsavelCorretorId: campanha.responsavelCorretorId,
        fallbackCorretorId: campanha.fallbackCorretorId,
      },
      mensagem: campanha.empreendimentoId
        ? 'Campanha criada com dados estruturais da prefeitura/MAPA injetados no briefing.'
        : 'Campanha criada! Preencha o briefing do empreendimento.',
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

    const conhecimentoMapa = await prepararConhecimentoMapa({
      tenantId: tenant.id,
      nomeEmpreendimento: dados.nomeEmpreendimento,
      tipoImovel: dados.tipoImovel,
      localizacao: localizacaoCompleta,
      cep: dados.cep,
      logradouro: dados.logradouro,
      bairro: dados.bairro,
    });

    const responsavelCorretorId = await validarCorretorDoTenant({
      tenantId: tenant.id,
      corretorId: dados.responsavelCorretorId,
      campo: 'responsavelCorretorId',
    });
    const fallbackCorretorId = await validarCorretorDoTenant({
      tenantId: tenant.id,
      corretorId: dados.fallbackCorretorId,
      campo: 'fallbackCorretorId',
    });

    const campanha: any = await (prisma.campanha as any).create({
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
        responsavelCorretorId,
        fallbackCorretorId,
        ...conhecimentoMapa,
      },
    });

    return res.status(201).json({
      sucesso: true,
      campanha: { id: campanha.id, nome: campanha.nome, empreendimentoId: campanha.empreendimentoId },
      mensagem: campanha.empreendimentoId
        ? 'Campanha criada com dados estruturais da prefeitura/MAPA injetados no briefing.'
        : 'Campanha criada. Pesquisa IA desativada - preencha o briefing manualmente.',
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
    
    const campanha: any = await (prisma.campanha as any).findUnique({
      where: { id: req.params.id },
      include: {
        leads: { take: 10, orderBy: { criadoEm: 'desc' } },
        _count: { select: { leads: true } },
        responsavelCorretor: { select: { id: true, nome: true, email: true, telefone: true, estaAtivo: true } },
        fallbackCorretor: { select: { id: true, nome: true, email: true, telefone: true, estaAtivo: true } },
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
      totalContatos: campanha._count.leads,
      totalLeads: campanha._count.leads,
      status: campanha.status,
      responsavelCorretorId: campanha.responsavelCorretorId,
      fallbackCorretorId: campanha.fallbackCorretorId,
      responsavelCorretor: campanha.responsavelCorretor,
      fallbackCorretor: campanha.fallbackCorretor,
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
    
    const campanhas: any[] = await (prisma.campanha as any).findMany({
      where: { tenantId }, // ✅ FILTRO DE SEGURANÇA
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: { select: { leads: true } },
        responsavelCorretor: { select: { id: true, nome: true, estaAtivo: true } },
        fallbackCorretor: { select: { id: true, nome: true, estaAtivo: true } },
      },
    });

    return res.json({
      total: campanhas.length,
      campanhas: campanhas.map(c => ({
        id: c.id,
        nome: c.nome,
        empreendimento: c.nomeEmpreendimento,
        status: c.status,
        responsavelCorretorId: c.responsavelCorretorId,
        fallbackCorretorId: c.fallbackCorretorId,
        responsavelCorretor: c.responsavelCorretor,
        fallbackCorretor: c.fallbackCorretor,
        totalContatos: c._count.leads,
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

    const resumoMapa = await resumoEstruturalEmpreendimento.buscarResumo({
      nomeEmpreendimento: campanha.nomeEmpreendimento,
      logradouro: campanha.logradouro,
      bairro: campanha.bairro,
    });
    const briefingCompletoFinal = resumoEstruturalEmpreendimento.anexarBlocoTexto(
      dados.briefingCompleto ?? campanha.briefingCompleto,
      resumoMapa
    );
    const briefingEstruturadoFinal = resumoEstruturalEmpreendimento.mesclarBriefingEstruturado(
      dados.briefingEstruturado ?? campanha.briefingEstruturado,
      resumoMapa
    );
    const deveAtualizarBriefingEstruturado = dados.briefingEstruturado !== undefined || !!resumoMapa;
    const novaConfiabilidade = briefingEstruturadoFinal?.confiabilidade;

    const campanhaAtualizada = await prisma.campanha.update({
      where: { id },
      data: {
        ...(briefingCompletoFinal && { briefingCompleto: briefingCompletoFinal }),
        ...(deveAtualizarBriefingEstruturado && { briefingEstruturado: briefingEstruturadoFinal as any }),
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
          briefingCompleto: briefingCompletoFinal,
          briefingEstruturado: deveAtualizarBriefingEstruturado ? briefingEstruturadoFinal : undefined,
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
      include: { _count: { select: { leads: true } } }
    });

    if (!campanha) {
      return responderErro(res, 404, 'Campanha não encontrada');
    }

    // ✅ Verificar ownership
    const tenantId = getTenantIdFromHeader(req);
    if (!tenantId || campanha.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    console.log(`[Campanhas] Excluindo campanha "${campanha.nome}" com ${campanha._count.leads} leads...`);

    await prisma.campanha.delete({ where: { id } });

    console.log(`[Campanhas] ✅ Campanha "${campanha.nome}" excluída com sucesso`);

    return res.json({ 
      sucesso: true, 
      mensagem: `Campanha "${campanha.nome}" excluída com sucesso`,
      contatosExcluidos: campanha._count.leads
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
