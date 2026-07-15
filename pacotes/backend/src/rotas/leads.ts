import { responderErro } from '../utilitarios/resposta';
import { Router, Request } from 'express';
import { prisma } from '../lib/db';
import { TipoIntegracao } from '@prisma/client';
import crypto from 'crypto';
import { getTenantId } from '../utils/tenant';
import { cascadeDeleteLeads } from '../utils/cascade-delete';
import { aplicarRetencaoSeguraLead } from '../utils/retencao-segura';
import { enviarParaCrm, reenviarParaCrm, verificarStatusCrm } from '../servicos/crm-service';
import { ServicoAuditoria } from '../servicos/servico-auditoria';
import {
  camposCriticosFaltantes,
  extrairFieldSources,
  obterLastSourceUpdateAt,
} from '../agentes/governanca-qualificacao';
import { priorizarLeads, calcularQualificacao, calcularUrgencia } from '../servicos/servico-priorizacao-leads';
import { withTenantDb } from '../lib/tenant-db';
import { criarFollowupOutbound, reagendarFollowupOutbound } from '../servicos/followup-outbound';
import { formatInTimeZone } from 'date-fns-tz';
import { AGENDA_COMMERCIAL_POLICY_VERSION, executarComandoAgenda } from '../servicos/coerencia-agenda-estado';

const router = Router();


const normalizarTelefone = (telefone?: string): string | null => {
  if (!telefone) return null;
  const limpo = telefone.replace(/\D/g, '');
  return limpo.length >= 8 ? limpo : null;
};

const normalizarEmail = (email?: string): string | null => {
  if (!email) return null;
  const limpo = email.trim().toLowerCase();
  return limpo.length > 0 ? limpo : null;
};

const normalizarCpf = (cpf?: string): string | null => {
  if (!cpf) return null;
  const limpo = cpf.replace(/\D/g, '');
  return limpo.length === 11 ? limpo : null;
};

// GET /api/leads - Retorna leads do tenant
router.get('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { busca, page, limit, status, temperatura } = req.query;
    
    const isPaginated = page !== undefined || limit !== undefined;
    const pagina = page ? Math.max(1, parseInt(String(page), 10)) : 1;
    const limite = limit ? Math.min(1000, Math.max(1, parseInt(String(limit), 10))) : 50;
    const skip = (pagina - 1) * limite;

    // Base: leads ativos DO TENANT (excluir arquivados e perdidos)
    // Se um status específico for passado, buscamos por ele
    const baseWhere: any = {
      tenantId,
    };
    
    if (status) {
      baseWhere.status = String(status);
    } else {
      baseWhere.status = { notIn: ['ARQUIVADO', 'PERDIDO', 'CAPTADO'] };
    }

    if (temperatura) {
      baseWhere.temperatura = String(temperatura);
    }

    // Se tiver busca, adicionar filtros de busca (Nome, Email, Telefone, CPF)
    const where = busca ? {
      AND: [
        baseWhere,
        {
          OR: [
            { nome: { contains: String(busca), mode: 'insensitive' as const } },
            { email: { contains: String(busca), mode: 'insensitive' as const } },
            { telefone: { contains: String(busca) } },
            { cpf: { contains: String(busca) } }
          ]
        }
      ]
    } : baseWhere;

    const includeQuery = {
      campanhaOrigem: true,
      conversas: { orderBy: { iniciadaEm: 'desc' as const }, take: 1 },
      atividades: { orderBy: { criadoEm: 'desc' as const }, take: 1 }
    };

    let totalLeads = 0;
    let leads = [];

    if (isPaginated) {
      const [count, list] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.findMany({
          where,
          skip,
          take: limite,
          orderBy: { criadoEm: 'desc' },
          include: includeQuery
        })
      ]);
      totalLeads = count;
      leads = list;
    } else {
      leads = await prisma.lead.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        include: includeQuery
      });
      totalLeads = leads.length;
    }

    // Formatar para o frontend
    const leadsFormatados = leads.map((lead: any) => {
      // Determinar última interação (atividade ou conversa)
      let ultimaInteracao = 'N/A';
      const ultimaAtividade = lead.atividades[0]?.criadoEm;
      const ultimaConversa = lead.conversas[0]?.iniciadaEm;

      if (ultimaAtividade || ultimaConversa) {
        const data = (ultimaAtividade && ultimaConversa)
          ? (ultimaAtividade > ultimaConversa ? ultimaAtividade : ultimaConversa)
          : (ultimaAtividade || ultimaConversa);

        ultimaInteracao = new Date(data!).toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
      }

      return {
        id: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        status: lead.status,
        temperatura: lead.temperatura,
        campanhaOrigem: lead.campanhaOrigem?.nome || null,
        ultimaInteracao
      };
    });

    if (isPaginated) {
      return res.json({
        metadata: {
          total: totalLeads,
          pagina,
          limite,
          totalPaginas: Math.ceil(totalLeads / limite)
        },
        data: leadsFormatados
      });
    }

    // Retorno legado em array
    res.json(leadsFormatados);
  } catch (error) {
    console.error('Erro ao listar leads:', error);
    responderErro(res, 500, 'Erro interno ao listar leads');
  }
});

// ============================================
// GET /api/leads/priorizados - Mission Control (feed priorizado por urgência)
// IMPORTANTE: Deve vir ANTES de /:id
// ============================================
router.get('/priorizados', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const limite = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const resultado = await priorizarLeads(tenantId, limite);

    return res.json(resultado);
  } catch (error) {
    console.error('Erro ao priorizar leads:', error);
    responderErro(res, 500, 'Erro interno ao priorizar leads');
  }
});

// ============================================
// GET /api/leads/cockpit-metricas - Painel executivo consolidado do cockpit
// ============================================
router.get('/cockpit-metricas', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const periodoParam = Number(req.query.periodoDias || 30);
    const periodoDias = Number.isFinite(periodoParam) ? Math.min(365, Math.max(1, periodoParam)) : 30;
    const dataInicio = new Date(Date.now() - (periodoDias * 24 * 60 * 60 * 1000));

    const logs = await prisma.logAuditoria.findMany({
      where: {
        tenantId,
        acao: { startsWith: 'COCKPIT_' },
        criadoEm: { gte: dataInicio }
      },
      orderBy: { criadoEm: 'desc' },
      take: 5000,
      include: {
        usuario: {
          select: { id: true, nome: true, email: true }
        }
      }
    });

    const eventos = logs.map((log) => ({
      acao: log.acao,
      detalhes: (log.detalhes || {}) as any,
      criadoEm: log.criadoEm,
      usuario: log.usuario || null,
    }));

    const resultados = eventos.filter((e) => e.acao === 'COCKPIT_DECISAO_RESULTADO' || e.acao === 'COCKPIT_CRM_RESULTADO');
    const sucessos = resultados.filter((e) => e.detalhes?.sucesso === true);

    const funil = {
      cliquesDecisao: eventos.filter((e) => e.acao === 'COCKPIT_DECISAO_CLICK').length,
      acoesCrm: eventos.filter((e) => e.acao === 'COCKPIT_CRM_ACAO').length,
      resultadosDecisao: eventos.filter((e) => e.acao === 'COCKPIT_DECISAO_RESULTADO').length,
      resultadosCrm: eventos.filter((e) => e.acao === 'COCKPIT_CRM_RESULTADO').length,
      sucessosDecisao: eventos.filter((e) => e.acao === 'COCKPIT_DECISAO_RESULTADO' && e.detalhes?.sucesso === true).length,
      sucessosCrm: eventos.filter((e) => e.acao === 'COCKPIT_CRM_RESULTADO' && e.detalhes?.sucesso === true).length,
    };

    const porUsuario = new Map<string, {
      usuarioId: string;
      nome: string;
      email: string;
      totalAcoes: number;
      totalResultados: number;
      totalSucessos: number;
    }>();

    const porAcao = new Map<string, {
      acao: string;
      totalAcoes: number;
      totalResultados: number;
      totalSucessos: number;
    }>();

    for (const evento of eventos) {
      const usuarioId = evento.usuario?.id || 'sistema';
      const nome = evento.usuario?.nome || 'Sistema';
      const email = evento.usuario?.email || 'sistema@elyon.local';
      const tipoAcao = String(evento.detalhes?.acao || evento.detalhes?.tipo || 'geral');

      const registroUsuario = porUsuario.get(usuarioId) || {
        usuarioId,
        nome,
        email,
        totalAcoes: 0,
        totalResultados: 0,
        totalSucessos: 0,
      };

      const registroAcao = porAcao.get(tipoAcao) || {
        acao: tipoAcao,
        totalAcoes: 0,
        totalResultados: 0,
        totalSucessos: 0,
      };

      if (evento.acao === 'COCKPIT_DECISAO_CLICK' || evento.acao === 'COCKPIT_CRM_ACAO') {
        registroUsuario.totalAcoes += 1;
        registroAcao.totalAcoes += 1;
      }

      if (evento.acao === 'COCKPIT_DECISAO_RESULTADO' || evento.acao === 'COCKPIT_CRM_RESULTADO') {
        registroUsuario.totalResultados += 1;
        registroAcao.totalResultados += 1;
        if (evento.detalhes?.sucesso === true) {
          registroUsuario.totalSucessos += 1;
          registroAcao.totalSucessos += 1;
        }
      }

      porUsuario.set(usuarioId, registroUsuario);
      porAcao.set(tipoAcao, registroAcao);
    }

    const rankingUsuarios = Array.from(porUsuario.values())
      .map((item) => ({
        ...item,
        taxaSucesso: item.totalResultados > 0
          ? Math.round((item.totalSucessos / item.totalResultados) * 100)
          : 0
      }))
      .sort((a, b) => b.totalSucessos - a.totalSucessos || b.totalResultados - a.totalResultados)
      .slice(0, 8);

    const rankingAcoes = Array.from(porAcao.values())
      .map((item) => ({
        ...item,
        taxaSucesso: item.totalResultados > 0
          ? Math.round((item.totalSucessos / item.totalResultados) * 100)
          : 0
      }))
      .sort((a, b) => b.totalResultados - a.totalResultados || b.totalAcoes - a.totalAcoes)
      .slice(0, 10);

    return res.json({
      sucesso: true,
      periodoDias,
      totalEventos: eventos.length,
      totalResultados: resultados.length,
      totalSucessos: sucessos.length,
      taxaSucesso: resultados.length > 0
        ? Math.round((sucessos.length / resultados.length) * 100)
        : 0,
      funil,
      rankingUsuarios,
      rankingAcoes,
    });
  } catch (error) {
    console.error('Erro ao buscar métricas executivas do cockpit:', error);
    responderErro(res, 500, 'Erro interno ao buscar métricas executivas');
  }
});

