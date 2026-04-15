/**
 * Serviço de Priorização de Leads — Mission Control
 *
 * Calcula a urgência operacional de cada lead e retorna ranqueado.
 * Não altera nenhum dado; é somente leitura.
 *
 * v2.0 — Query enriquecida com todos os campos do schema.
 */

import { prisma } from '../lib/db';

// ============================================
// TIPOS COMPLETOS (alinhados com GET /leads/:id)
// ============================================

export type CategoriaUrgencia = 'URGENTE' | 'ATENCAO' | 'IA_ATIVA' | 'SEM_ACAO';

export interface AtividadePriorizado {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  agendadoPara: Date | null;
  completadoEm: Date | null;
  statusAgendamento: string | null;
  criadoEm: Date;
}

export interface LeadPriorizado {
  id: string;
  nome: string | null;
  telefone: string | null;
  telefone2: string | null;
  telefone3: string | null;
  email: string | null;
  email2: string | null;
  cpf: string | null;
  status: string;
  temperatura: string | null;
  origem: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  primeiroContato: Date | null;
  ultimaInteracao: Date | null;
  briefingCloser: string | null;

  // Campanha origem
  campanhaOrigem: { id: string; nome: string } | null;

  // ── Imóvel flat ──
  enderecoImovel: string | null;
  tipoImovel: string | null;
  areaImovel: string | null;
  quartosImovel: number | null;
  vagasImovel: number | null;
  valorPretendido: string | null;
  ocupacaoImovel: string | null;
  interesseEm: string | null;
  bairroImovel: string | null;
  nomeEdificio: string | null;
  inscricaoIptu: string | null;
  valorVenal: string | null;

  // ── SPIN Qualificação ──
  situacaoAtual: string | null;
  tempoDecisao: string | null;
  tentativasAnteriores: string | null;
  comCorretorAtualmente: boolean | null;
  motivacaoVenda: string | null;
  doresIdentificadas: string[];
  prazoDesejado: string | null;
  urgenciaEnum: string | null;
  consequencias: string | null;
  custosAtuais: string | null;
  pressaoTempo: boolean | null;
  expectativaServico: string | null;
  objecoes: string[];
  interesseAvaliacao: boolean | null;
  observacoesSpin: string | null;

  // ── Fase 2 — Qualificação adicional ──
  situacaoFinanceira: string | null;
  temDividas: boolean | null;
  estadoConservacao: string | null;

  // ── Fase 3 — Negociação ──
  comissaoAcordada: string | null;
  tipoAutorizacao: string | null;
  prazoTrabalho: number | null;
  autorizouAnuncio: boolean | null;

  // ── Contato/Pessoa ──
  idade: number | null;
  sexo: string | null;
  rendaEstimada: string | null;
  faixaSalarial: string | null;
  scoreAssertiva: number | null;
  profissao: string | null;
  empresaAtual: string | null;

  // ── Tracking IA ──
  ultimaAcaoIA: string | null;
  ultimaAcaoIAEm: Date | null;

  // ── Calculados ──
  urgencia: number;
  categoriaUrgencia: CategoriaUrgencia;
  motivoUrgencia: string;
  resumoIA: string;

  // ── Atividades ──
  proximaAtividade: AtividadePriorizado | null;
  atividades: AtividadePriorizado[];

  // ── Métricas ──
  totalMensagens: number;
  horasSemResposta: number | null;
  faseSPIN: string | null;
}

export interface EstatisticasPriorizadas {
  total: number;
  quentes: number;
  mornos: number;
  frios: number;
  agendamentosHoje: number;
  novosHoje: number;
  iaAtiva: number;
}

export interface PipelineResumo {
  qualificacao: number;
  apresentacao: number;
  documentacao: number;
  onboarding: number;
}

export interface ResultadoPriorizacao {
  leads: LeadPriorizado[];
  estatisticas: EstatisticasPriorizadas;
  pipeline: PipelineResumo;
}

// ============================================
// MAPEAMENTO STATUS → FASE
// ============================================

