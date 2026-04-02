import { ElyonCore } from '../agentes/elyon-core';
import { prisma } from '../lib/db';
import { websocketService } from '../servicos/websocket';

/**
 * JOB DE CONVERSAS INATIVAS
 * 
 * Responsável por:
 * - Processar conversas abandonadas (inativas por X horas)
 * - Finalizar conversas e processar para RAG
 * - Criar alertas para leads sem resposta
 * 
 * Deve ser executado via cron job a cada hora.
 */

interface ConfiguracaoJob {
  horasInatividade: number;  // Horas sem mensagem para considerar inativa
  maxConversasPorExecucao: number;  // Limite de conversas por execução
  criarAlertasSemResposta: boolean;  // Se deve alertar leads sem resposta
}

const configPadrao: ConfiguracaoJob = {
  horasInatividade: 24,
  maxConversasPorExecucao: 100,
  criarAlertasSemResposta: true
};

class JobConversasInativas {
  private config: ConfiguracaoJob;
  private ultimaExecucao: Date | null = null;
  private estaExecutando: boolean = false;
  private elyonCore: ElyonCore;
  
  constructor(config: Partial<ConfiguracaoJob> = {}) {
    this.config = { ...configPadrao, ...config };
    this.elyonCore = new ElyonCore();
  }
  
  /**
   * Executa o job de processamento de conversas inativas
   */
  async executar(): Promise<{
    processadas: number;
    alertasCriados: number;
    erros: number;
    duracao: number;
    conversoesForcadas?: number;
  }> {
    if (this.estaExecutando) {
      console.log('[JOB] ⚠️ Job já está em execução, pulando...');
      return { processadas: 0, alertasCriados: 0, erros: 0, duracao: 0 };
    }
    
    this.estaExecutando = true;
    const inicio = Date.now();
    
    let processadas = 0;
    let alertasCriados = 0;
    let erros = 0;
    let conversoesForcadas = 0;
    
    try {
      console.log(`[JOB] 🔄 Iniciando processamento de conversas inativas (${this.config.horasInatividade}h)`);
      
      // 1. Processar conversas inativas
      processadas = await this.elyonCore.processarConversasInativas(this.config.horasInatividade);
      console.log(`[JOB] ✅ ${processadas} conversas finalizadas`);
      
      // 2. 🔍 FISCALIZAÇÃO: Detectar leads que aceitaram mas não foram convertidos
      console.log('[JOB] 🔍 Iniciando fiscalização de conversões pendentes...');
      const resultadoFiscalizacao = await this.elyonCore.fiscalizarConversoesPendentes();
      conversoesForcadas = resultadoFiscalizacao.convertidas;
      erros += resultadoFiscalizacao.erros;
      console.log(`[JOB] 🔍 Fiscalização: ${resultadoFiscalizacao.analisadas} analisadas, ${conversoesForcadas} convertidas`);
      
      // 3. Identificar leads sem resposta (prospecção ativa)
      if (this.config.criarAlertasSemResposta) {
        alertasCriados = await this.alertarLeadsSemResposta();
        console.log(`[JOB] 🚨 ${alertasCriados} alertas criados para leads sem resposta`);
      }
      
      // 4. Limpar dados antigos
      await this.limparDadosAntigos();
      
      this.ultimaExecucao = new Date();
      
    } catch (error) {
      console.error('[JOB] 💥 Erro na execução:', error);
      erros++;
    } finally {
      this.estaExecutando = false;
    }
    
    const duracao = Date.now() - inicio;
    console.log(`[JOB] ✨ Concluído em ${duracao}ms`);
    
    return { processadas, alertasCriados, erros, duracao, conversoesForcadas };
  }
  