// POST /api/leads - Criar lead manual
router.post('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { nome, telefone, email, cpf } = req.body;

    const nomeNormalizado = String(nome || '').trim();
    const telefoneNormalizado = normalizarTelefone(telefone);
    const emailNormalizado = normalizarEmail(email);
    const cpfNormalizado = normalizarCpf(cpf);

    if (!nomeNormalizado) {
      return responderErro(res, 400, 'Nome é obrigatório');
    }

    if (!telefoneNormalizado && !emailNormalizado) {
      return responderErro(res, 400, 'Informe ao menos telefone ou email para cadastro do lead');
    }

    // Verificar se tenant existe
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return responderErro(res, 404, 'Tenant não encontrado');
    }

    const condicoesDuplicidade: any[] = [];

    if (cpfNormalizado) {
      condicoesDuplicidade.push({ cpf: cpfNormalizado });
    }

    if (emailNormalizado) {
      condicoesDuplicidade.push({ email: { equals: emailNormalizado, mode: 'insensitive' as const } });
    }

    if (telefoneNormalizado) {
      condicoesDuplicidade.push({ telefone: { contains: telefoneNormalizado.slice(-8) } });
    }

    if (condicoesDuplicidade.length > 0) {
      const leadExistente = await prisma.lead.findFirst({
        where: {
          tenantId,
          OR: condicoesDuplicidade
        },
        select: {
          id: true,
          nome: true,
          telefone: true,
          email: true,
          status: true,
          temperatura: true
        }
      });

      if (leadExistente) {
        return responderErro(res, 409, 'Lead já cadastrado com dados semelhantes',
          leadExistente);
      }
    }

    const lead = await prisma.lead.create({
      data: {
        nome: nomeNormalizado,
        telefone: telefoneNormalizado || undefined,
        email: emailNormalizado || undefined,
        cpf: cpfNormalizado || undefined,
        tenantId, // ✅ Usando tenantId do request
        status: 'NOVO',
        temperatura: 'FRIO',
        origem: 'MANUAL'
      }
    });

    res.json(lead);
  } catch (error: any) {
    console.error('Erro ao criar lead:', error);
    responderErro(res, 500, 'Erro interno do servidor');
  }
});

