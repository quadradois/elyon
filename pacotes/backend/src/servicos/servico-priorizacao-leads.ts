/**
 * Serviço de Priorização de Leads — Mission Control
 *
 * Calcula a urgência operacional de cada lead e retorna ranqueado.
 * Não altera nenhum dado; é somente leitura.
 *
 * @version 1.0
 */

import { prisma } from '../lib/db';

// ============================================
// TIPOS
// ============================================

export type CategoriaUrgencia = 'URGENTE' | 'ATENCAO' | 'IA_ATIVA' | 'SEM_ACAO';

export interface LeadPriorizado {
  id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  status: string;
  temperatura: string | null;
  origem: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  primeiroContato: Date | null;
  ultimaInteracao: Date | null;
  briefingCloser: string | null;
  // Campos calculados
  urgencia: number;
  categoriaUrgencia: CategoriaUrgencia;
  motivoUrgencia: string;
  resumoIA: string;
  ultimaAcaoIA: string | null;
  ultimaAcaoIAEm: Date | null;
  // Dados auxiliares para o card
  proximaAtividade: {
    tipo: string;
    titulo: string;
    agendadoPara: Date | null;
  } | null;
  totalMensagens: number;
  horasSemResposta: number | null;
  interesseEm: string | null;
  tipoImovel: string | null;
  valorPretendido: number | null;
  enderecoImovel: string | null;
  doresIdentificadas: string[];
  objecoes: string[];
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

function calcularUrgencia(lead: any, agora: number): { pontos: number; categoria: CategoriaUrgencia; motivo: string } {
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
    const horasAteAgendamento = (new Date(lead.proximaAtividadeData).getTime() - agora) / (1000 * 60 * 60);
    if (horasAteAgendamento > 0 && horasAteAgendamento <= 24) {
      pontos += 25;
      motivos.push(`Agendamento em ${Math.round(horasAteAgendamento)}h`);
    } else if (horasAteAgendamento < 0 && horasAteAgendamento > -24) {
      pontos += 15;
      motivos.push('Agendamento recente — confirmar resultado');
    }
  }

  // SLA: Sem resposta há X horas (+20/+15)
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

