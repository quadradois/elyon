import { Router } from 'express';
import { prisma } from '../servidor';
import { pesquisadorEmpreendimento } from '../servicos/pesquisador-empreendimento';
import { z } from 'zod';

const router = Router();

/**
 * POST /api/campanhas/criar-com-pesquisa
 * Cria uma campanha e automaticamente pesquisa dados do empreendimento
 */
const criarCampanhaSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  nomeEmpreendimento: z.string().min(3, 'Nome do empreendimento obrigatório'),
  localizacao: z.string().min(3, 'Localização obrigatória'),
  cep: z.string().optional(),
  tipoImovel: z.string().optional().default('Apartamento'),
  perfilImovel: z.string().optional(),
  leadIds: z.array(z.string()).optional(), // IDs de leads para vincular à campanha
});

import { ragEmpreendimentos } from '../servicos/rag-empreendimentos';

router.post('/criar-com-pesquisa', async (req, res) => {
  try {
    console.log('[Campanhas] Criando campanha com pesquisa automática...');
    
    const dados = criarCampanhaSchema.parse(req.body);
    
    // 1. Buscar tenant
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      return res.status(400).json({ 
        erro: 'Nenhum tenant encontrado. Configure um tenant primeiro.' 
      });
    }

    // 2. Verificar se já existe conhecimento sobre este empreendimento (RAG)
    console.log(`[RAG] Verificando conhecimento para: ${dados.nomeEmpreendimento}`);
    let conhecimento = await ragEmpreendimentos.buscarPorNome(
      dados.nomeEmpreendimento,
      dados.localizacao
    );

    let briefing: any;
    let empreendimentoId: string | undefined;

    if (conhecimento) {
      console.log('✅ [RAG] Conhecimento encontrado! Reutilizando dados...');
      
      // Reutilizar dados existentes
      briefing = {
        resumo_sdr: conhecimento.briefingCompleto,
        ...conhecimento.briefingEstruturado as any,
        confiabilidade: Number(conhecimento.confiabilidade),
        fonte: 'RAG_CACHE' // Flag para frontend saber que veio do cache
      };
      
      empreendimentoId = conhecimento.id;
      
      // Atualizar estatísticas de uso
      await prisma.empreendimentoConhecimento.update({
        where: { id: conhecimento.id },
        data: {
          vezesReutilizado: { increment: 1 },
          ultimoUso: new Date(),
        }
      });
      
    } else {
      console.log('🔍 [RAG] Novo empreendimento. Iniciando pesquisa externa...');
      
      // 3. PESQUISA AUTOMÁTICA (Serper + GPT)
      briefing = await pesquisadorEmpreendimento.pesquisar({
        nome: dados.nomeEmpreendimento,
        localizacao: dados.localizacao,
        cep: dados.cep,
        tipo: dados.tipoImovel,
        perfil: dados.perfilImovel,
      });
      
      // 4. Salvar no RAG para futuro
      try {
        const novoConhecimento = await ragEmpreendimentos.salvar({
          nome: dados.nomeEmpreendimento,
          localizacao: dados.localizacao,
          cep: dados.cep,
          tipo: dados.tipoImovel || 'Apartamento',
          briefing,
          tenantId: tenant.id,
        });
        empreendimentoId = novoConhecimento.id;
        console.log('💾 [RAG] Novo conhecimento salvo com sucesso!');
      } catch (ragError) {
        console.error('⚠️ [RAG] Falha ao salvar conhecimento (não bloqueante):', ragError);
        // Não bloqueia a criação da campanha se o RAG falhar
      }
    }

    // 5. Criar campanha vinculada
    const campanha = await prisma.campanha.create({
      data: {
        tenantId: tenant.id,
        nome: dados.nome,
        tipo: 'MINERACAO',
        status: 'ATIVA',
        nomeEmpreendimento: dados.nomeEmpreendimento,
        localizacao: dados.localizacao,
        tipoImovel: dados.tipoImovel,
        perfilImovel: dados.perfilImovel,
        // Dados do briefing (mantidos na campanha por compatibilidade/histórico)
        briefingCompleto: briefing.resumo_sdr,
        briefingEstruturado: briefing,
        briefingGeradoEm: new Date(),
        briefingConfiabilidade: briefing.confiabilidade,
        // Vínculo com RAG
        empreendimentoId: empreendimentoId
      },
    });

    console.log(`[Campanhas] Campanha criada: ${campanha.id}`);

    // 6. Vincular leads à campanha (se fornecidos)
    let leadsVinculados = 0;
    if (dados.leadIds && dados.leadIds.length > 0) {
      console.log(`[Campanhas] Vinculando ${dados.leadIds.length} leads à campanha...`);
      
      try {
        // Buscar leads existentes
        const leadsExistentes = await prisma.lead.findMany({
          where: {
            id: { in: dados.leadIds },
            tenantId: tenant.id
          },
          select: { id: true, nome: true, cpf: true, telefone: true, email: true }
        });

        // Criar contatos da campanha para cada lead
        for (const lead of leadsExistentes) {
          await prisma.contato.create({
            data: {
              campanhaId: campanha.id,
              nome: lead.nome,
              cpf: lead.cpf,
              telefone: lead.telefone,
              email: lead.email,
              statusProspeccao: 'AGUARDANDO',
              leadId: lead.id, // Vínculo com lead original
            }
          });
          leadsVinculados++;
        }

        // Atualizar contagem na campanha
        await prisma.campanha.update({
          where: { id: campanha.id },
          data: { totalContatos: leadsVinculados }
        });

        console.log(`[Campanhas] ${leadsVinculados} leads vinculados com sucesso`);
      } catch (vincularError) {
        console.error('[Campanhas] Erro ao vincular leads:', vincularError);
        // Não bloqueia - campanha já foi criada
      }
    }

    // 7. Retornar resultado
    return res.json({
      sucesso: true,
      id: campanha.id, // Para compatibilidade
      campanha: {
        id: campanha.id,
        nome: campanha.nome,
        empreendimento: campanha.nomeEmpreendimento,
        status: campanha.status,
        leadsVinculados,
      },
      briefing: {
        resumo: briefing.resumo_sdr,
        faixa_preco: briefing.faixa_preco,
        caracteristicas: briefing.caracteristicas,
        diferenciais: briefing.diferenciais,
        pontos_interesse: briefing.pontos_interesse,
        alertas: briefing.alertas,
        confiabilidade: briefing.confiabilidade,
        fontes: briefing.fontes_consultadas,
        origem: briefing.fonte || 'PESQUISA_NOVA'
      },
      mensagem: conhecimento 
        ? '✅ Campanha criada usando conhecimento existente (RAG)!' 
        : '✅ Campanha criada e nova pesquisa realizada!'
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        erro: 'Dados inválidos',
        detalhes: error.errors,
      });
    }

    return res.status(500).json({
      erro: 'Erro ao criar campanha',
      mensagem: error.message,
    });
  }
});