// ============================================
// GET /api/leads/estatisticas - Dashboard resumo
// IMPORTANTE: Esta rota deve vir ANTES de /:id
// ============================================
router.get('/estatisticas', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    // Contagens - TODAS filtradas por tenantId
    const [
      total,
      quentes,
      novosHoje,
      porStatus,
      porTemperatura,
      avaliacoesHoje,
      aguardandoConfirmacao,
      agendamentosHoje
    ] = await Promise.all([
      // Total de leads do tenant (exceto arquivados)
      prisma.lead.count({
        where: {
          tenantId, // ✅ FILTRO
          status: { notIn: ['ARQUIVADO', 'CAPTADO', 'PERDIDO'] }
        }
      }),

      // Leads quentes do tenant
      prisma.lead.count({
        where: {
          tenantId, // ✅ FILTRO
          temperatura: 'QUENTE',
          status: { notIn: ['PERDIDO', 'CAPTADO'] }
        }
      }),

      // Novos hoje do tenant (exceto arquivados)
      prisma.lead.count({
        where: {
          tenantId, // ✅ FILTRO
          status: { notIn: ['ARQUIVADO', 'CAPTADO', 'PERDIDO'] }, // ✅ Excluir arquivados e clientes
          criadoEm: { gte: hoje, lt: amanha }
        }
      }),

      // Por status do tenant
      prisma.lead.groupBy({
        by: ['status'],
        _count: true,
        where: { tenantId } // ✅ FILTRO
      }),

      // Por temperatura do tenant
      prisma.lead.groupBy({
        by: ['temperatura'],
        _count: true,
        where: {
          tenantId, // ✅ FILTRO
          status: { notIn: ['PERDIDO', 'CAPTADO'] }
        }
      }),

      // Avaliações hoje (via lead do tenant)
      prisma.atividade.count({
        where: {
          lead: { tenantId }, // ✅ FILTRO via relacionamento
          tipo: 'AVALIACAO',
          agendadoPara: { gte: hoje, lt: amanha },
          completadoEm: null
        }
      }),

      // Aguardando confirmação (via lead do tenant)
      prisma.atividade.count({
        where: {
          lead: { tenantId }, // ✅ FILTRO via relacionamento
          statusAgendamento: 'PENDENTE',
          agendadoPara: { gte: hoje }
        }
      }),

      // Agendamentos hoje (via lead do tenant)
      prisma.atividade.count({
        where: {
          lead: { tenantId }, // ✅ FILTRO via relacionamento
          agendadoPara: { gte: hoje, lt: amanha },
          completadoEm: null,
          statusAgendamento: { not: 'CANCELADO' }
        }
      })
    ]);

    // Próximas avaliações do tenant
    const proximasAvaliacoes = await prisma.atividade.findMany({
      where: {
        lead: { tenantId }, // ✅ FILTRO via relacionamento
        tipo: 'AVALIACAO',
        agendadoPara: { gte: hoje },
        completadoEm: null,
        statusAgendamento: { not: 'CANCELADO' }
      },
      orderBy: { agendadoPara: 'asc' },
      take: 5,
      include: { lead: true }
    });

    res.json({
      // Campos para o dashboard simplificado
      total,
      quentes,
      agendamentosHoje,
      novosHoje,

      // Campos detalhados
      porStatus: Object.fromEntries(porStatus.map((s: any) => [s.status, s._count])),
      porTemperatura: Object.fromEntries(porTemperatura.map((t: any) => [t.temperatura, t._count])),
      avaliacoesHoje,
      aguardandoConfirmacao,
      proximasAvaliacoes: proximasAvaliacoes.map((a: any) => ({
        id: a.id,
        leadNome: a.lead?.nome || 'Sem nome',
        agendadoPara: a.agendadoPara,
        statusAgendamento: a.statusAgendamento
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    responderErro(res, 500, 'Erro interno');
  }
});

// ============================================
// GET /api/leads/:id - Detalhes completos do lead
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        campanhaOrigem: true,
        imoveis: true,
        atividades: {
          orderBy: { criadoEm: 'desc' }
        },
        conversas: {
          orderBy: { iniciadaEm: 'desc' },
          include: {
            mensagens: {
              orderBy: { enviadaEm: 'desc' },
              take: 50
            }
          }
        }
      }
    });

    if (!lead) {
      return responderErro(res, 404, 'Lead não encontrado');
    }

    // ✅ Verificar se lead pertence ao tenant
    if (lead.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    // Cast para any temporário (Prisma Client ainda com cache antigo)
    const l: any = lead;
    const faltantesGovernanca = camposCriticosFaltantes({
      interesseEm: l.interesseEm,
      tipoImovel: l.tipoImovel,
      areaImovel: l.areaImovel,
      ocupacaoImovel: l.ocupacaoImovel,
      valorPretendido: l.valorPretendido,
      doresIdentificadas: l.doresIdentificadas,
      situacaoAtual: l.situacaoAtual,
      motivacaoVenda: l.motivacaoVenda,
      consequencias: l.consequencias,
      custosAtuais: l.custosAtuais,
    });
    const totalCamposCriticos = 9;
    const preenchidosCriticos = totalCamposCriticos - faltantesGovernanca.length;
    const fieldSources = extrairFieldSources(l.schemaState);
    const lastSourceUpdateAt = obterLastSourceUpdateAt(l.schemaState);

    // Formatar resposta estruturada
    const resposta = {
      // Dados básicos
      id: l.id,
      nome: l.nome,
      telefone: l.telefone,
      email: l.email,
      cpf: l.cpf,
      enderecoPrincipal: l.enderecoPrincipal,
      complementoPrincipal: l.complementoPrincipal,
      status: l.status,
      temperatura: l.temperatura,
      origem: l.origem,
      primeiroContato: l.primeiroContato,
      ultimaInteracao: l.ultimaInteracao,
      criadoEm: l.criadoEm,
      atualizadoEm: l.atualizadoEm,

      // Campanha origem
      campanhaOrigem: l.campanhaOrigem ? {
        id: l.campanhaOrigem.id,
        nome: l.campanhaOrigem.nome
      } : null,

      // Dados do imóvel (proprietário quer vender/alugar)
      imovel: {
        endereco: l.enderecoImovel,
        tipo: l.tipoImovel,
        area: l.areaImovel,
        quartos: l.quartosImovel,
        vagas: l.vagasImovel,
        valorPretendido: l.valorPretendido,
        ocupacao: l.ocupacaoImovel,
        interesseEm: l.interesseEm
      },

      // Qualificação SPIN
      spin: {
        situacao: {
          situacaoAtual: l.situacaoAtual,
          tempoDecisao: l.tempoDecisao,
          tentativasAnteriores: l.tentativasAnteriores,
          comCorretorAtualmente: l.comCorretorAtualmente
        },
        problema: {
          motivacaoVenda: l.motivacaoVenda,
          doresIdentificadas: l.doresIdentificadas || []
        },
        implicacao: {
          prazoDesejado: l.prazoDesejado,
          urgencia: l.urgencia,
          consequencias: l.consequencias,
          custosAtuais: l.custosAtuais,
          pressaoTempo: l.pressaoTempo
        },
        necessidade: {
          expectativaServico: l.expectativaServico,
          objecoes: l.objecoes || [],
          interesseAvaliacao: l.interesseAvaliacao
        },
        observacoes: l.observacoesSpin
      },

      // Governança da qualificação (source_of_truth + completude)
      governanca: {
        prontidaoQualificacao: faltantesGovernanca.length === 0 ? 'COMPLETA' : 'PARCIAL',
        camposCriticos: {
          total: totalCamposCriticos,
          preenchidos: preenchidosCriticos,
          faltantes: faltantesGovernanca,
        },
        sourceOfTruth: {
          lastSourceUpdateAt,
          totalCamposRastreados: fieldSources.length,
          fields: fieldSources,
        },
      },

      // ====================================
      // NOVOS CAMPOS - PLAYBOOK CAPTAÇÃO
      // ====================================

      // Qualificação Adicional (Fase 2)
      situacaoFinanceira: l.situacaoFinanceira,
      temDividas: l.temDividas,
      estadoConservacao: l.estadoConservacao,

      // Negociação Comercial (Fase 3)
      comissaoAcordada: l.comissaoAcordada,
      tipoAutorizacao: l.tipoAutorizacao,
      prazoTrabalho: l.prazoTrabalho,
      autorizouAnuncio: l.autorizouAnuncio,

      // Contrato (Fase 4)
      contratoUrl: l.contratoUrl,
      dataAssinatura: l.dataAssinatura,
      vigenciaInicio: l.vigenciaInicio,
      vigenciaFim: l.vigenciaFim,

      // Tracking IA
      ultimaAcaoIA: l.ultimaAcaoIA,
      ultimaAcaoIAEm: l.ultimaAcaoIAEm,

      // Perda
      motivoPerda: l.motivoPerda,

      // Dados empresa (CNPJ)
      empresaAtual: l.empresaAtual,
      cnpjEmpresa: l.cnpjEmpresa,
      profissao: l.profissao,
      setor: l.setor,

      // Dados Pessoais (Assertiva — migrados do Contato na promoção)
      idade: l.idade,
      sexo: l.sexo,
      rendaEstimada: l.rendaEstimada,
      faixaSalarial: l.faixaSalarial,
      scoreAssertiva: l.scoreAssertiva,

      // Múltiplos contatos
      telefone2: l.telefone2,
      telefone3: l.telefone3,
      email2: l.email2,

      // Imóvel Assertiva
      bairroImovel: l.bairroImovel,
      nomeEdificio: l.nomeEdificio,
      inscricaoIptu: l.inscricaoIptu,
      valorVenal: l.valorVenal,

      // Briefing IA (Dossiê do Closer gerado no handoff)
      briefingCloser: l.briefingCloser,

      // Dados avançados do imóvel (onboarding/admin) — flat, alinhado com LeadPriorizado
      imovelSuites: l.imovelSuites,
      imovelBanheiros: l.imovelBanheiros,
      imovelAreaTotal: l.imovelAreaTotal,
      imovelAndar: l.imovelAndar,
      imovelCaracteristicas: l.imovelCaracteristicas || [],
      imovelDescricao: l.imovelDescricao,
      imovelFotos: l.imovelFotos || [],
      imovelValorLocacao: l.imovelValorLocacao,
      imovelValorCondominio: l.imovelValorCondominio,
      imovelValorIPTU: l.imovelValorIPTU,
      dadosImovelColetadosEm: l.dadosImovelColetadosEm,

      // Áreas físicas do imóvel (Assertiva/mineração)
      areaConstruida: l.areaConstruida,
      areaTerreno: l.areaTerreno,

      // Dados do proprietário para CRM
      rg: l.rg,
      cidade: l.cidade,
      estado: l.estado,
      cep: l.cep,

      // Status de integração CRM (Quadra Dois)
      crm: {
        proprietarioId: l.crmProprietarioId,
        propertyId: l.crmPropertyId,
        propertyCode: l.crmPropertyCode,
        syncStatus: l.crmSyncStatus,
        syncError: l.crmSyncError,
        enviadoEm: l.enviadoParaCrmEm,
      },

      // Imóveis relacionados (da mineração)
      imoveisMineracao: l.imoveis.map((imovel: any) => ({
        id: imovel.id,
        endereco: `${imovel.logradouro}, ${imovel.numero || 'S/N'} - ${imovel.bairro}`,
        tipo: imovel.tipoImovel,
        area: imovel.areaEdificada,
        edificio: imovel.nomeEdificio,
        apartamento: imovel.apartamento,
        statusCaptacao: imovel.statusCaptacao
      })),

      // Atividades (timeline)
      atividades: l.atividades.map((atividade: any) => ({
        id: atividade.id,
        tipo: atividade.tipo,
        titulo: atividade.titulo,
        descricao: atividade.descricao,
        agendadoPara: atividade.agendadoPara,
        completadoEm: atividade.completadoEm,
        statusAgendamento: atividade.statusAgendamento,
        tokenConfirmacao: atividade.tokenConfirmacao,
        confirmadoEm: atividade.confirmadoEm,
        confirmadoPor: atividade.confirmadoPor,
        canceladoEm: atividade.canceladoEm,
        motivoCancelamento: atividade.motivoCancelamento,
        criadoPor: atividade.criadoPor,
        criadoEm: atividade.criadoEm,
        versao: atividade.versao
      })),

      // Conversas
      conversas: l.conversas.map((conversa: any) => ({
        id: conversa.id,
        canal: conversa.canal,
        estado: conversa.estadoConversa,
        faseSPIN: conversa.faseSPIN,
        iniciadaEm: conversa.iniciadaEm,
        ultimaMensagemEm: conversa.ultimaMensagemEm,
        mensagens: conversa.mensagens.map((msg: any) => ({
          id: msg.id,
          remetente: msg.remetente,
          conteudo: msg.conteudo,
          enviadaEm: msg.enviadaEm
        }))
      })),

      // Próxima atividade pendente (se houver)
      proximaAtividade: l.atividades.find((a: any) =>
        a.agendadoPara &&
        !a.completadoEm &&
        a.statusAgendamento !== 'CANCELADO' &&
        new Date(a.agendadoPara) >= new Date()
      ) || null,

      // ── Scores unificados ──
      // scoreQualificacao: completude e qualidade do lead (0-100)
      // scoreUrgencia: urgência operacional / SLA (0-100)
      // scoreComposto: métrica única = qualif×0.4 + urgência×0.6 (mesma fórmula do Mission Control)
      ...(() => {
        // Calculados uma única vez (evita triple computation)
        const proximaAtiv = l.atividades.find((a: any) =>
          a.agendadoPara && !a.completadoEm && a.statusAgendamento !== 'CANCELADO'
        );
        const scoreQualificacao = calcularQualificacao(l);
        const { pontos: scoreUrgencia, motivos: motivosUrgencia, orientacaoAcao } = calcularUrgencia(
          {
            ...l,
            proximaAtividadeData: proximaAtiv?.agendadoPara || null,
            horasSemResposta: null, // não disponível neste endpoint sem join extra
            urgenciaEnum: l.urgencia,
          },
          Date.now()
        );
        return {
          scoreQualificacao,
          scoreUrgencia,
          scoreComposto: Math.round(scoreQualificacao * 0.4 + scoreUrgencia * 0.6),
          motivosUrgencia,
          orientacaoAcao,
        };
      })()
    };

    res.json(resposta);
  } catch (error) {
    console.error('Erro ao buscar lead:', error);
    responderErro(res, 500, 'Erro interno ao buscar lead');
  }
});