function getFasePipeline(status: string): keyof PipelineResumo | null {
  if (['NOVO', 'QUALIFICADO'].includes(status)) return 'qualificacao';
  if (['TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA', 'CONTATANDO'].includes(status)) return 'apresentacao';
  if (['AVALIACAO_EM_ANDAMENTO', 'DOCUMENTACAO', 'EM_NEGOCIACAO'].includes(status)) return 'documentacao';
  if (['ONBOARDING'].includes(status)) return 'onboarding';
  return null;
}

// ============================================
// CÁLCULO DE URGÊNCIA
// ============================================

function calcularUrgencia(
  lead: any,
  agora: number
): { pontos: number; categoria: CategoriaUrgencia; motivo: string } {
  let pontos = 0;
  const motivos: string[] = [];

  // Temperatura (+30/+20/+5)
  if (lead.temperatura === 'QUENTE') {
    pontos += 30;
    motivos.push('Lead quente');
  } else if (lead.temperatura === 'MORNO') {
    pontos += 20;
    motivos.push('Lead morno');
  } else {
    pontos += 5;
  }

  // Agendamento nas próximas 24h (+25)
  if (lead.proximaAtividadeData) {
    const horasAteAgendamento =
      (new Date(lead.proximaAtividadeData).getTime() - agora) / (1000 * 60 * 60);
    if (horasAteAgendamento > 0 && horasAteAgendamento <= 24) {
      pontos += 25;
      motivos.push(`Agendamento em ${Math.round(horasAteAgendamento)}h`);
    } else if (horasAteAgendamento < 0 && horasAteAgendamento > -24) {
      pontos += 15;
      motivos.push('Agendamento recente — confirmar resultado');
    }
  }

  // SLA: Sem resposta há X horas
  const horasSemResposta = lead.horasSemResposta;
  if (horasSemResposta !== null) {
    if (lead.temperatura === 'QUENTE' && horasSemResposta > 2) {
      pontos += 20;
      motivos.push(`Sem resposta há ${Math.round(horasSemResposta)}h (quente)`);
    } else if (horasSemResposta > 6) {
      pontos += 15;
      motivos.push(`Sem resposta há ${Math.round(horasSemResposta)}h`);
    }
  }

  // Lead novo recente (+10)
  const horasCriacao = (agora - new Date(lead.criadoEm).getTime()) / (1000 * 60 * 60);
  if (horasCriacao < 24 && lead.status === 'NOVO') {
    pontos += 10;
    motivos.push('Lead novo — priorizar primeiro contato');
  }

  // Urgência SPIN declarada (+10 para ALTA)
  if (lead.urgenciaEnum === 'ALTA') {
    pontos += 10;
    motivos.push('Urgência declarada: ALTA');
  } else if (lead.urgenciaEnum === 'MEDIA') {
    pontos += 5;
  }

  // Pressão de tempo declarada (+8)
  if (lead.pressaoTempo === true) {
    pontos += 8;
    motivos.push('Lead com pressão de tempo');
  }

  // IA processando agora (-20)
  if (lead.ultimaAcaoIAEm) {
    const minutosDesdeIA = (agora - new Date(lead.ultimaAcaoIAEm).getTime()) / (1000 * 60);
    if (minutosDesdeIA < 5) {
      pontos -= 20;
      motivos.push('IA processando agora');
    }
  }

  // Leads finalizados (-30)
  if (['PERDIDO', 'ARQUIVADO', 'CAPTADO', 'CONVERTIDO', 'INATIVO'].includes(lead.status)) {
    pontos -= 30;
  }

  pontos = Math.max(0, Math.min(100, pontos));

  // Categorizar
  let categoria: CategoriaUrgencia;
  if (lead.ultimaAcaoIAEm) {
    const minutosDesdeIA = (agora - new Date(lead.ultimaAcaoIAEm).getTime()) / (1000 * 60);
    if (minutosDesdeIA < 5) {
      categoria = 'IA_ATIVA';
    } else if (pontos >= 50) {
      categoria = 'URGENTE';
    } else if (pontos >= 25) {
      categoria = 'ATENCAO';
    } else {
      categoria = 'SEM_ACAO';
    }
  } else if (pontos >= 50) {
    categoria = 'URGENTE';
  } else if (pontos >= 25) {
    categoria = 'ATENCAO';
  } else {
    categoria = 'SEM_ACAO';
  }

  return {
    pontos,
    categoria,
    motivo: motivos.length > 0 ? motivos[0] : 'Em acompanhamento',
  };
}

