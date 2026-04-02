/**
 * Rotas de Disparo - Prospecção Ativa e Funil
 * 
 * Responsabilidades:
 * - Disparar mensagens de prospecção
 * - Pausar/reativar campanhas
 * - Status e configurações de disparo
 * - Dados do funil de prospecção
 * - Dashboard (leads quentes, avaliações)
 */

import { responderErro } from '../../utilitarios/resposta';
import { Router } from 'express';
import { prisma } from '../../lib/db';
import { disparoCampanhaService } from '../../servicos/disparo-campanha';
import { z } from 'zod';

const router = Router();

// ============================================
// DISPARO E CONTROLE
// ============================================

/**
 * POST /:id/disparar
 * Inicia o disparo de prospecção ativa para uma campanha
 */
router.post('/:id/disparar', async (req, res) => {
  try {
    const { id } = req.params;
    const { modo = 'lote', ignorarValidacaoBriefing = false } = req.body;
    
    const campanha = await prisma.campanha.findUnique({ where: { id } });
    
    if (!campanha) {
      return responderErro(res, 404, 'Campanha não encontrada');
    }
    
    if (campanha.status !== 'ATIVA') {
      return responderErro(res, 400, `Campanha não está ativa (status: ${campanha.status})`, {
        status: campanha.status
      });
    }
    
    // Validar briefing antes de disparar
    if (!ignorarValidacaoBriefing) {
      if (!campanha.briefingCompleto) {
        return responderErro(res, 400, 'Campanha não possui briefing. Preencha o briefing do empreendimento antes de disparar.',
          {codigo: 'BRIEFING_AUSENTE'});
      }
      
      if (!campanha.briefingValidado) {
        return responderErro(res, 400, 'Briefing não foi validado. Revise e valide o briefing antes de disparar.',
          {codigo: 'BRIEFING_NAO_VALIDADO',
          dica: 'Acesse a aba "Empreendimento" e clique em "Validar Briefing"'});
      }
    }
    
    if (modo === 'continuo') {
      disparoCampanhaService.iniciarDisparosContinuos(id)
        .catch(err => console.error('[Campanhas] Erro no disparo contínuo:', err));
      
      return res.json({
        sucesso: true,
        mensagem: 'Disparo contínuo iniciado em background',
        campanhaId: id,
        modo: 'continuo'
      });
    } else {
      const resultado = await disparoCampanhaService.dispararLote(id);
      return res.json({ sucesso: resultado.iniciado, ...resultado });
    }
    
  } catch (error: any) {
    console.error('[Campanhas] Erro ao disparar:', error);
    return responderErro(res, 500, 'Erro interno do servidor');
  }
});

/**
 * POST /:id/pausar
 * Pausa os disparos de uma campanha
 */
router.post('/:id/pausar', async (req, res) => {
  try {
    const { id } = req.params;
    await disparoCampanhaService.pararDisparos(id);
    
    return res.json({
      sucesso: true,
      mensagem: 'Campanha pausada com sucesso',
      campanhaId: id
    });
    
  } catch (error: any) {
    console.error('[Campanhas] Erro ao pausar:', error);
    return responderErro(res, 500, 'Erro ao pausar campanha');
  }
});

/**
 * POST /:id/reativar
 * Reativa uma campanha pausada
 */
router.post('/:id/reativar', async (req, res) => {
  try {
    const { id } = req.params;
    
    const campanha = await prisma.campanha.update({
      where: { id },
      data: { status: 'ATIVA' }
    });
    
    return res.json({
      sucesso: true,
      mensagem: 'Campanha reativada com sucesso',
      campanhaId: id,
      status: campanha.status
    });
    
  } catch (error: any) {
    console.error('[Campanhas] Erro ao reativar:', error);
    return responderErro(res, 500, 'Erro ao reativar campanha');
  }
});

/**
 * GET /:id/status-disparo
 * Retorna o status atual do disparo da campanha
 */
router.get('/:id/status-disparo', async (req, res) => {
  try {
    const { id } = req.params;
    const status = await disparoCampanhaService.obterStatusCampanha(id);
    
    const taxaResposta = status.total > 0 
      ? ((status.respondeu + status.semInteresse + status.interessado) / status.contatando * 100).toFixed(1)
      : '0';
    
    const taxaConversao = status.total > 0
      ? (status.interessado / status.total * 100).toFixed(1)
      : '0';
    
    return res.json({
      campanhaId: id,
      status,
      metricas: {
        taxaResposta: `${taxaResposta}%`,
        taxaConversao: `${taxaConversao}%`,
        optoutRate: status.total > 0 
          ? `${(status.optout / status.total * 100).toFixed(1)}%` 
          : '0%'
      }
    });
    
  } catch (error: any) {
    console.error('[Campanhas] Erro ao buscar status:', error);
    return responderErro(res, 500, 'Erro ao buscar status do disparo');
  }
});