  /**
   * Cria alertas para leads de prospecção que não responderam
   */
  private async alertarLeadsSemResposta(): Promise<number> {
    try {
      const limiteData = new Date();
      limiteData.setHours(limiteData.getHours() - 48); // 48h sem resposta
      
      // Buscar contatos de prospecção sem resposta há mais de 48h
      const contatosSemResposta = await prisma.contato.findMany({
        where: {
          statusProspeccao: 'CONTATANDO',
          respondeu: false,
          ultimaTentativa: { lt: limiteData },
          tentativasContato: { gte: 2 } // Pelo menos 2 tentativas
        },
        include: {
          campanha: {
            select: {
              tenantId: true,
              nome: true
            }
          }
        },
        take: 50
      });
      
      let alertasCriados = 0;
      
      for (const contato of contatosSemResposta) {
        try {
          const alerta = await (prisma as any).alertaCorretor.create({
            data: {
              tenantId: contato.campanha.tenantId,
              tipo: 'LEAD_QUENTE',
              prioridade: 'BAIXA',
              titulo: `Contato ${contato.nome} não respondeu`,
              descricao: `O contato ${contato.nome} da campanha "${contato.campanha.nome}" não respondeu após ${contato.tentativasContato} tentativas.\n` +
                        `Última tentativa: ${contato.ultimaTentativa?.toLocaleString('pt-BR')}\n` +
                        `Considere: ligar ou remover da campanha.`,
              contexto: {
                contatoId: contato.id,
                campanhaId: contato.campanhaId,
                telefone: contato.telefone,
                tentativas: contato.tentativasContato
              },
              status: 'PENDENTE'
            }
          });
          
          // Notificar via WebSocket
          websocketService.emitirAlerta(contato.campanha.tenantId, alerta);
          alertasCriados++;
        } catch (alertaError) {
          console.error(`[JOB] Erro ao criar alerta para contato ${contato.id}:`, alertaError);
        }
      }
      
      return alertasCriados;
      
    } catch (error) {
      console.error('[JOB] Erro ao buscar leads sem resposta:', error);
      return 0;
    }
  }
  
  /**
   * Limpa dados antigos (métricas, alertas resolvidos, etc.)
   */
  private async limparDadosAntigos(): Promise<void> {
    try {
      const limite30Dias = new Date();
      limite30Dias.setDate(limite30Dias.getDate() - 30);
      
      // Limpar alertas atendidos há mais de 30 dias
      const alertasRemovidos = await (prisma as any).alertaCorretor.deleteMany({
        where: {
          status: 'ATENDIDO',
          atendidoEm: { lt: limite30Dias }
        }
      });
      
      if (alertasRemovidos.count > 0) {
        console.log(`[JOB] 🗑️ ${alertasRemovidos.count} alertas antigos removidos`);
      }
      
      // Limpar métricas antigas (mais de 90 dias)
      const limite90Dias = new Date();
      limite90Dias.setDate(limite90Dias.getDate() - 90);
      
      const metricasRemovidas = await (prisma as any).metricaMensagem.deleteMany({
        where: {
          processadoEm: { lt: limite90Dias }
        }
      });
      
      if (metricasRemovidas.count > 0) {
        console.log(`[JOB] 🗑️ ${metricasRemovidas.count} métricas antigas removidas`);
      }
      
    } catch (error) {
      console.error('[JOB] Erro ao limpar dados antigos:', error);
    }
  }
  
  /**
   * Retorna status do job
   */
  getStatus(): {
    ultimaExecucao: Date | null;
    estaExecutando: boolean;
    config: ConfiguracaoJob;
  } {
    return {
      ultimaExecucao: this.ultimaExecucao,
      estaExecutando: this.estaExecutando,
      config: this.config
    };
  }
  
  /**
   * Atualiza configuração do job
   */
  atualizarConfig(novaConfig: Partial<ConfiguracaoJob>): void {
    this.config = { ...this.config, ...novaConfig };
    console.log('[JOB] ⚙️ Configuração atualizada:', this.config);
  }
}

// Exportar instância singleton
export const jobConversasInativas = new JobConversasInativas();

/**
 * Função para uso com cron externo (ex: node-cron)
 * 
 * Exemplo de uso:
 * ```typescript
 * import cron from 'node-cron';
 * import { executarJobConversasInativas } from './jobs/conversas-inativas';
 * 
 * // Executar a cada hora
 * cron.schedule('0 * * * *', executarJobConversasInativas);
 * ```
 */
export async function executarJobConversasInativas(): Promise<void> {
  const resultado = await jobConversasInativas.executar();
  console.log('[JOB] Resultado:', resultado);
}
