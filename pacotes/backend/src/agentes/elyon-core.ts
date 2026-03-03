import { prisma } from '../lib/db';
import { ragConversasService } from '../servicos/rag-conversas';
import { metricasSDRService } from '../servicos/metricas-sdr';
import { ConverterParaLeadUseCase } from '../casos-de-uso/agentes/converter-para-lead.usecase';

/**
 * ELYON CORE — Funções de Manutenção e Jobs
 * 
 * Responsabilidades:
 * - Finalizar conversas inativas e processar para RAG
 * - Fiscalizar conversões pendentes (leads que aceitaram mas não foram convertidos)
 * 
 * Usado por: jobs/conversas-inativas.ts (cron)
 */

export class ElyonCore {

  /**
   * Finaliza uma conversa e processa para RAG
   * Chamado quando a conversa é encerrada ou após período de inatividade
   */
  async finalizarConversa(conversaId: string): Promise<void> {
    console.log(`[ELYON] 🏁 Finalizando conversa ${conversaId}`);

    try {
      // Atualizar status da conversa
      await prisma.conversa.update({
        where: { id: conversaId },
        data: {
          estadoConversa: 'finalizada',
          finalizadaEm: new Date()
        }
      });

      // Processar para RAG em background (não bloqueia)
      ragConversasService.processarConversaFinalizada(conversaId)
        .catch(err => console.error('[ELYON] Erro ao processar RAG:', err));

    } catch (error) {
      console.error('[ELYON] Erro ao finalizar conversa:', error);
    }
  }

  /**
   * Job para processar conversas abandonadas (inativas por X horas)
   * Deve ser chamado por um cron job
   */
  async processarConversasInativas(horasInatividade: number = 24): Promise<number> {
    console.log(`[ELYON] 🔄 Buscando conversas inativas há ${horasInatividade}h`);

    try {
      const limiteData = new Date();
      limiteData.setHours(limiteData.getHours() - horasInatividade);

      const conversasInativas = await prisma.conversa.findMany({
        where: {
          estadoConversa: 'ativa',
          ultimaMensagemEm: { lt: limiteData }
        },
        take: 50
      });

      console.log(`[ELYON] 📋 Encontradas ${conversasInativas.length} conversas inativas`);

      for (const conversa of conversasInativas) {
        await this.finalizarConversa(conversa.id);
      }

      return conversasInativas.length;

    } catch (error) {
      console.error('[ELYON] Erro ao processar conversas inativas:', error);
      return 0;
    }
  }

