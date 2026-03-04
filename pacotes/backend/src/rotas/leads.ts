import { Router, Request } from 'express';
import { prisma } from '../lib/db';
import crypto from 'crypto';
import { getTenantId } from '../utils/tenant';
import { cascadeDeleteLeads } from '../utils/cascade-delete';

const router = Router();

// Workaround: Prisma Client com cache antigo após db push
// Os campos existem no banco, mas TypeScript não reconhece ainda
// TODO: Remover após rebuild completo
const db = prisma as any;

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

// GET /api/leads - Retorna leads ativos (não arquivados) do tenant
router.get('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado - tenant não identificado' });
    }

    const { busca } = req.query;

    // Base: leads ativos DO TENANT (excluir arquivados e perdidos)
    const baseWhere: any = {
      tenantId, // ✅ FILTRO DE SEGURANÇA
      status: { notIn: ['ARQUIVADO', 'PERDIDO', 'CAPTADO', 'CONVERTIDO', 'INATIVO'] }
    };

    // Se tiver busca, adicionar filtros de busca
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

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      include: {
        campanhaOrigem: true,
        conversas: {
          orderBy: { iniciadaEm: 'desc' },
          take: 1
        },
        atividades: {
          orderBy: { criadoEm: 'desc' },
          take: 1
        }
      }
    });

    // Formatar para o frontend
    const leadsFormatados = leads.map(lead => {
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
        campanhaOrigem: lead.campanhaOrigem?.nome || null, // Badge campanha
        ultimaInteracao
      };
    });

    res.json(leadsFormatados);
  } catch (error) {
    console.error('Erro ao listar leads:', error);
    res.status(500).json({ erro: 'Erro interno ao listar leads' });
  }
});

// POST /api/leads - Criar lead manual
router.post('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado - tenant não identificado' });
    }

    const { nome, telefone, email, cpf } = req.body;

    const nomeNormalizado = String(nome || '').trim();
    const telefoneNormalizado = normalizarTelefone(telefone);
    const emailNormalizado = normalizarEmail(email);
    const cpfNormalizado = normalizarCpf(cpf);

    if (!nomeNormalizado) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    if (!telefoneNormalizado && !emailNormalizado) {
      return res.status(400).json({ error: 'Informe ao menos telefone ou email para cadastro do lead' });
    }

    // Verificar se tenant existe
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant não encontrado' });
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
        return res.status(409).json({
          erro: 'Lead já cadastrado com dados semelhantes',
          leadExistente
        });
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
    res.status(500).json({ error: 'Erro ao criar lead', details: error.message });
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
      return res.status(401).json({ erro: 'Não autorizado - tenant não identificado' });
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
      db.lead.count({
        where: {
          tenantId, // ✅ FILTRO
          status: { notIn: ['ARQUIVADO', 'CAPTADO', 'CONVERTIDO', 'PERDIDO', 'INATIVO'] }
        }
      }),

      // Leads quentes do tenant
      db.lead.count({
        where: {
          tenantId, // ✅ FILTRO
          temperatura: 'QUENTE',
          status: { notIn: ['PERDIDO', 'CAPTADO', 'CONVERTIDO', 'INATIVO'] }
        }
      }),

      // Novos hoje do tenant (exceto arquivados)
      db.lead.count({
        where: {
          tenantId, // ✅ FILTRO
          status: { notIn: ['ARQUIVADO', 'CAPTADO', 'CONVERTIDO', 'PERDIDO', 'INATIVO'] }, // ✅ Excluir arquivados e clientes
          criadoEm: { gte: hoje, lt: amanha }
        }
      }),

      // Por status do tenant
      db.lead.groupBy({
        by: ['status'],
        _count: true,
        where: { tenantId } // ✅ FILTRO
      }),

      // Por temperatura do tenant
      db.lead.groupBy({
        by: ['temperatura'],
        _count: true,
        where: {
          tenantId, // ✅ FILTRO
          status: { notIn: ['PERDIDO', 'CAPTADO', 'CONVERTIDO', 'INATIVO'] }
        }
      }),

      // Avaliações hoje (via lead do tenant)
      db.atividade.count({
        where: {
          lead: { tenantId }, // ✅ FILTRO via relacionamento
          tipo: 'AVALIACAO',
          agendadoPara: { gte: hoje, lt: amanha },
          completadoEm: null
        }
      }),

      // Aguardando confirmação (via lead do tenant)
      db.atividade.count({
        where: {
          lead: { tenantId }, // ✅ FILTRO via relacionamento
          statusAgendamento: 'PENDENTE',
          agendadoPara: { gte: hoje }
        }
      }),

      // Agendamentos hoje (via lead do tenant)
      db.atividade.count({
        where: {
          lead: { tenantId }, // ✅ FILTRO via relacionamento
          agendadoPara: { gte: hoje, lt: amanha },
          completadoEm: null,
          statusAgendamento: { not: 'CANCELADO' }
        }
      })
    ]);

    // Próximas avaliações do tenant
    const proximasAvaliacoes = await db.atividade.findMany({
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
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ============================================
// GET /api/leads/:id - Detalhes completos do lead
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado - tenant não identificado' });
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
      return res.status(404).json({ erro: 'Lead não encontrado' });
    }

    // ✅ Verificar se lead pertence ao tenant
    if (lead.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    // Cast para any temporário (Prisma Client ainda com cache antigo)
    const l: any = lead;

    // Formatar resposta estruturada
    const resposta = {
      // Dados básicos
      id: l.id,
      nome: l.nome,
      telefone: l.telefone,
      email: l.email,
      cpf: l.cpf,
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
        criadoEm: atividade.criadoEm
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
      ) || null
    };

    res.json(resposta);
  } catch (error) {
    console.error('Erro ao buscar lead:', error);
    res.status(500).json({ erro: 'Erro interno ao buscar lead' });
  }
});

