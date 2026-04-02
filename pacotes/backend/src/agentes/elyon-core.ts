import { prisma } from '../lib/db';
import { ragConversasService } from '../servicos/rag-conversas';
import { metricasSDRService } from '../servicos/metricas-sdr';
import { ConverterParaLeadUseCase } from '../casos-de-uso/agentes/converter-para-lead.usecase';
import { logger } from '../lib/logger';
import { OpenAI } from 'openai';
import { buscarConfiguracaoTenant } from './orchestrator-queries';

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
    logger.debug(`[ELYON] 🏁 Finalizando conversa ${conversaId}`);

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
        .catch(err => logger.warn("[erro capturado]"));

    } catch (error) {
      logger.warn("[erro capturado]");
    }
  }

  /**
   * Job para processar conversas abandonadas (inativas por X horas)
   * Deve ser chamado por um cron job
   */
  async processarConversasInativas(horasInatividade: number = 24): Promise<number> {
    logger.debug(`[ELYON] 🔄 Buscando conversas inativas há ${horasInatividade}h`);

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

      logger.debug(`[ELYON] 📋 Encontradas ${conversasInativas.length} conversas inativas`);

      // TASK-CR-10 / CR-13: Processamento em lote assíncrono para conversas
      const CONCURRENCY = 5;
      let finalizadas = 0;
      for (let i = 0; i < conversasInativas.length; i += CONCURRENCY) {
        const chunk = conversasInativas.slice(i, i + CONCURRENCY);
        await Promise.allSettled(chunk.map(c => this.finalizarConversa(c.id)));
        finalizadas += chunk.length;
      }

      return conversasInativas.length;

    } catch (error) {
      logger.warn("[erro capturado]");
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
    logger.debug('[ELYON] 🔍 Iniciando fiscalização de conversões pendentes...');

    const resultado = { analisadas: 0, convertidas: 0, erros: 0 };

    try {
      // Base LLM Cient (Plataforma) + Cache de Clients BYOK dos Tenants
      const basePlatformClient = process.env.OPENAI_API_KEY ? new OpenAI() : null;
      const openaiClients = new Map<string, OpenAI | null>();

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

      logger.debug(`[ELYON] 📋 Encontrados ${contatosPendentes.length} contatos pendentes de análise`);

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

          // Verificar se há sinais de fechamento via LLM
          let leadAceitou = false;
          const fallbackRegex = /\b(?:aceit[oe]|concordo|fechado|anuncie)\b/i;

          const tenantId = contato.campanha?.tenantId;
          let activeClient = basePlatformClient;

          if (tenantId) {
              if (!openaiClients.has(tenantId)) {
                  const configTenant = await buscarConfiguracaoTenant(tenantId);
                  const resolver = require('./byok-resolver');
                  const byok = resolver.resolverChaveAgentes((configTenant as any) || null);
                  openaiClients.set(tenantId, new OpenAI({
                      apiKey: byok.apiKey || process.env.OPENAI_API_KEY,
                      baseURL: byok.baseUrl || undefined
                  }));
              }
              activeClient = openaiClients.get(tenantId) || basePlatformClient;
          }

          if (activeClient) {
              try {
                  const openaiResult = await activeClient.chat.completions.create({
                      model: 'gpt-4o-mini',
                      temperature: 0,
                      messages: [
                          {
                              role: 'system',
                              content: 'Você é um avaliador de vendas estrito. Responda APENAS "SIM" se o lead concluiu afirmativamente o agendamento, aceitou anunciar o imóvel, ou forneceu os dados abertamente após uma proposta. Responda "NAO" se o lead foi neutro (ex: "tudo bem e com você?"), duvidoso, recusou ou apenas pediu mais informações.'
                          },
                          { role: 'user', content: mensagensLead }
                      ]
                  });
                  const avaliacao = openaiResult.choices[0]?.message?.content?.trim().toUpperCase() || 'NAO';
                  leadAceitou = avaliacao.includes('SIM');
              } catch (e) {
                  logger.warn("[erro capturado]");
                  leadAceitou = fallbackRegex.test(mensagensLead);
              }
          } else {
              leadAceitou = fallbackRegex.test(mensagensLead);
          }

          if (leadAceitou) {
            logger.debug(`[ELYON] ✅ Contato ${contato.nome} (${contato.telefone}) ACEITOU mas não foi convertido!`);

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
                motivacaoVenda: `[FISCALIZAÇÃO ELYON] Conversão automática: LLM Detectou resposta positiva à oferta de transição na triagem.`
              });

              logger.warn("[erro capturado]");
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
              logger.warn("[erro capturado]");
              resultado.erros++;
            }
          }

        } catch (contatoError) {
          logger.warn("[erro capturado]");
          resultado.erros++;
        }
      }

      logger.debug(`[ELYON] 🏁 Fiscalização concluída: ${resultado.analisadas} analisadas, ${resultado.convertidas} convertidas, ${resultado.erros} erros`);

      return resultado;

    } catch (error) {
      logger.warn("[erro capturado]");
      return resultado;
    }
  }

}

// Exportar instância para uso pelo cron job
export const elyonCore = new ElyonCore();