// ============================================
// CONFIGURAÇÕES DE DISPARO
// ============================================

/**
 * GET /:id/config-disparo
 * Retorna as configurações de disparo da campanha
 */
router.get('/:id/config-disparo', async (req, res) => {
  try {
    const { id } = req.params;
    
    const campanha = await prisma.campanha.findUnique({
      where: { id },
      select: { configDisparo: true }
    });
    
    if (!campanha) {
      return responderErro(res, 404, 'Campanha não encontrada');
    }
    
    const configPadrao = {
      mensagensPorMinuto: 20,
      atrasoEntreMensagens: 3000,
      maxTentativas: 3,
      horarioInicio: '08:00',
      horarioFim: '18:00',
      diasSemana: ['seg', 'ter', 'qua', 'qui', 'sex']
    };
    
    const config = campanha.configDisparo 
      ? { ...configPadrao, ...(campanha.configDisparo as object) }
      : configPadrao;
    
    return res.json({ config });
    
  } catch (error: any) {
    console.error('[Campanhas] Erro ao buscar config:', error);
    return responderErro(res, 500, 'Erro ao buscar configurações de disparo');
  }
});

/**
 * PUT /:id/config-disparo
 * Salva as configurações de disparo da campanha
 */
router.put('/:id/config-disparo', async (req, res) => {
  try {
    const { id } = req.params;
    
    const schema = z.object({
      mensagensPorMinuto: z.number().min(1).max(60),
      atrasoEntreMensagens: z.number().min(1000).max(60000),
      maxTentativas: z.number().min(1).max(10),
      horarioInicio: z.string().regex(/^\d{2}:\d{2}$/),
      horarioFim: z.string().regex(/^\d{2}:\d{2}$/),
      diasSemana: z.array(z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'])).optional()
    });
    
    const config = schema.parse(req.body);
    
    await prisma.campanha.update({
      where: { id },
      data: { configDisparo: config }
    });
    
    return res.json({
      sucesso: true,
      mensagem: 'Configurações salvas com sucesso',
      config
    });
    
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return responderErro(res, 400, 'Dados inválidos', {detalhes: error.errors});
    }
    console.error('[Campanhas] Erro ao salvar config:', error);
    return responderErro(res, 500, 'Erro ao salvar configurações de disparo');
  }
});

// ============================================
// FUNIL E DASHBOARD
// ============================================

/**
 * GET /funil-prospeccao
 * Retorna os dados do funil de prospecção agregados
 */