/**
 * GET /api/campanhas/:id
 * Busca detalhes de uma campanha
 */
router.get('/:id', async (req, res) => {
  try {
    const campanha = await prisma.campanha.findUnique({
      where: { id: req.params.id },
      include: {
        contatos: {
          take: 10,
          orderBy: { criadoEm: 'desc' },
        },
        _count: {
          select: {
            contatos: true,
            leads: true,
          },
        },
      },
    });

    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
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
      totalContatos: campanha._count.contatos,
      totalLeads: campanha._count.leads,
      status: campanha.status,
      criadoEm: campanha.criadoEm,
      atualizadoEm: campanha.atualizadoEm,
    };

    return res.json({ campanha: campanhaFormatada });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao buscar campanha:', error);
    return res.status(500).json({ erro: 'Erro ao buscar campanha' });
  }
});

/**
 * GET /api/campanhas
 * Lista todas as campanhas
 */
router.get('/', async (req, res) => {
  try {
    const campanhas = await prisma.campanha.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: {
          select: {
            contatos: true,
            leads: true,
          },
        },
      },
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
    return res.status(500).json({ erro: 'Erro ao listar campanhas' });
  }
});

/**
 * PUT /api/campanhas/:id/briefing
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

    const campanha = await prisma.campanha.findUnique({
      where: { id },
    });

    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }

    // Atualizar campanha
    const campanhaAtualizada = await prisma.campanha.update({
      where: { id },
      data: {
        ...(dados.briefingCompleto && { briefingCompleto: dados.briefingCompleto }),
        ...(dados.briefingEstruturado && {
          briefingEstruturado: dados.briefingEstruturado as any,
        }),
        editadoPor: usuarioId,
        editadoEm: new Date(),
        ...(dados.validar && {
          briefingValidado: true,
          validadoPor: usuarioId,
          validadoEm: new Date(),
        }),
      },
    });

    // ATUALIZAR RAG SE HOUVER VÍNCULO
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

    return res.json({
      sucesso: true,
      campanha: campanhaAtualizada,
    });
  } catch (error) {
    console.error('Erro ao atualizar briefing:', error);
    return res.status(500).json({ erro: 'Erro ao atualizar briefing' });
  }
});

/**
 * PATCH /api/campanhas/:id/status
 * Atualizar status da campanha (pausar, ativar, finalizar)
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    const schema = z.object({
      status: z.enum(['ATIVA', 'PAUSADA', 'FINALIZADA']),
    });

    const { status } = schema.parse(req.body);

    const campanha = await prisma.campanha.findUnique({
      where: { id },
    });

    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
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
    return res.status(500).json({ erro: 'Erro ao atualizar status da campanha' });
  }
});

/**
 * POST /api/campanhas/:id/importar-contatos
 * Importar lista de contatos para a campanha
 */
