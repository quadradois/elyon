import { prisma } from '../lib/db';

/**
 * SERVIÇO DE MÉTRICAS SDR
 * 
 * Responsável por:
 * - Registrar métricas de cada mensagem processada
 * - Criar alertas para corretores
 * - Fornecer analytics de performance do SDR
 */

export interface MetricaProcessamento {
  mensagemId?: string;
  conversaId?: string;
  leadId?: string;
  tenantId: string;
  mensagemUsuario?: string;
  respostaGerada?: string;
  workerUsado: 'SDR' | 'DOCUMENTOS' | 'FINANCEIRO';
  modoOperacao: 'PROSPECCAO' | 'PASSIVO';
  confianca: number;
  relevancia: number;
  tom: 'ADEQUADO' | 'FORMAL_DEMAIS' | 'INFORMAL_DEMAIS';
  riscoEscalacao: number;
  acaoSupervisor: 'ENVIAR' | 'REFINAR' | 'ESCALAR_HUMANO' | 'MUDAR_WORKER';
  foiRefinada: boolean;
  foiEscalada: boolean;
  alertaCorretor: boolean;
  tempoProcessamentoMs?: number;
  tokensUsados?: number;
  custoEstimado?: number;
  toolsChamadas?: any[];
  temperaturaLead?: 'FRIO' | 'MORNO' | 'QUENTE';
}

export interface DadosAlerta {
  tenantId: string;
  leadId?: string;
  conversaId?: string;
  tipo: 'ESCALACAO' | 'LEAD_QUENTE' | 'OBJECAO' | 'ERRO_SISTEMA' | 'OPTOUT';
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  titulo: string;
  descricao: string;
  contexto?: any;
}

class MetricasSDRService {
  
  /**
   * Registra métricas de uma mensagem processada
   */
  async registrarMetrica(metrica: MetricaProcessamento): Promise<string> {
    try {
      const registro = await prisma.metricaMensagem.create({
        data: {
          mensagemId: metrica.mensagemId,
          conversaId: metrica.conversaId,
          leadId: metrica.leadId,
          tenantId: metrica.tenantId,
          mensagemUsuario: metrica.mensagemUsuario,
          respostaGerada: metrica.respostaGerada,
          workerUsado: metrica.workerUsado,
          modoOperacao: metrica.modoOperacao,
          confianca: metrica.confianca,
          relevancia: metrica.relevancia,
          tom: metrica.tom,
          riscoEscalacao: metrica.riscoEscalacao,
          acaoSupervisor: metrica.acaoSupervisor,
          foiRefinada: metrica.foiRefinada,
          foiEscalada: metrica.foiEscalada,
          alertaCorretor: metrica.alertaCorretor,
          tempoProcessamentoMs: metrica.tempoProcessamentoMs,
          tokensUsados: metrica.tokensUsados,
          custoEstimado: metrica.custoEstimado,
          toolsChamadas: metrica.toolsChamadas,
          temperaturaLead: metrica.temperaturaLead
        }
      });
      
      console.log(`[MÉTRICAS] 📊 Métrica registrada: ${registro.id}`);
      return registro.id;
      
    } catch (error) {
      console.error('[MÉTRICAS] Erro ao registrar métrica:', error);
      throw error;
    }
  }
  
  /**
   * Cria um alerta para o corretor
   */
  async criarAlerta(dados: DadosAlerta): Promise<string> {
    try {
      const alerta = await prisma.alertaCorretor.create({
        data: {
          tenantId: dados.tenantId,
          leadId: dados.leadId,
          conversaId: dados.conversaId,
          tipo: dados.tipo,
          prioridade: dados.prioridade,
          titulo: dados.titulo,
          descricao: dados.descricao,
          contexto: dados.contexto,
          status: 'PENDENTE'
        }
      });
      
      console.log(`[ALERTAS] 🚨 Alerta criado: ${alerta.id} (${dados.tipo} - ${dados.prioridade})`);
      
      // TODO: Emitir evento WebSocket para notificação real-time
      // websocketService.emit('alerta:novo', alerta);
      
      return alerta.id;
      
    } catch (error) {
      console.error('[ALERTAS] Erro ao criar alerta:', error);
      throw error;
    }
  }
  
  /**
   * Busca alertas pendentes de um tenant
   */
  async buscarAlertasPendentes(tenantId: string, limite: number = 20): Promise<any[]> {
    return prisma.alertaCorretor.findMany({
      where: {
        tenantId,
        status: 'PENDENTE'
      },
      orderBy: [
        { prioridade: 'desc' },
        { criadoEm: 'desc' }
      ],
      take: limite
    });
  }
  
  /**
   * Marca alerta como visualizado
   */
  async marcarAlertaVisualizado(alertaId: string): Promise<void> {
    await prisma.alertaCorretor.update({
      where: { id: alertaId },
      data: {
        status: 'VISUALIZADO',
        visualizadoEm: new Date()
      }
    });
  }
  