router.get('/funil-prospeccao', async (req, res) => {
  try {
    const estatisticas = await prisma.contato.groupBy({
      by: ['statusProspeccao'],
      _count: true,
      where: { campanha: { status: 'ATIVA' } }
    });

    const statusCount: Record<string, number> = {};
    estatisticas.forEach(e => {
      statusCount[e.statusProspeccao || 'AGUARDANDO'] = e._count;
    });

    const funil = {
      aguardando: statusCount['AGUARDANDO'] || 0,
      contatando: statusCount['CONTATANDO'] || 0,
      respondeu: statusCount['RESPONDEU'] || 0,
      interessado: statusCount['INTERESSADO'] || 0,
      mornoFuturo: statusCount['MORNO_FUTURO'] || 0,
      lead: statusCount['LEAD'] || 0,
      optout: statusCount['OPTOUT'] || 0,
      semInteresse: statusCount['SEM_INTERESSE'] || 0,
    };

    const totalDisparados = funil.contatando + funil.respondeu + funil.interessado + 
                           funil.mornoFuturo + funil.lead + funil.optout + funil.semInteresse;
    const totalRespostas = funil.respondeu + funil.interessado + funil.mornoFuturo + 
                          funil.lead + funil.semInteresse;
    const totalInteressados = funil.interessado + funil.mornoFuturo + funil.lead;

    return res.json({
      funil,
      metricas: {
        taxaResposta: totalDisparados > 0 
          ? ((totalRespostas / totalDisparados) * 100).toFixed(1) 
          : '0',
        taxaInteresse: totalRespostas > 0 
          ? ((totalInteressados / totalRespostas) * 100).toFixed(1) 
          : '0',
        taxaConversao: totalDisparados > 0 
          ? ((funil.lead / totalDisparados) * 100).toFixed(1) 
          : '0',
      }
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao buscar funil:', error);
    return responderErro(res, 500, 'Erro ao buscar dados do funil');
  }
});

/**
 * GET /leads-quentes
 * Busca leads QUENTE da prospecção ativa que aguardam ação
 */
router.get('/leads-quentes', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      return res.json({ leads: [], total: 0 });
    }

    const leadsQuentes = await prisma.lead.findMany({
      where: {
        tenantId: tenant.id,
        temperatura: 'QUENTE',
        campanhaOrigemId: { not: null },
        status: { in: ['NOVO', 'QUALIFICADO'] },
      },
      include: {
        campanhaOrigem: {
          select: { id: true, nome: true, nomeEmpreendimento: true }
        },
        atividades: {
          where: { tipo: 'REUNIAO', completadoEm: null },
          orderBy: { agendadoPara: 'asc' },
          take: 1,
        },
        contatoOrigem: {
          select: { id: true, nome: true, telefone: true, enderecoImovel: true, bairroImovel: true }
        }
      },
      orderBy: { criadoEm: 'desc' },
      take: 20,
    });

    const leads = leadsQuentes.map(lead => ({
      id: lead.id,
      nome: lead.nome,
      telefone: lead.telefone,
      temperatura: lead.temperatura,
      status: lead.status,
      origem: lead.origem,
      campanha: lead.campanhaOrigem ? {
        id: lead.campanhaOrigem.id,
        nome: lead.campanhaOrigem.nome,
        empreendimento: lead.campanhaOrigem.nomeEmpreendimento,
      } : null,
      imovel: lead.contatoOrigem ? {
        endereco: lead.contatoOrigem.enderecoImovel,
        bairro: lead.contatoOrigem.bairroImovel,
      } : null,
      reuniaoAgendada: lead.atividades[0] ? {
        id: lead.atividades[0].id,
        titulo: lead.atividades[0].titulo,
        agendadoPara: lead.atividades[0].agendadoPara,
      } : null,
      criadoEm: lead.criadoEm,
    }));

    return res.json({ leads, total: leadsQuentes.length });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao buscar leads quentes:', error);
    return responderErro(res, 500, 'Erro ao buscar leads quentes');
  }
});

/**
 * GET /avaliacoes-agendadas
 * Busca avaliações/visitas agendadas pelo SDR
 */
router.get('/avaliacoes-agendadas', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      return res.json({ avaliacoes: [], total: 0 });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const avaliacoes = await prisma.atividade.findMany({
      where: {
        tipo: 'REUNIAO',
        completadoEm: null,
        agendadoPara: { gte: hoje },
        lead: {
          tenantId: tenant.id,
          campanhaOrigemId: { not: null },
        }
      },
      include: {
        lead: {
          select: {
            id: true,
            nome: true,
            telefone: true,
            temperatura: true,
            campanhaOrigem: { select: { nome: true, nomeEmpreendimento: true } },
            contatoOrigem: { select: { enderecoImovel: true, bairroImovel: true } }
          }
        }
      },
      orderBy: { agendadoPara: 'asc' },
      take: 20,
    });

    const listaAvaliacoes = avaliacoes.map(av => ({
      id: av.id,
      titulo: av.titulo,
      descricao: av.descricao,
      agendadoPara: av.agendadoPara,
      lead: {
        id: av.lead.id,
        nome: av.lead.nome,
        telefone: av.lead.telefone,
        temperatura: av.lead.temperatura,
      },
      campanha: av.lead.campanhaOrigem ? {
        nome: av.lead.campanhaOrigem.nome,
        empreendimento: av.lead.campanhaOrigem.nomeEmpreendimento,
      } : null,
      imovel: av.lead.contatoOrigem ? {
        endereco: av.lead.contatoOrigem.enderecoImovel,
        bairro: av.lead.contatoOrigem.bairroImovel,
      } : null,
      criadoEm: av.criadoEm,
    }));

    return res.json({ avaliacoes: listaAvaliacoes, total: avaliacoes.length });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao buscar avaliações:', error);
    return responderErro(res, 500, 'Erro ao buscar avaliações agendadas');
  }
});

export default router;