// ============================================
// GERAÇÃO DE RESUMO IA (template rico, sem LLM)
// ============================================

function gerarResumoIA(lead: any): string {
  const partes: string[] = [];

  // Interesse + tipo + endereço
  if (lead.interesseEm) {
    const tipo = lead.tipoImovel ? ` ${lead.tipoImovel}` : '';
    const endereco = lead.enderecoImovel
      ? ` em ${lead.enderecoImovel}`
      : lead.bairroImovel
      ? ` no bairro ${lead.bairroImovel}`
      : '';
    partes.push(`Interesse em ${lead.interesseEm.toLowerCase()}${tipo}${endereco}`);
  }

  // Valor pretendido (campo String no schema)
  if (lead.valorPretendido) {
    partes.push(`Valor pretendido: ${String(lead.valorPretendido).trim()}`);
  }

  // Motivação da venda (SPIN - Problema)
  if (lead.motivacaoVenda) {
    partes.push(`Motivação: ${lead.motivacaoVenda}`);
  }

  // Situação atual (SPIN - Situação)
  if (lead.situacaoAtual && partes.length < 3) {
    partes.push(`Situação: ${lead.situacaoAtual}`);
  }

  // Prazo + pressão (SPIN - Implicação)
  if (lead.prazoDesejado) {
    partes.push(`Prazo: ${lead.prazoDesejado}`);
  } else if (lead.pressaoTempo && partes.length < 4) {
    partes.push('Com pressão de tempo');
  }

  // Dores identificadas
  const dores = lead.doresIdentificadas || [];
  if (dores.length > 0 && partes.length < 4) {
    partes.push(`Dores: ${dores.slice(0, 2).join(', ')}`);
  }

  // Objeções
  const objecoes = lead.objecoes || [];
  if (objecoes.length > 0 && partes.length < 5) {
    partes.push(`Objeção: ${objecoes[0]}`);
  }

  // Expectativa de serviço
  if (lead.expectativaServico && partes.length < 5) {
    partes.push(`Expectativa: ${lead.expectativaServico}`);
  }

  // Briefing como fallback final
  if (partes.length === 0 && lead.briefingCloser) {
    const linhas = lead.briefingCloser
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 10 && !/^[#🏠🔥💢🎯📋⚡💰🚨🤝👤]/.test(l));
    if (linhas.length > 0) {
      return linhas[0].slice(0, 160);
    }
  }

  if (partes.length === 0) {
    return 'Lead em qualificação. Aguardando mais informações da conversa.';
  }

  return partes.join('. ').slice(0, 250);
}

// ============================================
// SERVIÇO PRINCIPAL
// ============================================

export async function priorizarLeads(
  tenantId: string,
  limite: number = 50
): Promise<ResultadoPriorizacao> {
  const agora = Date.now();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const leads = await prisma.lead.findMany({
    where: {
      tenantId,
      status: { notIn: ['ARQUIVADO', 'PERDIDO', 'CAPTADO', 'CONVERTIDO', 'INATIVO'] },
    },
    orderBy: { criadoEm: 'desc' },
    take: 500,
    // ── Includes enriquecidos ──
    include: {
      campanhaOrigem: {
        select: { id: true, nome: true },
      },
      atividades: {
        where: { statusAgendamento: { not: 'CANCELADO' } },
        orderBy: { agendadoPara: 'asc' },
        take: 5,
        select: {
          id: true,
          tipo: true,
          titulo: true,
          descricao: true,
          agendadoPara: true,
          completadoEm: true,
          statusAgendamento: true,
          criadoEm: true,
        },
      },
      conversas: {
        orderBy: { ultimaMensagemEm: 'desc' },
        take: 1,
        select: {
          faseSPIN: true,
          _count: { select: { mensagens: true } },
          mensagens: {
            orderBy: { enviadaEm: 'desc' },
            take: 1,
            select: { enviadaEm: true, remetente: true },
          },
        },
      },
    },
  });

  // ── Estatísticas + Pipeline ──
  const estatisticas: EstatisticasPriorizadas = {
    total: leads.length,
    quentes: 0,
    mornos: 0,
    frios: 0,
    agendamentosHoje: 0,
    novosHoje: 0,
    iaAtiva: 0,
  };

  const pipeline: PipelineResumo = {
    qualificacao: 0,
    apresentacao: 0,
    documentacao: 0,
    onboarding: 0,
  };

  const leadsPriorizados: LeadPriorizado[] = leads.map((lead: any) => {
    // Estatísticas por temperatura
    if (lead.temperatura === 'QUENTE') estatisticas.quentes++;
    else if (lead.temperatura === 'MORNO') estatisticas.mornos++;
    else estatisticas.frios++;

    // Novos hoje
    if (lead.criadoEm >= hoje && lead.criadoEm < amanha) estatisticas.novosHoje++;

    // Pipeline
    const fase = getFasePipeline(lead.status);
    if (fase) pipeline[fase]++;

    // ── Atividades ──
    const atividadesFormatadas: AtividadePriorizado[] = (lead.atividades || []).map((a: any) => ({
      id: a.id,
      tipo: a.tipo,
      titulo: a.titulo,
      descricao: a.descricao,
      agendadoPara: a.agendadoPara,
      completadoEm: a.completadoEm,
      statusAgendamento: a.statusAgendamento,
      criadoEm: a.criadoEm,
    }));

    // Próxima atividade = primeira pendente (sem completadoEm)
    const proximaAtividade =
      atividadesFormatadas.find((a) => !a.completadoEm && a.agendadoPara) || null;
    const proximaAtividadeData = proximaAtividade?.agendadoPara || null;

    // Agendamentos hoje
    if (proximaAtividadeData) {
      const dataAtividade = new Date(proximaAtividadeData);
      if (dataAtividade >= hoje && dataAtividade < amanha) {
        estatisticas.agendamentosHoje++;
      }
    }

    // ── Conversa / Mensagens ──
    const ultimaConversa = lead.conversas[0] || null;

    // Total de mensagens via _count (correto)
    const totalMensagens = ultimaConversa?._count?.mensagens ?? 0;

    // Horas sem resposta — valores reais: 'usuario' | 'cliente' | 'assistente' | 'sistema'
    let horasSemResposta: number | null = null;
    if (ultimaConversa?.mensagens?.length > 0) {
      const ultimaMsg = ultimaConversa.mensagens[0];
      const remetente = String(ultimaMsg.remetente || '').toLowerCase();
      if (remetente === 'usuario' || remetente === 'cliente') {
        horasSemResposta = (agora - new Date(ultimaMsg.enviadaEm).getTime()) / (1000 * 60 * 60);
      }
    }

    // IA ativa
    if (lead.ultimaAcaoIAEm) {
      const minutosDesdeIA = (agora - new Date(lead.ultimaAcaoIAEm).getTime()) / (1000 * 60);
      if (minutosDesdeIA < 5) estatisticas.iaAtiva++;
    }

    // ── Score de urgência ──
    const { pontos, categoria, motivo } = calcularUrgencia(
      {
        ...lead,
        proximaAtividadeData,
        horasSemResposta,
        urgenciaEnum: lead.urgencia, // enum do schema (BAIXA/MEDIA/ALTA)
      },
      agora
    );

    return {
      // Identificação
      id: lead.id,
      nome: lead.nome,
      telefone: lead.telefone,
      telefone2: lead.telefone2 ?? null,
      telefone3: lead.telefone3 ?? null,
      email: lead.email,
      email2: lead.email2 ?? null,
      cpf: lead.cpf ?? null,
      status: lead.status,
      temperatura: lead.temperatura,
      origem: lead.origem,
      criadoEm: lead.criadoEm,
      atualizadoEm: lead.atualizadoEm,
      primeiroContato: lead.primeiroContato,
      ultimaInteracao: lead.ultimaInteracao,
      briefingCloser: lead.briefingCloser ?? null,

      // Campanha
      campanhaOrigem: lead.campanhaOrigem
        ? { id: lead.campanhaOrigem.id, nome: lead.campanhaOrigem.nome }
        : null,

      // Imóvel flat (todos os campos)
      enderecoImovel: lead.enderecoImovel ?? null,
      tipoImovel: lead.tipoImovel ?? null,
      areaImovel: lead.areaImovel ?? null,
      quartosImovel: lead.quartosImovel ?? null,
      vagasImovel: lead.vagasImovel ?? null,
      valorPretendido: lead.valorPretendido ?? null,
      ocupacaoImovel: lead.ocupacaoImovel ?? null,
      interesseEm: lead.interesseEm ?? null,
      bairroImovel: lead.bairroImovel ?? null,
      nomeEdificio: lead.nomeEdificio ?? null,
      inscricaoIptu: lead.inscricaoIptu ?? null,
      valorVenal: lead.valorVenal ?? null,

      // SPIN completo
      situacaoAtual: lead.situacaoAtual ?? null,
      tempoDecisao: lead.tempoDecisao ?? null,
      tentativasAnteriores: lead.tentativasAnteriores ?? null,
      comCorretorAtualmente: lead.comCorretorAtualmente ?? null,
      motivacaoVenda: lead.motivacaoVenda ?? null,
      doresIdentificadas: lead.doresIdentificadas || [],
      prazoDesejado: lead.prazoDesejado ?? null,
      urgenciaEnum: lead.urgencia ?? null,
      consequencias: lead.consequencias ?? null,
      custosAtuais: lead.custosAtuais ?? null,
      pressaoTempo: lead.pressaoTempo ?? null,
      expectativaServico: lead.expectativaServico ?? null,
      objecoes: lead.objecoes || [],
      interesseAvaliacao: lead.interesseAvaliacao ?? null,
      observacoesSpin: lead.observacoesSpin ?? null,

      // Qualificação adicional (Fase 2)
      situacaoFinanceira: lead.situacaoFinanceira ?? null,
      temDividas: lead.temDividas ?? null,
      estadoConservacao: lead.estadoConservacao ?? null,

      // Negociação (Fase 3)
      comissaoAcordada: lead.comissaoAcordada ?? null,
      tipoAutorizacao: lead.tipoAutorizacao ?? null,
      prazoTrabalho: lead.prazoTrabalho ?? null,
      autorizouAnuncio: lead.autorizouAnuncio ?? null,

      // Contato/Pessoa
      idade: lead.idade ?? null,
      sexo: lead.sexo ?? null,
      rendaEstimada: lead.rendaEstimada ?? null,
      faixaSalarial: lead.faixaSalarial ?? null,
      scoreAssertiva: lead.scoreAssertiva ?? null,
      profissao: lead.profissao ?? null,
      empresaAtual: lead.empresaAtual ?? null,

      // Tracking IA
      ultimaAcaoIA: lead.ultimaAcaoIA ?? null,
      ultimaAcaoIAEm: lead.ultimaAcaoIAEm ?? null,

      // Calculados
      urgencia: pontos,
      categoriaUrgencia: categoria,
      motivoUrgencia: motivo,
      resumoIA: gerarResumoIA(lead),

      // Atividades (até 5)
      proximaAtividade,
      atividades: atividadesFormatadas,

      // Métricas
      totalMensagens,
      horasSemResposta,
      faseSPIN: ultimaConversa?.faseSPIN ?? null,
    };
  });

  // Ordenar por urgência (maior primeiro)
  leadsPriorizados.sort((a, b) => b.urgencia - a.urgencia);

  return {
    leads: leadsPriorizados.slice(0, limite),
    estatisticas,
    pipeline,
  };
}