// ============================================
// GET /api/leads/:id/cockpit-admin - Status operacional (Agente + CRM)
// ============================================
router.get('/:id/cockpit-admin', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        status: true,
        crmProprietarioId: true,
        crmPropertyId: true,
        crmPropertyCode: true,
        crmSyncStatus: true,
        crmSyncError: true,
        enviadoParaCrmEm: true,
      }
    });

    if (!lead) {
      return responderErro(res, 404, 'Lead não encontrado');
    }
    if (lead.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    const [agenteAdmin, integracaoCRM] = await Promise.all([
      prisma.configuracaoAgente.findFirst({
        where: { tenantId },
        select: {
          id: true,
          nome: true,
          tipoAgente: true,
          status: true,
          estaAtivo: true,
          sessaoWhatsapp: {
            select: {
              id: true,
              nome: true,
              numeroWhatsapp: true,
              status: true,
            }
          }
        }
      }),
      prisma.configuracaoIntegracao.findUnique({
        where: {
          tenantId_tipo: {
            tenantId,
            tipo: TipoIntegracao.CRM_QUADRADOIS
          }
        },
        select: {
          id: true,
          ativo: true,
          apiUrl: true,
          apiKeyCriptografada: true,
          tenantIdDestino: true,
          ultimoTesteEm: true,
          ultimoTesteOk: true,
          ultimoErro: true,
          totalEnvios: true,
          totalSucessos: true,
          totalFalhas: true,
          ultimoEnvioEm: true,
        }
      })
    ]);

    res.json({
      agenteAdmin: agenteAdmin || null,
      integracaoCRM: integracaoCRM
        ? (() => {
            const { apiKeyCriptografada, ...restoIntegracao } = integracaoCRM;
            return {
              ...restoIntegracao,
              temApiKey: Boolean(apiKeyCriptografada),
            };
          })()
        : null,
      crmLead: {
        statusLead: lead.status,
        proprietarioId: lead.crmProprietarioId,
        propertyId: lead.crmPropertyId,
        propertyCode: lead.crmPropertyCode,
        syncStatus: lead.crmSyncStatus,
        syncError: lead.crmSyncError,
        enviadoEm: lead.enviadoParaCrmEm,
      }
    });
  } catch (error) {
    console.error('Erro ao buscar cockpit admin:', error);
    responderErro(res, 500, 'Erro interno ao buscar cockpit admin');
  }
});

// ============================================
// POST /api/leads/:id/crm/enviar - Envio manual para CRM
// ============================================
router.post('/:id/crm/enviar', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id } = req.params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, tenantId: true }
    });

    if (!lead) return responderErro(res, 404, 'Lead não encontrado');
    if (lead.tenantId !== tenantId) return responderErro(res, 403, 'Acesso negado');

    const resultado = await enviarParaCrm(id);
    if (!resultado.success) {
      return res.status(400).json({
        sucesso: false,
        erro: resultado.error || 'Falha no envio para CRM',
        resultado
      });
    }

    return res.json({
      sucesso: true,
      mensagem: 'Lead enviado para CRM com sucesso',
      resultado
    });
  } catch (error) {
    console.error('Erro ao enviar lead para CRM:', error);
    responderErro(res, 500, 'Erro interno ao enviar para CRM');
  }
});

// ============================================
// POST /api/leads/:id/crm/reenviar - Reenvio manual para CRM
// ============================================
router.post('/:id/crm/reenviar', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id } = req.params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, tenantId: true }
    });

    if (!lead) return responderErro(res, 404, 'Lead não encontrado');
    if (lead.tenantId !== tenantId) return responderErro(res, 403, 'Acesso negado');

    const resultado = await reenviarParaCrm(id);
    if (!resultado.success) {
      return res.status(400).json({
        sucesso: false,
        erro: resultado.error || 'Falha no reenvio para CRM',
        resultado
      });
    }

    return res.json({
      sucesso: true,
      mensagem: 'Lead reenviado para CRM com sucesso',
      resultado
    });
  } catch (error) {
    console.error('Erro ao reenviar lead para CRM:', error);
    responderErro(res, 500, 'Erro interno ao reenviar para CRM');
  }
});

// ============================================
// GET /api/leads/:id/crm/status - Verificar status no CRM externo
// ============================================
router.get('/:id/crm/status', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id } = req.params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, tenantId: true }
    });

    if (!lead) return responderErro(res, 404, 'Lead não encontrado');
    if (lead.tenantId !== tenantId) return responderErro(res, 403, 'Acesso negado');

    const resultado = await verificarStatusCrm(id);
    return res.json({
      sucesso: Boolean(resultado.success),
      resultado
    });
  } catch (error) {
    console.error('Erro ao verificar status no CRM:', error);
    responderErro(res, 500, 'Erro interno ao verificar status no CRM');
  }
});

// ============================================
// POST /api/leads/:id/cockpit-evento - Registrar telemetria do cockpit
// ============================================
router.post('/:id/cockpit-evento', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id } = req.params;
    const { acao, detalhes } = req.body;

    if (!acao || typeof acao !== 'string') {
      return responderErro(res, 400, 'Campo "acao" é obrigatório');
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, tenantId: true, status: true }
    });

    if (!lead) return responderErro(res, 404, 'Lead não encontrado');
    if (lead.tenantId !== tenantId) return responderErro(res, 403, 'Acesso negado');

    const usuarioId = (req as any).usuario?.id || null;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress
      || undefined;

    ServicoAuditoria.registrar({
      tenantId,
      usuarioId: usuarioId || undefined,
      acao: `COCKPIT_${acao.toUpperCase()}`,
      entidade: 'Lead',
      entidadeId: id,
      detalhes: {
        origem: 'lead_detalhes',
        statusLead: lead.status,
        ...((detalhes && typeof detalhes === 'object') ? detalhes : {}),
      },
      ip,
    });

    return res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao registrar telemetria do cockpit:', error);
    responderErro(res, 500, 'Erro interno ao registrar telemetria');
  }
});

// ============================================
// GET /api/leads/:id/cockpit-eventos - Listar telemetria recente do cockpit
// ============================================
router.get('/:id/cockpit-eventos', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id } = req.params;
    const limiteParam = Number(req.query.limite || 30);
    const limite = Number.isFinite(limiteParam) ? Math.min(200, Math.max(1, limiteParam)) : 30;

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, tenantId: true }
    });

    if (!lead) return responderErro(res, 404, 'Lead não encontrado');
    if (lead.tenantId !== tenantId) return responderErro(res, 403, 'Acesso negado');

    const eventos = await prisma.logAuditoria.findMany({
      where: {
        tenantId,
        entidade: 'Lead',
        entidadeId: id,
        acao: {
          startsWith: 'COCKPIT_'
        }
      },
      orderBy: { criadoEm: 'desc' },
      take: limite,
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
          }
        }
      }
    });

    return res.json({
      sucesso: true,
      eventos: eventos.map((evento) => ({
        id: evento.id,
        acao: evento.acao,
        detalhes: evento.detalhes,
        criadoEm: evento.criadoEm,
        usuario: evento.usuario
          ? { id: evento.usuario.id, nome: evento.usuario.nome, email: evento.usuario.email }
          : null,
      }))
    });
  } catch (error) {
    console.error('Erro ao listar telemetria do cockpit:', error);
    responderErro(res, 500, 'Erro interno ao listar telemetria');
  }
});