  // Garantir range 0-100
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
// GERAÇÃO DE RESUMO IA (template, sem LLM)
// ============================================

function gerarResumoIA(lead: any): string {
  const partes: string[] = [];

  // Interesse
  if (lead.interesseEm) {
    const tipo = lead.tipoImovel ? ` ${lead.tipoImovel}` : '';
    const endereco = lead.enderecoImovel ? ` em ${lead.enderecoImovel}` : '';
    partes.push(`Interesse em ${lead.interesseEm.toLowerCase()}${tipo}${endereco}`);
  }

  // Valor — campo é String no schema (ex: "R$ 650.000", "entre 600-700k")
  if (lead.valorPretendido) {
    const valorStr = String(lead.valorPretendido).trim();
    partes.push(`Valor pretendido: ${valorStr}`);
  }

  // Dores
  const dores = lead.doresIdentificadas || [];
  if (dores.length > 0) {
    partes.push(`Dores: ${dores.slice(0, 2).join(', ')}`);
  }

  // Objeções
  const objecoes = lead.objecoes || [];
  if (objecoes.length > 0) {
    partes.push(`Objeção: ${objecoes[0]}`);
  }

  // Motivação
  if (lead.motivacaoVenda && partes.length < 3) {
    partes.push(`Motivação: ${lead.motivacaoVenda}`);
  }

  // Briefing como fallback
  if (partes.length === 0 && lead.briefingCloser) {
    const linhas = lead.briefingCloser
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 10 && !/^[#🏠🔥💢🎯📋⚡💰🚨🤝👤]/.test(l));
    if (linhas.length > 0) {
      return linhas[0].slice(0, 120);
    }
  }

  if (partes.length === 0) {
    return 'Lead em qualificação. Aguardando mais informações da conversa.';
  }

  return partes.join('. ').slice(0, 200);
}

// ============================================
// SERVIÇO PRINCIPAL
// ============================================

export async function priorizarLeads(tenantId: string, limite: number = 50): Promise<ResultadoPriorizacao> {
  const agora = Date.now();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  // Buscar leads ativos do tenant com dados necessários
  const leads = await prisma.lead.findMany({
    where: {
      tenantId,
      status: { notIn: ['ARQUIVADO', 'PERDIDO', 'CAPTADO', 'CONVERTIDO', 'INATIVO'] },
    },
    orderBy: { criadoEm: 'desc' },
    take: 500, // Buscar mais para priorizar, depois cortar
    include: {
      atividades: {
        where: {
          completadoEm: null,
          statusAgendamento: { not: 'CANCELADO' },
        },
        orderBy: { agendadoPara: 'asc' },
        take: 1,
      },
      conversas: {
        orderBy: { ultimaMensagemEm: 'desc' },
        take: 1,
        include: {
          mensagens: {
            orderBy: { enviadaEm: 'desc' },
            take: 1,
            select: { enviadaEm: true, remetente: true },
          },
        },
      },
    },
  });

  // Calcular estatísticas + pipeline
  // NOTA: total conta os leads da query (ativos). Para total geral, usar count separado.
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

  // Processar cada lead
  const leadsPriorizados: LeadPriorizado[] = leads.map((lead: any) => {
    // Estatísticas
    if (lead.temperatura === 'QUENTE') estatisticas.quentes++;
    else if (lead.temperatura === 'MORNO') estatisticas.mornos++;
    else estatisticas.frios++;

    if (lead.criadoEm >= hoje && lead.criadoEm < amanha) estatisticas.novosHoje++;

    // Pipeline
    const fase = getFasePipeline(lead.status);
    if (fase) pipeline[fase]++;

    // Próxima atividade
    const proxAtividade = lead.atividades[0] || null;
    const proximaAtividadeData = proxAtividade?.agendadoPara || null;

    if (proximaAtividadeData) {
      const dataAtividade = new Date(proximaAtividadeData);
      if (dataAtividade >= hoje && dataAtividade < amanha) {
        estatisticas.agendamentosHoje++;
      }
    }

    // Horas sem resposta (última mensagem do LEAD, não do assistente)
    // Valores reais do schema: 'usuario' (lead) | 'cliente' | 'assistente' | 'sistema'
    let horasSemResposta: number | null = null;
    const ultimaConversa = lead.conversas[0];
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

    // Total mensagens
    const totalMensagens = ultimaConversa?._count?.mensagens || ultimaConversa?.mensagens?.length || 0;

    // Calcular urgência
    const { pontos, categoria, motivo } = calcularUrgencia(
      {
        ...lead,
        proximaAtividadeData,
        horasSemResposta,
      },
      agora
    );

    return {
      id: lead.id,
      nome: lead.nome,
      telefone: lead.telefone,
      email: lead.email,
      status: lead.status,
      temperatura: lead.temperatura,
      origem: lead.origem,
      criadoEm: lead.criadoEm,
      atualizadoEm: lead.atualizadoEm,
      primeiroContato: lead.primeiroContato,
      ultimaInteracao: lead.ultimaInteracao,
      briefingCloser: lead.briefingCloser,
      // Calculados
      urgencia: pontos,
      categoriaUrgencia: categoria,
      motivoUrgencia: motivo,
      resumoIA: gerarResumoIA(lead),
      ultimaAcaoIA: lead.ultimaAcaoIA,
      ultimaAcaoIAEm: lead.ultimaAcaoIAEm,
      proximaAtividade: proxAtividade
        ? {
            tipo: proxAtividade.tipo,
            titulo: proxAtividade.titulo,
            agendadoPara: proxAtividade.agendadoPara,
          }
        : null,
      totalMensagens,
      horasSemResposta,
      interesseEm: lead.interesseEm,
      tipoImovel: lead.tipoImovel,
      // valorPretendido é String no schema (ex: "R$ 650.000") — extrair número
      valorPretendido: lead.valorPretendido
        ? parseFloat(String(lead.valorPretendido).replace(/[^0-9,]/g, '').replace(',', '.')) || null
        : null,
      enderecoImovel: lead.enderecoImovel,
      doresIdentificadas: lead.doresIdentificadas || [],
      objecoes: lead.objecoes || [],
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