  /**
   * 🔍 FISCALIZADOR: Detecta leads que aceitaram mas não foram convertidos
   * 
   * Responsabilidade do Orquestrador:
   * - Analisar conversas de prospecção recentes
   * - Detectar sinais de aceitação (agendou visita, disse "sim", etc)
   * - Verificar se o contato foi convertido para Lead
   * - Se não foi, converter automaticamente e registrar métrica
   * 
   * Deve ser chamado por cron job (a cada 5-10 min)
   */
  async fiscalizarConversoesPendentes(): Promise<{
    analisadas: number;
    convertidas: number;
    erros: number
  }> {
    console.log('[ELYON] 🔍 Iniciando fiscalização de conversões pendentes...');

    const resultado = { analisadas: 0, convertidas: 0, erros: 0 };

    try {
      // Regex para detectar sinais de aceitação nas mensagens do lead
      const sinaisFechamento = [
        /podemos\s*(?:agendar|marcar|combinar)/i,
        /dia\s*\d{1,2}[\/-]\d{1,2}/i,
        /(?:às|as)\s*\d{1,2}[h:]\d{0,2}/i,
        /aguardo\s*(?:o\s*)?(?:contato|retorno|visita)/i,
        /obrigad[oa]\s*(?:pelo\s*)?(?:retorno|contato)/i,
        /(?:aceito|concordo|fechado|combinado|tá\s*bom)/i,
        /(?:pode\s*incluir|inclua|anuncie|divulgue)/i,
        /ok[,.]?\s*(?:pode|vamos|fechado)/i,
        /tudo\s*(?:certo|ok|bem)/i,
      ];

      // Buscar contatos de prospecção que responderam mas não viraram lead
      // Filtro: últimas 24h, statusProspeccao = RESPONDEU, virouLead = false
      const limiteData = new Date();
      limiteData.setHours(limiteData.getHours() - 24);

      const contatosPendentes = await prisma.contato.findMany({
        where: {
          statusProspeccao: 'RESPONDEU',
          virouLead: false,
          atualizadoEm: { gte: limiteData }
        },
        include: {
          campanha: {
            include: { empreendimento: true }
          }
        },
        take: 100
      });

      console.log(`[ELYON] 📋 Encontrados ${contatosPendentes.length} contatos pendentes de análise`);

      for (const contato of contatosPendentes) {
        resultado.analisadas++;

        try {
          // Buscar histórico de mensagens do contato
          const conversa = await prisma.conversa.findFirst({
            where: {
              OR: [
                { leadId: contato.id },
                // Buscar por telefone também
                { lead: { telefone: contato.telefone } }
              ]
            },
            include: {
              mensagens: {
                orderBy: { enviadaEm: 'desc' },
                take: 20
              }
            }
          });

          if (!conversa || conversa.mensagens.length === 0) {
            // Sem histórico, pular
            continue;
          }

          // Concatenar mensagens do usuário (lead)
          const mensagensLead = conversa.mensagens
            .filter(m => m.remetente === 'usuario')
            .map(m => m.conteudo)
            .join('\n');

          // Verificar se há sinais de fechamento
          const leadAceitou = sinaisFechamento.some(regex => regex.test(mensagensLead));

          if (leadAceitou) {
            console.log(`[ELYON] ✅ Contato ${contato.nome} (${contato.telefone}) ACEITOU mas não foi convertido!`);

            // Extrair dados básicos da conversa
            const regexQuartos = /(\d+)\s*quartos?/i;
            const regexTimeline = /dia\s*(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)/i;

            const matchQuartos = mensagensLead.match(regexQuartos);
            const matchTimeline = mensagensLead.match(regexTimeline);

            // Converter para Lead
            try {
              const converterUseCase = new ConverterParaLeadUseCase();
              const resultadoConversao = await converterUseCase.execute({
                contatoId: contato.id,
                tipoInteresse: 'VENDA',
                temperatura: 'QUENTE',
                timeline: matchTimeline?.[1] || 'não informado',
                quartosImovel: matchQuartos ? parseInt(matchQuartos[1]) : undefined,
                motivacaoVenda: `[FISCALIZAÇÃO ELYON] Conversão automática: Lead aceitou anunciar/agendar mas SDR não chamou tool. Detectado: ${sinaisFechamento.find(r => r.test(mensagensLead))}`
              });

              console.log(`[ELYON] 🎉 Lead ${contato.nome} convertido com sucesso!`, resultadoConversao);
              resultado.convertidas++;

              // Registrar métrica de correção
              await metricasSDRService.registrarMetrica({
                conversaId: conversa.id,
                leadId: contato.id,
                tenantId: contato.campanha?.tenantId || 'unknown',
                mensagemUsuario: '[FISCALIZAÇÃO]',
                respostaGerada: '[CONVERSÃO AUTOMÁTICA]',
                workerUsado: 'SDR',
                modoOperacao: 'PROSPECCAO',
                confianca: 100,
                relevancia: 100,
                tom: 'ADEQUADO',
                riscoEscalacao: 0,
                acaoSupervisor: 'ENVIAR',
                foiRefinada: false,
                foiEscalada: false,
                alertaCorretor: false,
                temperaturaLead: 'QUENTE'
              });

            } catch (convError) {
              console.error(`[ELYON] ❌ Erro ao converter contato ${contato.id}:`, convError);
              resultado.erros++;
            }
          }

        } catch (contatoError) {
          console.error(`[ELYON] Erro ao analisar contato ${contato.id}:`, contatoError);
          resultado.erros++;
        }
      }

      console.log(`[ELYON] 🏁 Fiscalização concluída: ${resultado.analisadas} analisadas, ${resultado.convertidas} convertidas, ${resultado.erros} erros`);

      return resultado;

    } catch (error) {
      console.error('[ELYON] Erro na fiscalização:', error);
      return resultado;
    }
  }

}

// Exportar instância para uso pelo cron job
export const elyonCore = new ElyonCore();