// ============================================
// PATCH /api/leads/:id - Atualizar lead
// ============================================
router.patch('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id } = req.params;
    const dados = req.body;

    // Verificar se lead existe
    const leadExiste = await prisma.lead.findUnique({ where: { id } });
    if (!leadExiste) {
      return responderErro(res, 404, 'Lead não encontrado');
    }

    // ✅ Verificar ownership
    if (leadExiste.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    const camposPermitidos = [
      // Básicos
      'nome', 'telefone', 'email', 'cpf', 'enderecoPrincipal', 'complementoPrincipal', 'status', 'temperatura',
      // Imóvel
      'enderecoImovel', 'tipoImovel', 'areaImovel', 'quartosImovel',
      'vagasImovel', 'valorPretendido', 'ocupacaoImovel', 'interesseEm', 'inscricaoIptu',
      // SPIN
      'situacaoAtual', 'tempoDecisao', 'tentativasAnteriores', 'comCorretorAtualmente',
      'motivacaoVenda', 'doresIdentificadas',
      'prazoDesejado', 'urgencia', 'consequencias', 'custosAtuais', 'pressaoTempo',
      'expectativaServico', 'objecoes', 'interesseAvaliacao',
      'observacoesSpin',
      // Qualificação adicional (Playbook Fase 2)
      'situacaoFinanceira', 'temDividas', 'estadoConservacao',
      // Negociação comercial (Playbook Fase 3)
      'comissaoAcordada', 'tipoAutorizacao', 'prazoTrabalho', 'autorizouAnuncio',
      // Contrato (Playbook Fase 4)
      'contratoUrl', 'dataAssinatura', 'vigenciaInicio', 'vigenciaFim',
      // Tracking IA
      'ultimaAcaoIA', 'ultimaAcaoIAEm',
      // Dados avançados do imóvel (Admin/Onboarding)
      'imovelSuites', 'imovelBanheiros', 'imovelAreaTotal', 'imovelAndar',
      'imovelCaracteristicas', 'imovelDescricao', 'imovelFotos',
      'imovelValorLocacao', 'imovelValorCondominio', 'imovelValorIPTU',
      'dadosImovelColetadosEm',
      // Perda
      'motivoPerda'
    ];

    // Filtrar apenas campos permitidos
    const dadosAtualizacao: any = {};
    for (const campo of camposPermitidos) {
      if (dados[campo] !== undefined) {
        dadosAtualizacao[campo] = dados[campo];
      }
    }

    // Adicionar data de última interação
    dadosAtualizacao.ultimaInteracao = new Date();

    const leadAtualizado = await prisma.lead.update({
      where: { id },
      data: dadosAtualizacao
    });

    res.json({
      sucesso: true,
      lead: {
        id: leadAtualizado.id,
        nome: leadAtualizado.nome,
        status: leadAtualizado.status,
        temperatura: leadAtualizado.temperatura,
        atualizadoEm: leadAtualizado.atualizadoEm
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar lead:', error);
    responderErro(res, 500, 'Erro interno ao atualizar lead');
  }
});

// ============================================
// POST /api/leads/:id/retencao-segura - Anonimização sem perder aprendizado
// ============================================
router.post('/:id/retencao-segura', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id } = req.params;
    const { confirmacao, preservarRag } = req.body || {};

    if (confirmacao !== 'anonimizar') {
      return responderErro(
        res,
        400,
        'Confirmação obrigatória para retenção segura',
        { mensagem: 'Envie confirmacao: \"anonimizar\" para prosseguir.' }
      );
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, tenantId: true, nome: true },
    });

    if (!lead) {
      return responderErro(res, 404, 'Lead não encontrado');
    }

    if (lead.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    const resultado = await aplicarRetencaoSeguraLead({
      tenantId,
      leadId: id,
      preservarRag: preservarRag === true,
    });

    ServicoAuditoria.registrar({
      tenantId,
      acao: 'LEAD_RETENCAO_SEGURA',
      entidade: 'Lead',
      entidadeId: id,
      ip: req.ip || '127.0.0.1',
      detalhes: {
        leadNomeOriginal: lead.nome,
        tokenAnonimo: resultado.tokenAnonimo,
        mensagensAnonimizadas: resultado.mensagensAnonimizadas,
        conversasAnonimizadas: resultado.conversasAnonimizadas,
        embeddingsRemovidos: resultado.embeddingsRemovidos,
        preservarRag: resultado.preservarRag,
      },
    });

    return res.json({
      sucesso: true,
      mensagem: 'Retenção segura aplicada com sucesso (dados sensíveis anonimizados)',
      resultado,
    });
  } catch (error) {
    console.error('Erro ao aplicar retenção segura no lead:', error);
    return responderErro(res, 500, 'Erro interno ao aplicar retenção segura');
  }
});

// ============================================
// DELETE /api/leads/:id - Exclusão permanente
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id } = req.params;
    const { confirmacao } = req.body; // Espera "excluir" para confirmar

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            conversas: true,
            atividades: true,
            imoveis: true
          }
        }
      }
    });

    if (!lead) {
      return responderErro(res, 404, 'Lead não encontrado');
    }

    // ✅ Verificar ownership
    if (lead.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    // Contar dados relacionados
    const [contratosCount, mensagensCount] = await Promise.all([
      prisma.contrato.count({ where: { leadId: id } }),
      prisma.mensagem.count({ where: { conversa: { leadId: id } } })
    ]);

    const dadosVinculados = {
      conversas: (lead as any)._count.conversas,
      mensagens: mensagensCount,
      atividades: (lead as any)._count.atividades,
      imoveis: (lead as any)._count.imoveis,
      contratos: contratosCount
    };

    const totalVinculados = Object.values(dadosVinculados).reduce((a, b) => a + b, 0);

    // Se tem dados vinculados, exige confirmação
    if (totalVinculados > 0 && confirmacao !== 'excluir') {
      return res.status(400).json({
        erro: 'Este lead possui dados vinculados. Para excluir permanentemente, envie confirmacao: "excluir"',
        requiresConfirmation: true,
        dadosVinculados,
        mensagem: `Este lead possui ${totalVinculados} registros vinculados que serão excluídos permanentemente.`
      });
    }

    // ======= CASCADE DELETE =======
    console.log(`[Leads] Excluindo lead ${id} com ${totalVinculados} registros vinculados...`);

    await cascadeDeleteLeads([id]);

    console.log(`[Leads] ✅ Lead ${id} e todos os dados vinculados excluídos com sucesso`);
    res.json({
      sucesso: true,
      mensagem: 'Lead excluído permanentemente',
      dadosExcluidos: dadosVinculados
    });
  } catch (error) {
    console.error('Erro ao excluir lead:', error);
    responderErro(res, 500, 'Erro interno ao excluir lead');
  }
});

// ============================================
// POST /api/leads/:id/restaurar - Restaurar lead arquivado
// ============================================
router.post('/:id/restaurar', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Não autorizado');

    const { id } = req.params;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return responderErro(res, 404, 'Lead não encontrado');
    }

    // ✅ Proteção IDOR: Verificar ownership
    if (lead.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    await prisma.lead.update({
      where: { id },
      data: {
        deletadoEm: null,
        status: 'NOVO'
      }
    });

    await prisma.atividade.create({
      data: {
        leadId: id,
        tipo: 'NOTA',
        titulo: '♻️ Lead restaurado',
        descricao: 'Lead foi restaurado pelo corretor',
        criadoPor: 'corretor',
        completadoEm: new Date()
      }
    });

    res.json({ sucesso: true, mensagem: 'Lead restaurado com sucesso' });
  } catch (error) {
    console.error('Erro ao restaurar lead:', error);
    responderErro(res, 500, 'Erro interno ao restaurar lead');
  }
});

// ============================================
// POST /api/leads/:id/perder - Marcar como perdido
// ============================================
router.post('/:id/perder', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Não autorizado');

    const { id } = req.params;
    const { motivo, observacoes } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return responderErro(res, 404, 'Lead não encontrado');
    }

    // ✅ Proteção IDOR: Verificar ownership
    if (lead.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    await prisma.lead.update({
      where: { id },
      data: {
        status: 'PERDIDO',
        motivoPerda: motivo || 'Não informado',
        ultimaInteracao: new Date()
      }
    });

    // Registrar motivo da perda
    await prisma.atividade.create({
      data: {
        leadId: id,
        tipo: 'NOTA',
        titulo: '❌ Lead perdido',
        descricao: `Motivo: ${motivo || 'Não informado'}${observacoes ? `\n\nObservações: ${observacoes}` : ''}`,
        criadoPor: 'corretor',
        completadoEm: new Date()
      }
    });

    res.json({ sucesso: true, mensagem: 'Lead marcado como perdido' });
  } catch (error) {
    console.error('Erro ao marcar lead como perdido:', error);
    responderErro(res, 500, 'Erro interno');
  }
});

