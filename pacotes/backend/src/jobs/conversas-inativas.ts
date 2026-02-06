// DEPRECATED: import { ElyonCore } from '../agentes/elyon-core';
// A funcionalidade de processamento de conversas inativas será reimplementada
// usando o Orchestrator quando necessário.
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
 * 
 * REFATORADO em 2026-02-06:
 * - Removida dependência do ElyonCore (deprecado)
 * - Funcionalidades de processamento IA serão reimplementadas via Orchestrator
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

  constructor(config: Partial<ConfiguracaoJob> = {}) {
    this.config = { ...configPadrao, ...config };
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

      // 1. Processar conversas inativas - Finalizar e marcar como encerradas
      processadas = await this.processarConversasInativas();
      console.log(`[JOB] ✅ ${processadas} conversas finalizadas`);

      // 2. 🔍 FISCALIZAÇÃO: Detectar leads que aceitaram mas não foram convertidos
      console.log('[JOB] 🔍 Iniciando fiscalização de conversões pendentes...');
      const resultadoFiscalizacao = await this.fiscalizarConversoesPendentes();
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
   * Processa conversas inativas - marca como finalizadas
   */
  private async processarConversasInativas(): Promise<number> {
    try {
      const limiteData = new Date();
      limiteData.setHours(limiteData.getHours() - this.config.horasInatividade);

      // Buscar conversas inativas
      const conversasInativas = await prisma.conversa.findMany({
        where: {
          estadoConversa: { in: ['ativa', 'ATIVO', 'CONVERSA_ATIVA'] },
          ultimaMensagemEm: { lt: limiteData }
        },
        take: this.config.maxConversasPorExecucao
      });

      let processadas = 0;

      for (const conversa of conversasInativas) {
        try {
          await prisma.conversa.update({
            where: { id: conversa.id },
            data: {
              estadoConversa: 'encerrado',
              finalizadaEm: new Date()
            }
          });
          processadas++;
        } catch (err) {
          console.error(`[JOB] Erro ao finalizar conversa ${conversa.id}:`, err);
        }
      }

      return processadas;
    } catch (error) {
      console.error('[JOB] Erro ao processar conversas inativas:', error);
      return 0;
    }
  }

  /**
   * Detecta leads que aceitaram proposta mas não foram convertidos
   */
  private async fiscalizarConversoesPendentes(): Promise<{
    analisadas: number;
    convertidas: number;
    erros: number;
  }> {
    let analisadas = 0;
    let convertidas = 0;
    let errosInterno = 0;

    try {
      // Buscar conversas finalizadas recentemente que indicaram aceite
      const conversasSuspeitas = await prisma.conversa.findMany({
        where: {
          estadoConversa: { in: ['encerrado', 'finalizado', 'ENCERRADO', 'FINALIZADO'] },
          lead: {
            status: { notIn: ['CONVERTIDO', 'PERDIDO', 'ARQUIVADO'] }
          },
          finalizadaEm: {
            gte: new Date(Date.now() - 48 * 60 * 60 * 1000) // Últimas 48h
          }
        },
        include: {
          lead: true,
          mensagens: {
            orderBy: { enviadaEm: 'desc' },
            take: 20
          }
        },
        take: 50
      });

      for (const conversa of conversasSuspeitas) {
        analisadas++;

        // Verificar se há indicadores de aceite nas mensagens
        const mensagensTexto = conversa.mensagens.map(m => m.conteudo?.toLowerCase() || '').join(' ');
        const indicadoresAceite = [
          'aceito', 'fechado', 'combinado', 'vamos fechar',
          'pode fazer', 'manda o contrato', 'assino', 'pago'
        ];

        const temAceite = indicadoresAceite.some(ind => mensagensTexto.includes(ind));

        if (temAceite && conversa.lead) {
          try {
            await prisma.lead.update({
              where: { id: conversa.leadId! },
              data: {
                status: 'QUALIFICADO'
              }
            });
            convertidas++;
            console.log(`[JOB] 🔄 Lead ${conversa.leadId} movido para QUALIFICADO (aceite detectado)`);
          } catch (err) {
            errosInterno++;
          }
        }
      }
    } catch (error) {
      console.error('[JOB] Erro na fiscalização:', error);
      errosInterno++;
    }

    return { analisadas, convertidas, erros: errosInterno };
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
