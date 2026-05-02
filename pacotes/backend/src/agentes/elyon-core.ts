import { prisma } from '../lib/db';
import { ragConversasService } from '../servicos/rag-conversas';
import { metricasSDRService } from '../servicos/metricas-sdr';
import { ConverterParaLeadUseCase } from '../casos-de-uso/agentes/converter-para-lead.usecase';
import { logger } from '../lib/logger';
import { OpenAI } from 'openai';
import { buscarConfiguracaoTenant } from './orchestrator-queries';
import { resolverChaveAgentes, MODELO_PADRAO_AUXILIAR } from './byok-resolver';

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
        .catch(err => logger.warn({ err }, '[ELYON-CORE] Erro ao processar conversa para RAG'));

    } catch (error) {
      logger.warn({ err: error }, '[ELYON-CORE] Erro ao finalizar conversa');
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

      // FIX N+1: Batch update em vez de N updates individuais
      if (conversasInativas.length > 0) {
        const ids = conversasInativas.map(c => c.id);
        await prisma.conversa.updateMany({
          where: { id: { in: ids } },
          data: {
            estadoConversa: 'finalizada',
            finalizadaEm: new Date()
          }
        });

        // RAG em background (fire-and-forget, não bloqueia)
        for (const c of conversasInativas) {
          ragConversasService.processarConversaFinalizada(c.id)
            .catch(err => logger.warn({ err }, '[ELYON-CORE] Erro ao processar conversa para RAG'));
        }
      }

      return conversasInativas.length;

    } catch (error) {
      logger.warn({ err: error }, '[ELYON-CORE] Erro ao processar conversas inativas');
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

      // Buscar leads de prospecção que responderam mas ainda não foram promovidos para CRM
      // Filtro: últimas 24h, statusProspeccao = RESPONDEU
      const limiteData = new Date();
      limiteData.setHours(limiteData.getHours() - 24);

      const contatosPendentes = await prisma.lead.findMany({
        where: {
          statusProspeccao: 'RESPONDEU',
          atualizadoEm: { gte: limiteData }
        },
        include: {
          campanhaOrigem: {
            include: { empreendimento: true }
          }
        },
        take: 100
      });

      logger.debug(`[ELYON] 📋 Encontrados ${contatosPendentes.length} leads pendentes de análise`);

      // ── FIX N+1 #1: Batch de conversas (antes: 1 findFirst por lead → agora: 1 findMany) ──
      const contatoIds = contatosPendentes.map(c => c.id);
      const telefones = contatosPendentes.map(c => c.telefone).filter(Boolean) as string[];

      const todasConversas = await prisma.conversa.findMany({
        where: {
          OR: [
            { leadId: { in: contatoIds } },
            { lead: { telefone: { in: telefones } } }
          ]
        },
        include: {
          mensagens: {
            orderBy: { enviadaEm: 'desc' },
            take: 20
          },
          lead: { select: { telefone: true } }
        }
      });

      // Indexar por leadId e telefone para lookup O(1)
      const conversaPorLeadId = new Map<string, typeof todasConversas[0]>();
      const conversaPorTelefone = new Map<string, typeof todasConversas[0]>();
      for (const c of todasConversas) {
        if (c.leadId) conversaPorLeadId.set(c.leadId, c);
        if (c.lead?.telefone) conversaPorTelefone.set(c.lead.telefone, c);
      }

      // ── FIX N+1 #2: Batch de configs de tenant (antes: 1 findUnique por tenant → agora: 1 batch) ──
      const tenantIdsUnicos = [...new Set(
        contatosPendentes.map(c => c.campanhaOrigem?.tenantId).filter(Boolean)
      )] as string[];

      // Pré-carregar todos os clients BYOK de uma vez
      if (tenantIdsUnicos.length > 0) {
        const configs = await Promise.all(
          tenantIdsUnicos.map(tid => buscarConfiguracaoTenant(tid).then(cfg => ({ tid, cfg })))
        );
        for (const { tid, cfg } of configs) {
          const byok = resolverChaveAgentes(cfg ?? null);
          openaiClients.set(tid, new OpenAI({
            apiKey: byok.apiKey || process.env.OPENAI_API_KEY,
            baseURL: byok.baseUrl || undefined
          }));
        }
      }

      for (const contato of contatosPendentes) {
        resultado.analisadas++;

        try {
          // Lookup instantâneo (sem query)
          const conversa = conversaPorLeadId.get(contato.id)
                        || (contato.telefone ? conversaPorTelefone.get(contato.telefone) : undefined);

          if (!conversa || conversa.mensagens.length === 0) {
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

          const tenantId = contato.campanhaOrigem?.tenantId;
          let activeClient = basePlatformClient;

          if (tenantId) {
              activeClient = openaiClients.get(tenantId) || basePlatformClient;
          }

          if (activeClient) {
              try {
                  const openaiResult = await activeClient.chat.completions.create({
                      model: MODELO_PADRAO_AUXILIAR,
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
                  logger.warn({ err: e }, '[ELYON-CORE] Erro na avaliação LLM de aceitação do lead');
                  leadAceitou = fallbackRegex.test(mensagensLead);
              }
          } else {
              leadAceitou = fallbackRegex.test(mensagensLead);
          }

          if (leadAceitou) {
            logger.debug(`[ELYON] ✅ Lead ${contato.nome} (${contato.telefone}) ACEITOU mas não foi promovido!`);

            // Extrair dados básicos da conversa
            const regexQuartos = /(\d+)\s*quartos?/i;
            const regexTimeline = /dia\s*(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)/i;

            const matchQuartos = mensagensLead.match(regexQuartos);
            const matchTimeline = mensagensLead.match(regexTimeline);

            // Promover lead para CRM
            try {
              const converterUseCase = new ConverterParaLeadUseCase();
              const resultadoConversao = await converterUseCase.execute({
                leadId: contato.id,
                tipoInteresse: 'VENDA',
                temperatura: 'QUENTE',
                timeline: matchTimeline?.[1] || 'não informado',
                quartosImovel: matchQuartos ? parseInt(matchQuartos[1]) : undefined,
                motivacaoVenda: `[FISCALIZAÇÃO ELYON] Conversão automática: LLM Detectou resposta positiva à oferta de transição na triagem.`
              });

              logger.debug('[ELYON-CORE] Conversão automática realizada com sucesso');
              resultado.convertidas++;

              // Registrar métrica de correção
              await metricasSDRService.registrarMetrica({
                conversaId: conversa.id,
                leadId: contato.id,
                tenantId: contato.campanhaOrigem?.tenantId || 'unknown',
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
              logger.warn({ err: convError }, '[ELYON-CORE] Erro ao converter lead automático');
              resultado.erros++;
            }
          }

        } catch (contatoError) {
          logger.warn({ err: contatoError }, '[ELYON-CORE] Erro ao processar contato na fiscalização');
          resultado.erros++;
        }
      }

      logger.debug(`[ELYON] 🏁 Fiscalização concluída: ${resultado.analisadas} analisadas, ${resultado.convertidas} convertidas, ${resultado.erros} erros`);

      return resultado;

    } catch (error) {
      logger.warn({ err: error }, '[ELYON-CORE] Erro geral na fiscalização');
      return resultado;
    }
  }

}

// Exportar instância para uso pelo cron job
export const elyonCore = new ElyonCore();