// ============================================
// POST /api/leads/:id/captar - Marcar como captado (sucesso!)
// ============================================
router.post('/:id/captar', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Não autorizado');

    const { id } = req.params;
    const { tipoContrato, valorContrato, observacoes } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return responderErro(res, 404, 'Lead não encontrado');
    }

    // ✅ Proteção IDOR: Verificar ownership
    if (lead.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    await prisma.lead.update({
      where: { id },
      data: {
        status: 'CAPTADO',
        temperatura: 'QUENTE',
        tipoAutorizacao: tipoContrato?.includes('EXCLUSIVA') ? 'exclusiva' : 'simples',
        dataAssinatura: new Date(),
        ultimaInteracao: new Date()
      }
    });

    // Registrar captação
    await prisma.atividade.create({
      data: {
        leadId: id,
        tipo: 'NOTA',
        titulo: '🎉 Imóvel captado!',
        descricao: [
          tipoContrato ? `Tipo: ${tipoContrato}` : null,
          valorContrato ? `Valor: R$ ${Number(valorContrato).toLocaleString('pt-BR')}` : null,
          observacoes ? `Observações: ${observacoes}` : null
        ].filter(Boolean).join('\n') || 'Captação realizada com sucesso',
        criadoPor: 'corretor',
        completadoEm: new Date()
      }
    });

    res.json({
      sucesso: true,
      mensagem: 'Parabéns! Imóvel captado com sucesso! 🎉',
      lead: { id, status: 'CAPTADO' }
    });
  } catch (error) {
    console.error('Erro ao captar lead:', error);
    responderErro(res, 500, 'Erro interno');
  }
});

// ============================================
// POST /api/leads/:id/reativar - Reativar lead perdido/arquivado
// ============================================
router.post('/:id/reativar', async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo, temperatura } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return responderErro(res, 404, 'Lead não encontrado');
    }

    await prisma.lead.update({
      where: { id },
      data: {
        status: 'NOVO',
        temperatura: temperatura || 'MORNO',
        deletadoEm: null,
        ultimaInteracao: new Date()
      }
    });

    await prisma.atividade.create({
      data: {
        leadId: id,
        tipo: 'NOTA',
        titulo: '🔄 Lead reativado',
        descricao: motivo ? `Motivo: ${motivo}` : 'Lead foi reativado para nova tentativa de captação',
        criadoPor: 'corretor',
        completadoEm: new Date()
      }
    });

    res.json({ sucesso: true, mensagem: 'Lead reativado com sucesso!' });
  } catch (error) {
    console.error('Erro ao reativar lead:', error);
    responderErro(res, 500, 'Erro interno');
  }
});

// ============================================
// PATCH /api/leads/:id/atividades/:atividadeId - Atualizar atividade
// ============================================
router.patch('/:id/atividades/:atividadeId', async (req, res) => {
  try {
    const { id, atividadeId } = req.params;
    const { acao, observacao, novaData, requestId, expectedVersion } = req.body;
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Tenant nao identificado');

    const atividade = await prisma.atividade.findFirst({
      where: { id: atividadeId, leadId: id }
    });

    if (!atividade) {
      return responderErro(res, 404, 'Atividade não encontrada');
    }

    if (['cancelar', 'reagendar', 'nao_compareceu'].includes(acao)) {
      if (typeof requestId !== 'string' || !Number.isInteger(expectedVersion)) {
        return responderErro(res, 400, 'requestId e expectedVersion sao obrigatorios');
      }
      if (acao === 'reagendar' && (!novaData || Number.isNaN(new Date(novaData).getTime()))) {
        return responderErro(res, 400, 'Nova data valida e obrigatoria para reagendar');
      }
      const base = {
        tenantId, leadId: id, atividadeId, requestIdentity: { source: 'MANUAL_API' as const, id: requestId },
        ator: req.usuario?.email || 'corretor', origem: 'API_LEADS_ATIVIDADE',
        motivo: observacao || (acao === 'nao_compareceu' ? 'Ausencia do Lead' : `${acao} pelo operador`),
        policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION, ocorridoEm: new Date(), expectedVersion,
      };
      const comando = acao === 'reagendar'
        ? { ...base, operacao: 'REAGENDAR' as const, novoHorario: new Date(novaData) }
        : acao === 'cancelar'
          ? { ...base, operacao: 'CANCELAR' as const }
          : { ...base, operacao: 'NO_SHOW' as const, parteAusente: 'LEAD' as const };
      const result = await executarComandoAgenda(comando);
      if (!result.success) return responderErro(res, result.reasonCode === 'REQUEST_ID_CONFLICT' ? 409 : 422, result.reasonCode);
      const mensagemResultado = acao === 'reagendar' ? 'Atividade reagendada' : acao === 'cancelar' ? 'Atividade cancelada' : 'Marcado como nao compareceu';
      return res.json({ sucesso: true, mensagem: mensagemResultado, result });
    }

    let dadosAtualizacao: any = {};
    let mensagem = '';

    switch (acao) {
      case 'completar':
        dadosAtualizacao = {
          completadoEm: new Date(),
          statusAgendamento: 'REALIZADO'
        };
        mensagem = 'Atividade marcada como realizada';
        break;

      default:
        return responderErro(res, 400, 'Ação inválida');
    }

    await prisma.atividade.update({
      where: { id: atividadeId },
      data: dadosAtualizacao
    });

    res.json({ sucesso: true, mensagem });
  } catch (error) {
    console.error('Erro ao atualizar atividade:', error);
    responderErro(res, 500, 'Erro interno');
  }
});

// ============================================
// DELETE /api/leads/:id/atividades/:atividadeId - Deletar atividade
// ============================================
router.delete('/:id/atividades/:atividadeId', async (req, res) => {
  try {
    const { id, atividadeId } = req.params;

    const atividade = await prisma.atividade.findFirst({
      where: { id: atividadeId, leadId: id }
    });

    if (!atividade) {
      return responderErro(res, 404, 'Atividade não encontrada');
    }

    await prisma.atividade.delete({
      where: { id: atividadeId }
    });

    res.json({ sucesso: true, mensagem: 'Atividade removida' });
  } catch (error) {
    console.error('Erro ao deletar atividade:', error);
    responderErro(res, 500, 'Erro interno');
  }
});

// ============================================
// POST /api/leads/:id/atividades - Criar atividade (agendamento)
// ============================================
router.post('/:id/atividades', async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, titulo, descricao, agendadoPara } = req.body;

    // Verificar se lead existe
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return responderErro(res, 404, 'Lead não encontrado');
    }

    // Gerar token de confirmação se for agendamento
    const tokenConfirmacao = tipo === 'AVALIACAO' || tipo === 'TAREFA' || tipo === 'REUNIAO'
      ? crypto.randomUUID()
      : null;

    const atividade = await prisma.atividade.create({
      data: {
        leadId: id,
        tipo: tipo || 'TAREFA',
        titulo: titulo || 'Nova atividade',
        descricao,
        agendadoPara: agendadoPara ? new Date(agendadoPara) : null,
        statusAgendamento: agendadoPara ? 'PENDENTE' : null,
        tokenConfirmacao,
        statusConfirmacaoCorretor: (tipo === 'REUNIAO' && agendadoPara) ? 'PENDENTE' : null,
        tokenConfirmacaoCorretor: (tipo === 'REUNIAO' && agendadoPara) ? crypto.randomUUID() : null,
        criadoPor: 'corretor'
      }
    });

    res.json({
      sucesso: true,
      atividade: {
        id: atividade.id,
        tipo: atividade.tipo,
        titulo: atividade.titulo,
        agendadoPara: atividade.agendadoPara,
        statusAgendamento: atividade.statusAgendamento,
        tokenConfirmacao: atividade.tokenConfirmacao,
        linkConfirmacao: tokenConfirmacao
          ? `${process.env.FRONTEND_URL || 'http://localhost'}/confirmar/${atividade.id}/${tokenConfirmacao}`
          : null
      }
    });
  } catch (error) {
    console.error('Erro ao criar atividade:', error);
    responderErro(res, 500, 'Erro interno ao criar atividade');
  }
});