  /**
   * Marca alerta como atendido
   */
  async marcarAlertaAtendido(alertaId: string, usuarioId: string): Promise<void> {
    await prisma.alertaCorretor.update({
      where: { id: alertaId },
      data: {
        status: 'ATENDIDO',
        atendidoEm: new Date(),
        atendidoPor: usuarioId
      }
    });
  }
  
  /**
   * Retorna estatísticas de performance do SDR
   */
  async obterEstatisticasSDR(tenantId: string, dias: number = 7): Promise<{
    totalMensagens: number;
    taxaAprovacao: number;
    taxaRefinamento: number;
    taxaEscalacao: number;
    confiancaMedia: number;
    relevanciaMedia: number;
    riscoMedio: number;
    tempoMedioMs: number;
    distribuicaoWorkers: Record<string, number>;
    distribuicaoAcoes: Record<string, number>;
  }> {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);
    
    const metricas = await prisma.metricaMensagem.findMany({
      where: {
        tenantId,
        processadoEm: { gte: dataLimite }
      }
    });
    
    if (metricas.length === 0) {
      return {
        totalMensagens: 0,
        taxaAprovacao: 0,
        taxaRefinamento: 0,
        taxaEscalacao: 0,
        confiancaMedia: 0,
        relevanciaMedia: 0,
        riscoMedio: 0,
        tempoMedioMs: 0,
        distribuicaoWorkers: {},
        distribuicaoAcoes: {}
      };
    }
    
    const total = metricas.length;
    const aprovadas = metricas.filter(m => m.acaoSupervisor === 'ENVIAR').length;
    const refinadas = metricas.filter(m => m.foiRefinada).length;
    const escaladas = metricas.filter(m => m.foiEscalada).length;
    
    const somaConfianca = metricas.reduce((acc, m) => acc + m.confianca, 0);
    const somaRelevancia = metricas.reduce((acc, m) => acc + m.relevancia, 0);
    const somaRisco = metricas.reduce((acc, m) => acc + m.riscoEscalacao, 0);
    
    const tempos = metricas.filter(m => m.tempoProcessamentoMs).map(m => m.tempoProcessamentoMs!);
    const somaTempo = tempos.reduce((acc, t) => acc + t, 0);
    
    // Distribuição por worker
    const distribuicaoWorkers: Record<string, number> = {};
    metricas.forEach(m => {
      distribuicaoWorkers[m.workerUsado] = (distribuicaoWorkers[m.workerUsado] || 0) + 1;
    });
    
    // Distribuição por ação
    const distribuicaoAcoes: Record<string, number> = {};
    metricas.forEach(m => {
      distribuicaoAcoes[m.acaoSupervisor] = (distribuicaoAcoes[m.acaoSupervisor] || 0) + 1;
    });
    
    return {
      totalMensagens: total,
      taxaAprovacao: Math.round((aprovadas / total) * 100),
      taxaRefinamento: Math.round((refinadas / total) * 100),
      taxaEscalacao: Math.round((escaladas / total) * 100),
      confiancaMedia: Math.round(somaConfianca / total),
      relevanciaMedia: Math.round(somaRelevancia / total),
      riscoMedio: Math.round(somaRisco / total),
      tempoMedioMs: tempos.length > 0 ? Math.round(somaTempo / tempos.length) : 0,
      distribuicaoWorkers,
      distribuicaoAcoes
    };
  }
  
  /**
   * Retorna métricas de um lead específico
   */
  async obterMetricasLead(leadId: string): Promise<{
    totalInteracoes: number;
    confiancaMedia: number;
    riscoMedio: number;
    ultimaInteracao: Date | null;
    historicoAcoes: string[];
  }> {
    const metricas = await prisma.metricaMensagem.findMany({
      where: { leadId },
      orderBy: { processadoEm: 'desc' }
    });
    
    if (metricas.length === 0) {
      return {
        totalInteracoes: 0,
        confiancaMedia: 0,
        riscoMedio: 0,
        ultimaInteracao: null,
        historicoAcoes: []
      };
    }
    
    const somaConfianca = metricas.reduce((acc, m) => acc + m.confianca, 0);
    const somaRisco = metricas.reduce((acc, m) => acc + m.riscoEscalacao, 0);
    
    return {
      totalInteracoes: metricas.length,
      confiancaMedia: Math.round(somaConfianca / metricas.length),
      riscoMedio: Math.round(somaRisco / metricas.length),
      ultimaInteracao: metricas[0].processadoEm,
      historicoAcoes: metricas.slice(0, 10).map(m => m.acaoSupervisor)
    };
  }
}

export const metricasSDRService = new MetricasSDRService();