router.post('/:id/importar-contatos', async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      contatos: z.array(z.object({
        nome: z.string().min(1, 'Nome é obrigatório'),
        telefone: z.string().min(8, 'Telefone inválido'),
        email: z.string().email().optional().or(z.literal('')),
        cargo: z.string().optional(),
        empresa: z.string().optional(),
        linkedin: z.string().optional(),
      })),
    });

    const { contatos } = schema.parse(req.body);

    const campanha = await prisma.campanha.findUnique({
      where: { id },
    });

    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }

    // Criar contatos em transação
    // Nota: Idealmente usaríamos createMany, mas para garantir relações futuras e validações, faremos map
    // Como é MVP e volume baixo (<1000), ok. Para volume alto, usar createMany.
    
    let importados = 0;
    let erros = 0;

    for (const contato of contatos) {
      try {
        await prisma.contato.create({
          data: {
            campanhaId: id,
            // tenantId removido pois Contato não tem esse campo direto (acessa via campanha)
            nome: contato.nome,
            telefone: contato.telefone,
            email: contato.email || null,
            // Campos removidos pois não existem no schema atual
            statusProspeccao: 'AGUARDANDO',
          }
        });
        importados++;
      } catch (e) {
        console.error(`Erro ao importar contato ${contato.nome}:`, e);
        erros++;
      }
    }

    // Atualizar contador da campanha
    await prisma.campanha.update({
      where: { id },
      data: {
        totalContatos: { increment: importados }
      }
    });

    return res.json({
      sucesso: true,
      mensagem: `${importados} contatos importados com sucesso. ${erros > 0 ? `${erros} falhas.` : ''}`,
      totalImportado: importados,
      totalFalhas: erros
    });

  } catch (error: any) {
    console.error('Erro ao importar contatos:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: error.errors });
    }
    return res.status(500).json({ erro: 'Erro ao importar contatos' });
  }
});

export default router;