// ============================================
// GET /api/leads/confirmacao-corretor/painel - Painel operacional
// ============================================
router.get('/confirmacao-corretor/painel', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const agora = new Date();
    const inicioJanela = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
    const fimJanela = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

    const atividades = await (prisma.atividade as any).findMany({
      where: {
        tipo: 'REUNIAO',
        agendadoPara: { gte: inicioJanela, lte: fimJanela },
        lead: { tenantId },
      },
      include: {
        lead: {
          select: {
            id: true,
            nome: true,
            telefone: true,
            campanhaOrigem: { select: { id: true, nome: true } }
          }
        }
      },
      orderBy: { agendadoPara: 'asc' },
      take: 200,
    });

    const statusAlvo = ['PENDENTE', 'CONFIRMADO', 'EXPIRADO', 'REMANEJADO', 'RECUSADO'];
    const totais = {
      pendente: 0,
      confirmado: 0,
      expirado: 0,
      remanejado: 0,
      recusado: 0,
      total: 0,
    };

    const temposConfirmacaoMin: number[] = [];
    const itens = atividades.map((atividade: any) => {
      const status = statusAlvo.includes(atividade.statusConfirmacaoCorretor)
        ? atividade.statusConfirmacaoCorretor
        : 'PENDENTE';
      const cutoff = atividade.agendadoPara
        ? new Date(new Date(atividade.agendadoPara).getTime() - 60 * 60 * 1000)
        : null;

      totais.total++;
      if (status === 'PENDENTE') totais.pendente++;
      if (status === 'CONFIRMADO') totais.confirmado++;
      if (status === 'EXPIRADO') totais.expirado++;
      if (status === 'REMANEJADO') totais.remanejado++;
      if (status === 'RECUSADO') totais.recusado++;

      if (atividade.confirmacaoCorretorSolicitadaEm && atividade.confirmadoCorretorEm) {
        const minutos = Math.max(
          0,
          Math.round(
            (new Date(atividade.confirmadoCorretorEm).getTime() -
              new Date(atividade.confirmacaoCorretorSolicitadaEm).getTime()) /
              60000
          )
        );
        temposConfirmacaoMin.push(minutos);
      }

      return {
        atividadeId: atividade.id,
        leadId: atividade.lead?.id || null,
        leadNome: atividade.lead?.nome || 'Lead sem nome',
        leadTelefone: atividade.lead?.telefone || null,
        campanhaId: atividade.lead?.campanhaOrigem?.id || null,
        campanhaNome: atividade.lead?.campanhaOrigem?.nome || null,
        agendadoPara: atividade.agendadoPara,
        statusConfirmacaoCorretor: status,
        confirmacaoCorretorSolicitadaEm: atividade.confirmacaoCorretorSolicitadaEm,
        confirmadoCorretorEm: atividade.confirmadoCorretorEm,
        expiradoCorretorEm: atividade.expiradoCorretorEm,
        remanejadoCorretorEm: atividade.remanejadoCorretorEm,
        corretorOriginalId: atividade.corretorOriginalId,
        corretorAtualId: atividade.corretorAtualId,
        cutoffEm: cutoff,
      };
    });

    const taxaConfirmacaoNoPrazo = totais.total > 0 ? Number((totais.confirmado / totais.total).toFixed(4)) : 0;
    const taxaRemanejamento = totais.total > 0 ? Number((totais.remanejado / totais.total).toFixed(4)) : 0;
    const tempoMedioConfirmacaoMin =
      temposConfirmacaoMin.length > 0
        ? Math.round(temposConfirmacaoMin.reduce((acc, valor) => acc + valor, 0) / temposConfirmacaoMin.length)
        : null;

    return res.json({
      sucesso: true,
      periodo: {
        inicio: inicioJanela.toISOString(),
        fim: fimJanela.toISOString(),
      },
      kpis: {
        taxaConfirmacaoNoPrazo,
        taxaRemanejamento,
        tempoMedioConfirmacaoMin,
      },
      totais,
      itens,
    });
  } catch (error) {
    console.error('Erro ao carregar painel de confirmação do corretor:', error);
    return responderErro(res, 500, 'Erro interno ao carregar painel');
  }
});

// ============================================
// GET /api/leads/confirmar/:atividadeId/:token - Validar token (PÚBLICO)
// ============================================
router.get('/confirmar/:atividadeId/:token', async (req, res) => {
  try {
    const { atividadeId, token } = req.params;

    const atividade = await prisma.atividade.findFirst({
      where: {
        id: atividadeId,
        tokenConfirmacao: token
      },
      include: {
        lead: true
      }
    });

    if (!atividade) {
      return responderErro(res, 404, 'Link inválido ou expirado',
        {valido: false});
    }

    res.json({
      valido: true,
      atividade: {
        id: atividade.id,
        tipo: atividade.tipo,
        titulo: atividade.titulo,
        agendadoPara: atividade.agendadoPara,
        statusAgendamento: atividade.statusAgendamento,
        lead: {
          nome: atividade.lead.nome,
          telefone: atividade.lead.telefone,
          enderecoImovel: atividade.lead.enderecoImovel
        }
      }
    });
  } catch (error) {
    console.error('Erro ao validar token:', error);
    responderErro(res, 500, 'Erro interno');
  }
});

// ============================================
// POST /api/leads/confirmar/:atividadeId/:token - Confirmar ou cancelar (PÚBLICO)
// ============================================
router.post('/confirmar/:atividadeId/:token', async (req, res) => {
  try {
    const { atividadeId, token } = req.params;
    const { acao, motivoCancelamento } = req.body;

    // Validar token
    const atividade = await prisma.atividade.findFirst({
      where: {
        id: atividadeId,
        tokenConfirmacao: token
      },
      include: { lead: { select: { id: true, tenantId: true } } }
    });

    if (!atividade) {
      return responderErro(res, 404, 'Link inválido ou expirado',
        {sucesso: false});
    }

    // Verificar se já foi confirmado/cancelado
    if (atividade.statusAgendamento === 'CONFIRMADO') {
      return res.json({
        sucesso: true,
        mensagem: 'Este agendamento já foi confirmado anteriormente.',
        statusAgendamento: 'CONFIRMADO'
      });
    }

    if (atividade.statusAgendamento === 'CANCELADO') {
      return res.json({
        sucesso: false,
        mensagem: 'Este agendamento já foi cancelado.',
        statusAgendamento: 'CANCELADO'
      });
    }

    // Processar ação
    if (acao === 'confirmar') {
      await prisma.atividade.update({
        where: { id: atividadeId },
        data: {
          statusAgendamento: 'CONFIRMADO',
          confirmadoPor: 'proprietario',
          confirmadoEm: new Date()
        }
      });

      res.json({
        sucesso: true,
        mensagem: 'Agendamento confirmado com sucesso! Aguardamos você.',
        statusAgendamento: 'CONFIRMADO'
      });
    } else if (acao === 'cancelar') {
      const result = await executarComandoAgenda({
        operacao: 'CANCELAR', tenantId: atividade.lead.tenantId, leadId: atividade.lead.id, atividadeId,
        requestIdentity: { source: 'PUBLIC_TOKEN', id: `${token}:cancelar` },
        ator: 'proprietario', origem: 'LINK_CONFIRMACAO', motivo: motivoCancelamento || 'Cancelamento pelo proprietario',
        policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION, ocorridoEm: new Date(), expectedVersion: atividade.versao,
      });
      if (!result.success && result.reasonCode !== 'COMMAND_REPLAY') return responderErro(res, 422, result.reasonCode);

      res.json({
        sucesso: true,
        mensagem: 'Agendamento cancelado. Entraremos em contato para remarcar.',
        statusAgendamento: 'CANCELADO'
      });
    } else {
      responderErro(res, 400, 'Ação inválida. Use "confirmar" ou "cancelar".');
    }
  } catch (error) {
    console.error('Erro ao processar confirmação:', error);
    responderErro(res, 500, 'Erro interno');
  }
});

// ============================================
// GET /api/leads/confirmar-corretor/:atividadeId/:token - Validar token do corretor (PÚBLICO)
// ============================================
router.get('/confirmar-corretor/:atividadeId/:token', async (req, res) => {
  try {
    const { atividadeId, token } = req.params;

    const atividade = await prisma.atividade.findFirst({
      where: {
        id: atividadeId,
        tokenConfirmacaoCorretor: token
      },
      include: {
        lead: true
      }
    });

    if (!atividade) {
      return responderErro(res, 404, 'Link inválido ou expirado', { valido: false });
    }

    const prazoCutoff = atividade.agendadoPara
      ? new Date(new Date(atividade.agendadoPara).getTime() - 60 * 60 * 1000)
      : null;

    res.json({
      valido: true,
      atividade: {
        id: atividade.id,
        tipo: atividade.tipo,
        titulo: atividade.titulo,
        agendadoPara: atividade.agendadoPara,
        statusConfirmacaoCorretor: (atividade as any).statusConfirmacaoCorretor || 'PENDENTE',
        prazoCutoff,
        lead: {
          nome: atividade.lead.nome,
          telefone: atividade.lead.telefone,
          enderecoImovel: atividade.lead.enderecoImovel
        }
      }
    });
  } catch (error) {
    console.error('Erro ao validar token do corretor:', error);
    responderErro(res, 500, 'Erro interno');
  }
});