// ============================================
// PATCH /api/leads/:id - Atualizar lead
// ============================================
router.patch('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado - tenant não identificado' });
    }

    const { id } = req.params;
    const dados = req.body;

    // Verificar se lead existe
    const leadExiste = await prisma.lead.findUnique({ where: { id } });
    if (!leadExiste) {
      return res.status(404).json({ erro: 'Lead não encontrado' });
    }

    // ✅ Verificar ownership
    if (leadExiste.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const camposPermitidos = [
      // Básicos
      'nome', 'telefone', 'email', 'status', 'temperatura',
      // Imóvel
      'enderecoImovel', 'tipoImovel', 'areaImovel', 'quartosImovel',
      'vagasImovel', 'valorPretendido', 'ocupacaoImovel', 'interesseEm',
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
    res.status(500).json({ erro: 'Erro interno ao atualizar lead' });
  }
});

// ============================================
// DELETE /api/leads/:id - Exclusão permanente
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado - tenant não identificado' });
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
      return res.status(404).json({ erro: 'Lead não encontrado' });
    }

    // ✅ Verificar ownership
    if (lead.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado' });
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
    res.status(500).json({ erro: 'Erro interno ao excluir lead' });
  }
});

// ============================================
// POST /api/leads/:id/restaurar - Restaurar lead arquivado
// ============================================
router.post('/:id/restaurar', async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ erro: 'Lead não encontrado' });
    }

    await prisma.lead.update({
      where: { id },
      data: {
        deletadoEm: null,
        status: 'QUALIFICADO'
      }
    });

    await db.atividade.create({
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
    res.status(500).json({ erro: 'Erro interno ao restaurar lead' });
  }
});