// ============================================
// POST /api/leads/confirmar-corretor/:atividadeId/:token - Confirmar ou recusar (PÚBLICO)
// ============================================
router.post('/confirmar-corretor/:atividadeId/:token', async (req, res) => {
  try {
    const { atividadeId, token } = req.params;
    const { acao, motivoRecusa } = req.body || {};

    if (!['confirmar', 'recusar', 'ausencia'].includes(acao)) {
      return responderErro(res, 400, 'Ação inválida. Use "confirmar", "recusar" ou "ausencia".');
    }

    const atividade = await prisma.atividade.findFirst({
      where: {
        id: atividadeId,
        tokenConfirmacaoCorretor: token
      },
      include: {
        lead: { select: { tenantId: true } }
      }
    });

    if (!atividade) {
      return responderErro(res, 404, 'Link inválido ou expirado', { sucesso: false });
    }

    const statusAtual = (atividade as any).statusConfirmacaoCorretor || 'PENDENTE';
    if (statusAtual === 'CONFIRMADO') {
      return res.json({
        sucesso: true,
        mensagem: 'Presença já confirmada anteriormente.',
        statusConfirmacaoCorretor: 'CONFIRMADO'
      });
    }
    if (statusAtual === 'RECUSADO') {
      return res.json({
        sucesso: true,
        mensagem: 'Você já registrou ausência/recusa anteriormente.',
        statusConfirmacaoCorretor: 'RECUSADO'
      });
    }
    if (statusAtual === 'REMANEJADO') {
      return res.json({
        sucesso: false,
        mensagem: 'Esta reunião já foi remanejada para outro corretor.',
        statusConfirmacaoCorretor: 'REMANEJADO'
      });
    }

    const agora = new Date();
    const cutoff = atividade.agendadoPara
      ? new Date(new Date(atividade.agendadoPara).getTime() - 60 * 60 * 1000)
      : null;

    if (acao === 'confirmar') {
      if (cutoff && agora > cutoff) {
        await prisma.atividade.update({
          where: { id: atividadeId },
          data: {
            expiradoCorretorEm: (atividade as any).expiradoCorretorEm || agora,
          }
        });
        return res.json({
          sucesso: false,
          mensagem: 'Confirmação fora do prazo de corte (T-60). A reunião pode já ter sido remanejada.',
          statusConfirmacaoCorretor: statusAtual
        });
      }

      await prisma.atividade.update({
        where: { id: atividadeId },
        data: {
          statusConfirmacaoCorretor: 'CONFIRMADO',
          confirmadoCorretorEm: agora
        } as any
      });

      ServicoAuditoria.registrar({
        tenantId: atividade.lead.tenantId,
        acao: 'CONFIRMACAO_CORRETOR',
        entidade: 'Atividade',
        entidadeId: atividadeId,
        ip: req.socket.remoteAddress || '0.0.0.0',
        detalhes: {
          tipo: 'confirmar',
          statusAnterior: statusAtual,
        }
      });

      return res.json({
        sucesso: true,
        mensagem: 'Presença confirmada com sucesso.',
        statusConfirmacaoCorretor: 'CONFIRMADO'
      });
    }

    await prisma.atividade.update({
      where: { id: atividadeId },
      data: {
        statusConfirmacaoCorretor: 'RECUSADO',
        motivoCancelamento: motivoRecusa || (atividade as any).motivoCancelamento || 'Recusa/Ausência do corretor'
      } as any
    });

    ServicoAuditoria.registrar({
      tenantId: atividade.lead.tenantId,
      acao: 'RECUSA_CORRETOR',
      entidade: 'Atividade',
      entidadeId: atividadeId,
      ip: req.socket.remoteAddress || '0.0.0.0',
      detalhes: {
        tipo: acao,
        statusAnterior: statusAtual,
        motivo: motivoRecusa || 'não informado'
      }
    });

    return res.json({
      sucesso: true,
      mensagem: 'Ausência/recusa registrada. O sistema poderá remanejar automaticamente.',
      statusConfirmacaoCorretor: 'RECUSADO'
    });
  } catch (error) {
    console.error('Erro ao processar confirmação do corretor:', error);
    responderErro(res, 500, 'Erro interno');
  }
});

// ============================================================
// CONTROLE DE MODO — ChatPanel (Mission Control)
// ============================================================

/**
 * GET /api/leads/:id/modo
 * Retorna o modo de atendimento atual do contato vinculado ao lead.
 */
router.get('/:id/modo', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Não autorizado');

    const lead = await withTenantDb(tenantId, (tx) => tx.lead.findFirst({
      where: { id: req.params.id },
      select: { modoAtendimento: true, id: true },
    }));

    res.json({
      modo: (lead as any)?.modoAtendimento || 'IA',
      contatoId: lead?.id || null,
    });
  } catch {
    responderErro(res, 500, 'Erro interno');
  }
});

/**
 * POST /api/leads/:id/controle-modo
 * Body: { modo: 'IA' | 'HUMANO' | 'PAUSADO' }
 * Alterna o modo de atendimento do contato: IA ativa, humano ou pausado.
 */
router.post('/:id/controle-modo', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Não autorizado');

    const { modo } = req.body;
    if (!['IA', 'HUMANO', 'PAUSADO'].includes(modo)) {
      return responderErro(res, 400, 'modo deve ser IA, HUMANO ou PAUSADO');
    }

    const lead = await withTenantDb(tenantId, async (tx) => {
      const encontrado = await tx.lead.findFirst({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (encontrado) {
        await tx.lead.update({
          where: { id: encontrado.id },
          data: { modoAtendimento: modo },
        });
      }
      return encontrado;
    });

    if (!lead) return responderErro(res, 404, 'Lead não encontrado');

    res.json({ sucesso: true, modo });
  } catch {
    responderErro(res, 500, 'Erro interno');
  }
});

/**
 * POST /api/leads/:id/retomar-ia
 * Devolve o atendimento para a IA (modoAtendimento='IA') sem precisar chamar controle-modo.
 */
router.post('/:id/retomar-ia', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Não autorizado');

    const lead = await withTenantDb(tenantId, async (tx) => {
      const encontrado = await tx.lead.findFirst({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (encontrado) {
        await tx.lead.update({
          where: { id: encontrado.id },
          data: { modoAtendimento: 'IA' },
        });
      }
      return encontrado;
    });

    if (!lead) return responderErro(res, 404, 'Lead não encontrado');

    res.json({ sucesso: true, modo: 'IA' });
  } catch {
    responderErro(res, 500, 'Erro interno');
  }
});

/**
 * POST /api/leads/:id/followup
 * Body: { mensagem: string, dataEnvio: string (ISO datetime) }
 * Agenda uma mensagem customizada para envio automático na data/hora especificada.
 * O job recontato-automatico.ts dispara a mensagem quando dataRecontato <= agora.
 */
router.get('/:id/followup/ativo', async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return responderErro(res, 401, 'Não autorizado');
  const followup = await prisma.followupOutbound.findFirst({
    where: { tenantId, leadId: req.params.id, OR: [
      { status: { in: ['PENDENTE', 'REIVINDICADO'] } },
      { status: 'FALHO', OR: [
        { proximoRetryEm: { not: null } },
        { reasonCode: { in: ['DELIVERY_UNKNOWN', 'DELIVERY_RECONCILIATION_REQUIRED'] } },
      ] },
    ] },
    orderBy: { criadoEm: 'desc' },
  });
  if (!followup) return res.json({ followup: null });
  return res.json({ followup: {
    id: followup.id, mensagem: followup.mensagemEnvio, timezoneIana: followup.timezoneIana,
    dataLocal: formatInTimeZone(followup.agendadoParaUtc, followup.timezoneIana, "yyyy-MM-dd'T'HH:mm"),
    status: followup.status, reasonCode: followup.reasonCode,
  } });
});

router.post('/:id/followup', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Não autorizado');

    const { mensagem, dataEnvio, timezoneIana, motivo, followupId, requestId } = req.body;
    if (!mensagem?.trim() || !dataEnvio || !timezoneIana || !motivo?.trim() || typeof requestId !== 'string' || !requestId.trim()) return responderErro(res, 400, 'mensagem, dataEnvio, timezoneIana, motivo e requestId são obrigatórios');
    const params = { tenantId, leadId: req.params.id, expressaoOriginal: dataEnvio,
      timezoneIana, motivo, mensagemEnvio: mensagem, evidenciaPedido: 'OPERADOR_AUTENTICADO_CHAT_PANEL', origemPedido: 'API_LEADS_FOLLOWUP',
      requestIdentity: { source: 'MANUAL_API' as const, id: requestId } };
    const result = followupId
      ? await reagendarFollowupOutbound({ ...params, followupId })
      : await criarFollowupOutbound(params);
    if (!result.success) return responderErro(res, 422, result.reasonCode || 'FOLLOWUP_REJECTED');

    res.json({
      sucesso: true,
      followupId: result.followup.id,
      dataRecontato: result.followup.agendadoParaUtc.toISOString(),
      deduplicado: result.deduplicado,
      reasonCode: 'reasonCode' in result ? result.reasonCode : undefined,
      requestOutcome: 'requestOutcome' in result ? result.requestOutcome : undefined,
    });
  } catch {
    responderErro(res, 500, 'Erro interno');
  }
});

export default router;