// ============================================
// POST /api/leads/:id/perder - Marcar como perdido
// ============================================
router.post('/:id/perder', async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo, observacoes } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ erro: 'Lead não encontrado' });
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
    await db.atividade.create({
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
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ============================================
// POST /api/leads/:id/captar - Marcar como captado (sucesso!)
// ============================================
router.post('/:id/captar', async (req, res) => {
  try {
    const { id } = req.params;
    const { tipoContrato, valorContrato, observacoes } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ erro: 'Lead não encontrado' });
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
    await db.atividade.create({
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
    res.status(500).json({ erro: 'Erro interno' });
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
      return res.status(404).json({ erro: 'Lead não encontrado' });
    }

    await prisma.lead.update({
      where: { id },
      data: {
        status: 'QUALIFICADO',
        temperatura: temperatura || 'MORNO',
        deletadoEm: null,
        ultimaInteracao: new Date()
      }
    });

    await db.atividade.create({
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
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ============================================
// PATCH /api/leads/:id/atividades/:atividadeId - Atualizar atividade
// ============================================
router.patch('/:id/atividades/:atividadeId', async (req, res) => {
  try {
    const { id, atividadeId } = req.params;
    const { acao, observacao, novaData } = req.body;

    const atividade = await db.atividade.findFirst({
      where: { id: atividadeId, leadId: id }
    });

    if (!atividade) {
      return res.status(404).json({ erro: 'Atividade não encontrada' });
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

      case 'cancelar':
        dadosAtualizacao = {
          statusAgendamento: 'CANCELADO',
          canceladoPor: 'corretor',
          canceladoEm: new Date(),
          motivoCancelamento: observacao || 'Cancelado pelo corretor'
        };
        mensagem = 'Atividade cancelada';
        break;

      case 'reagendar':
        if (!novaData) {
          return res.status(400).json({ erro: 'Nova data é obrigatória para reagendar' });
        }
        dadosAtualizacao = {
          agendadoPara: new Date(novaData),
          statusAgendamento: 'PENDENTE',
          confirmadoPor: null,
          confirmadoEm: null
        };
        mensagem = 'Atividade reagendada';
        break;

      case 'nao_compareceu':
        dadosAtualizacao = {
          statusAgendamento: 'NAO_COMPARECEU',
          completadoEm: new Date()
        };
        mensagem = 'Marcado como não compareceu';
        break;

      default:
        return res.status(400).json({ erro: 'Ação inválida' });
    }

    await db.atividade.update({
      where: { id: atividadeId },
      data: dadosAtualizacao
    });

    res.json({ sucesso: true, mensagem });
  } catch (error) {
    console.error('Erro ao atualizar atividade:', error);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ============================================
// DELETE /api/leads/:id/atividades/:atividadeId - Deletar atividade
// ============================================
router.delete('/:id/atividades/:atividadeId', async (req, res) => {
  try {
    const { id, atividadeId } = req.params;

    const atividade = await db.atividade.findFirst({
      where: { id: atividadeId, leadId: id }
    });

    if (!atividade) {
      return res.status(404).json({ erro: 'Atividade não encontrada' });
    }

    await db.atividade.delete({
      where: { id: atividadeId }
    });

    res.json({ sucesso: true, mensagem: 'Atividade removida' });
  } catch (error) {
    console.error('Erro ao deletar atividade:', error);
    res.status(500).json({ erro: 'Erro interno' });
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
    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ erro: 'Lead não encontrado' });
    }

    // Gerar token de confirmação se for agendamento
    const tokenConfirmacao = tipo === 'AVALIACAO' || tipo === 'TAREFA' || tipo === 'REUNIAO'
      ? crypto.randomUUID()
      : null;

    const atividade = await db.atividade.create({
      data: {
        leadId: id,
        tipo: tipo || 'TAREFA',
        titulo: titulo || 'Nova atividade',
        descricao,
        agendadoPara: agendadoPara ? new Date(agendadoPara) : null,
        statusAgendamento: agendadoPara ? 'PENDENTE' : null,
        tokenConfirmacao,
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
    res.status(500).json({ erro: 'Erro interno ao criar atividade' });
  }
});

// ============================================
// GET /api/leads/confirmar/:atividadeId/:token - Validar token (PÚBLICO)
// ============================================
router.get('/confirmar/:atividadeId/:token', async (req, res) => {
  try {
    const { atividadeId, token } = req.params;

    const atividade = await db.atividade.findFirst({
      where: {
        id: atividadeId,
        tokenConfirmacao: token
      },
      include: {
        lead: true
      }
    });

    if (!atividade) {
      return res.status(404).json({
        erro: 'Link inválido ou expirado',
        valido: false
      });
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
    res.status(500).json({ erro: 'Erro interno' });
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
    const atividade = await db.atividade.findFirst({
      where: {
        id: atividadeId,
        tokenConfirmacao: token
      }
    });

    if (!atividade) {
      return res.status(404).json({
        erro: 'Link inválido ou expirado',
        sucesso: false
      });
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
      await db.atividade.update({
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
      await db.atividade.update({
        where: { id: atividadeId },
        data: {
          statusAgendamento: 'CANCELADO',
          canceladoPor: 'proprietario',
          canceladoEm: new Date(),
          motivoCancelamento: motivoCancelamento || 'Não informado'
        }
      });

      res.json({
        sucesso: true,
        mensagem: 'Agendamento cancelado. Entraremos em contato para remarcar.',
        statusAgendamento: 'CANCELADO'
      });
    } else {
      res.status(400).json({ erro: 'Ação inválida. Use "confirmar" ou "cancelar".' });
    }
  } catch (error) {
    console.error('Erro ao processar confirmação:', error);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

export default router;
