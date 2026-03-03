import { prisma } from '../lib/db';
import { getWhatsAppService } from '../servicos/whatsapp';
import { ConfiguracaoAgente, configPadrao } from './workers/sdr-worker';
import { buscarConfiguracaoTenant, processarMensagemOrquestrada } from './orchestrator';
import { ragConversasService } from '../servicos/rag-conversas';
import { metricasSDRService } from '../servicos/metricas-sdr';
import { websocketService } from '../servicos/websocket';
import { blacklistService } from '../servicos/blacklist';
import { converterParaLeadTool } from '../ferramentas/sdr-tools';

/**
 * ELYON CORE v0.6.1
 * 
 * Orquestrador mestre do sistema multi-agentes.
 * 
 * Responsabilidades:
 * - Receber mensagens do webhook
 * - Identificar tenant e carregar configurações
 * - Carregar contexto RAG (empreendimentos + conversas anteriores + PERFIL IMOBILIÁRIA)
 * - Delegar para o worker apropriado (SDR, Documentos, etc.)
 * - SUPERVISIONAR a qualidade das respostas antes do envio
 * - REGISTRAR MÉTRICAS de cada interação
 * - ALERTAR CORRETORES em situações críticas
 * - Retornar resposta para o WhatsApp
 * - Processar conversas finalizadas para RAG
 * 
 * Arquitetura:
 * WhatsApp → Webhook → ELYON → Worker → SUPERVISOR → MÉTRICAS → ELYON → WhatsApp
 *                                              ↓              ↓
 *                                        RAG Conversas    Alertas
 */

export class ElyonCore {

  /**
   * Converte a configuração do banco para o formato do SDR Worker
   * Inclui flags de modo de operação baseado na origem do lead
   * e política da imobiliária (comissão, taxa de locação, etc.)
   */
  private converterConfiguracao(
    configDb: any,
    tenant: any, // Tenant completo com perfilVenda/perfilLocacao
    modoProspeccao: boolean = false,
    empreendimento?: string
  ): ConfiguracaoAgente {
    const tenantNome = tenant?.nome || 'imobiliária';

    // Extrair política do Tenant (perfilVenda e perfilLocacao são JSON)
    const perfilVenda = tenant?.perfilVenda as any || {};
    const perfilLocacao = tenant?.perfilLocacao as any || {};

    if (!configDb) {
      return {
        ...configPadrao,
        tenantNome,
        modoProspeccao,
        empreendimento,
        politica: {
          comissaoVenda: perfilVenda.comissaoPadrao,
          taxaLocacao: perfilLocacao.taxaAdministracao
        }
      };
    }

    // Extrair dados do JSON se existirem
    const personalidade = configDb.personalidade || {};
    const expertise = configDb.expertise || {};
    const scripts = configDb.scripts || {};

    return {
      nome: configDb.nome || configPadrao.nome,
      tenantNome,
      personalidade: {
        tom: personalidade.tom || 'amigavel',
        usarEmojis: personalidade.usarEmojis ?? true
      },
      expertise: {
        bairros: expertise.bairros || [],
        tiposImovel: expertise.tiposImovel || []
      },
      scripts: {
        saudacao: scripts.saudacao || configPadrao.scripts.saudacao,
        despedida: scripts.despedida || configPadrao.scripts.despedida
      },
      modoProspeccao,
      empreendimento,
      politica: {
        comissaoVenda: perfilVenda.comissaoPadrao,
        taxaLocacao: perfilLocacao.taxaAdministracao
      }
    };
  }

  /**
   * Extrai o RAG do perfil da imobiliária da configuração
   */
  private extrairRagPerfil(configDb: any): string | undefined {
    if (!configDb) return undefined;

    // ragPerfilTexto é o texto sintetizado do quiz de perfil da imobiliária
    return configDb.ragPerfilTexto || configDb.ragPerfil || undefined;
  }

  /**
   * Busca contexto RAG relevante para a conversa
   * Combina: PERFIL IMOBILIÁRIA + conhecimento do empreendimento + conversas anteriores similares
   */
  private async buscarContextoRAG(
    tenantId: string,
    campanhaId?: string | null,
    mensagemAtual?: string,
    ragPerfil?: string
  ): Promise<string | undefined> {
    try {
      const partes: string[] = [];

      // 0. Injetar RAG do Perfil da Imobiliária (política de trabalho)
      if (ragPerfil) {
        console.log(`[ELYON] 🏢 Perfil da imobiliária carregado`);
        partes.push(ragPerfil);
      }

      // 1. Buscar conhecimento do empreendimento (se tiver campanha)
      if (campanhaId) {
        const campanha = await prisma.campanha.findUnique({
          where: { id: campanhaId }
        });

        if (campanha?.empreendimentoId) {
          const empreendimento = await prisma.empreendimentoConhecimento.findUnique({
            where: { id: campanha.empreendimentoId }
          });

          if (empreendimento?.briefingCompleto) {
            console.log(`[ELYON] 📚 Empreendimento: ${empreendimento.nome}`);
            partes.push(`### Conhecimento do Empreendimento ###\n${empreendimento.briefingCompleto}`);
          }
        }
      }

      // 2. Buscar contexto de conversas anteriores similares
      if (mensagemAtual) {
        const ragConversas = await ragConversasService.buscarContextoRelevante(
          tenantId,
          mensagemAtual
        );

        if (ragConversas.contextoFormatado) {
          console.log(`[ELYON] 💬 RAG Conversas: ${ragConversas.chunks.length} chunks`);
          partes.push(ragConversas.contextoFormatado);
        }
      }

      return partes.length > 0 ? partes.join('\n\n') : undefined;

    } catch (error) {
      console.error('[ELYON] Erro ao buscar contexto RAG:', error);
      return undefined;
    }
  }

  /**
   * Seleciona o worker mais apropriado para o lead
   * REGRA: Prospecção ativa SEMPRE usa SDR até qualificação completa
   * NUNCA mude de worker no meio da conversa por palavras-chave isoladas
   */
  private selecionarWorker(lead: any, mensagem: string): 'SDR' | 'DOCUMENTOS' {
    // REGRA CRÍTICA: Se veio de campanha de prospecção, SEMPRE SDR até estar QUENTE + DOCUMENTACAO
    // @ts-ignore
    if (lead.campanhaOrigemId) {
      // Só muda para DOCUMENTOS se:
      // 1. Lead já foi qualificado como QUENTE
      // 2. E estágio atual é DOCUMENTACAO (corretor já solicitou)
      // @ts-ignore
      if (lead.temperatura === 'QUENTE' && lead.estagio === 'DOCUMENTACAO') {
        console.log('[ELYON] Lead QUENTE em fase de DOCUMENTACAO, usando DocumentosWorker');
        return 'DOCUMENTOS';
      }

      // Caso contrário, SEMPRE SDR (mesmo que mencione "documento")
      return 'SDR';
    }

    // Para leads que vieram de outras fontes (site, indicação), 
    // usar lógica baseada em estágio do lead, NÃO em palavras-chave
    // @ts-ignore
    if (lead.estagio === 'DOCUMENTACAO') {
      return 'DOCUMENTOS';
    }

    // Default: SDR para qualificação
    return 'SDR';
  }

  /**
   * Notifica corretor sobre mensagem pendente quando agente está pausado
   * Cria alerta no banco e envia via WebSocket em tempo real
   */
  private async notificarMensagemPendente(
    lead: any,
    mensagem: string,
    motivo: string
  ): Promise<void> {
    try {
      // 1. Criar alerta no banco
      const alerta = await (prisma as any).alertaCorretor.create({
        data: {
          tenantId: lead.tenantId,
          leadId: lead.id,
          tipo: 'ATENDIMENTO_HUMANO',
          prioridade: 'alta',
          titulo: `🔔 Nova mensagem de ${lead.nome || 'Lead'}`,
          descricao: `${motivo}\n\nMensagem: "${mensagem.substring(0, 200)}${mensagem.length > 200 ? '...' : ''}"`,
          riscoEscalacao: 90,
          status: 'pendente'
        }
      });

      console.log(`[ELYON] 🚨 Alerta criado: ${alerta.id}`);

      // 2. Notificar via WebSocket em tempo real
      websocketService.emitirAlerta(lead.tenantId, {
        ...alerta,
        leadNome: lead.nome,
        leadTelefone: lead.telefone,
        mensagemPreview: mensagem.substring(0, 100)
      });

      // 3. Emitir também como nova mensagem (para atualizar a interface de chat)
      websocketService.emitirNovaMensagem(lead.tenantId, {
        leadId: lead.id,
        leadNome: lead.nome || 'Lead',
        mensagem: mensagem.substring(0, 100),
        tipo: 'ENTRADA'
      });

      console.log(`[ELYON] 📤 Notificação WebSocket enviada para tenant ${lead.tenantId}`);

    } catch (error) {
      console.error('[ELYON] Erro ao notificar mensagem pendente:', error);
      // Não propaga erro para não interromper o fluxo
    }
  }

  /**
   * Processa uma mensagem recebida de um lead
   * e orquestra a resposta através dos workers
   */
  async processarMensagem(
    leadId: string,
    mensagemUsuario: string,
    tipo: 'TEXTO' | 'AUDIO' | 'IMAGEM'
  ): Promise<void> {
    console.log(`[ELYON] 🛡️  Processando mensagem do Lead ${leadId} (${tipo})`);

    try {
      // 1. Recuperar Lead + Tenant + Configuração do Agente + Perfil da Imobiliária
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          tenant: true
        }
      });

      if (!lead) {
        console.error(`[ELYON] ❌ Lead ${leadId} não encontrado no banco`);
        return;
      }

      // Buscar configuração do agente separadamente
      const configAgenteBanco = await prisma.configuracaoAgente.findFirst({
        where: { tenantId: lead.tenantId }
      });

      console.log(`[ELYON] 📋 Lead encontrado: ${lead.nome} (Tenant: ${lead.tenant.nome})`);

      // 1.1. VERIFICAR SE O AGENTE ESTÁ ATIVO
      if (!configAgenteBanco || !(configAgenteBanco as any).estaAtivo) {
        console.log(`[ELYON] ⏸️ Agente PAUSADO ou inexistente - mensagem será encaminhada para atendimento humano`);

        // Criar alerta e notificar corretor em tempo real
        await this.notificarMensagemPendente(lead, mensagemUsuario, 'Agente pausado ou não configurado');

        return; // NÃO PROCESSA - ENCAMINHA PARA HUMANO
      }

      // Verificar status específico (PAUSADO, RASCUNHO)
      if ((configAgenteBanco as any).status === 'PAUSADO' || (configAgenteBanco as any).status === 'RASCUNHO') {
        console.log(`[ELYON] ⏸️ Agente com status ${(configAgenteBanco as any).status} - mensagem será encaminhada para atendimento humano`);

        // Criar alerta e notificar corretor em tempo real
        await this.notificarMensagemPendente(lead, mensagemUsuario, `Agente em ${(configAgenteBanco as any).status}`);

        return; // NÃO PROCESSA - ENCAMINHA PARA HUMANO
      }

      // 1.2. VERIFICAR SE O TELEFONE ESTÁ NA BLACKLIST
      if (lead.telefone) {
        const estaBloqueado = await blacklistService.estaBlacklist(lead.telefone, lead.tenantId);
        if (estaBloqueado) {
          console.log(`[ELYON] 🚫 Telefone ${lead.telefone} está na BLACKLIST - ignorando mensagem`);
          return; // NÃO PROCESSA - CONTATO BLOQUEADO
        }
      }

      const campanhaId = (lead as any).campanhaOrigemId;
      if (!campanhaId) {
        console.log(`[ELYON] 🚫 Inbound desativado - lead ${leadId} ignorado`);
        return;
      }

      const campanha = await prisma.campanha.findUnique({
        where: { id: campanhaId },
        include: { empreendimento: true }
      });

      const nomeEmpreendimento = campanha?.empreendimento?.nome || (campanha as any)?.nomeEmpreendimento;
      const briefingEmpreendimento = campanha?.empreendimento?.briefingCompleto || (campanha as any)?.briefingCompleto;

      const historicoDb = await prisma.mensagem.findMany({
        where: {
          conversa: {
            leadId: leadId,
            estadoConversa: 'ativa'
          }
        },
        orderBy: { enviadaEm: 'desc' },
        take: 10
      });

      const mensagensOpenAI = historicoDb.reverse().map((msg: any) => ({
        role: msg.remetente === 'usuario' ? 'user' : 'assistant',
        content: msg.conteudo
      }));

      const ultimaMsg = mensagensOpenAI[mensagensOpenAI.length - 1];
      if (!ultimaMsg || ultimaMsg.role !== 'user' || ultimaMsg.content !== mensagemUsuario) {
        mensagensOpenAI.push({ role: 'user', content: mensagemUsuario });
      }

      console.log(`[ELYON] 💬 Histórico carregado: ${mensagensOpenAI.length} mensagens`);

      const configOrq = await buscarConfiguracaoTenant(lead.tenantId);
      if (!configOrq) {
        console.warn(`[ELYON] ⚠️ Configuração do orquestrador não encontrada para tenant ${lead.tenantId}`);
        return;
      }

      if (briefingEmpreendimento) {
        configOrq.briefingEmpreendimento = briefingEmpreendimento;
      }

      const contextoOrq = {
        telefone: lead.telefone || '',
        contatoId: undefined,
        leadId: lead.id,
        statusLead: (lead as any).status,
        doresIdentificadas: (lead as any).doresIdentificadas || [],
        empreendimento: nomeEmpreendimento,
        situacaoAtual: (lead as any).situacaoAtual || undefined,
        tipoAutorizacao: (lead as any).tipoAutorizacao || undefined,
        comissaoAcordada: (lead as any).comissaoAcordada || undefined,
        prazoTrabalho: (lead as any).prazoTrabalho || undefined
      };

      const resultadoOrq = await processarMensagemOrquestrada(
        mensagensOpenAI as any,
        configOrq,
        contextoOrq as any
      );

      if (!resultadoOrq.sucesso || !resultadoOrq.resposta) {
        console.warn(`[ELYON] ⚠️ Orquestrador não retornou resposta válida para lead ${leadId}`);
        return;
      }

      const respostaTexto = resultadoOrq.resposta;

      if (lead.telefone) {
        const sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
          where: { tenantId: lead.tenantId, status: 'CONECTADO' }
        });

        if (sessaoWhatsapp && sessaoWhatsapp.instanceName) {
          const whatsappService = getWhatsAppService(sessaoWhatsapp.instanceName);
          await whatsappService.enviarMensagemTexto(lead.telefone, respostaTexto);
          console.log(`[ELYON] 📤 Resposta enviada para ${lead.telefone} usando instância ${sessaoWhatsapp.instanceName}`);
        } else {
          console.warn(`[ELYON] ⚠️  Sessão WhatsApp não encontrada ou desconectada para tenant ${lead.tenantId}`);
        }
      } else {
        console.warn(`[ELYON] ⚠️  Lead sem telefone cadastrado, resposta não enviada`);
      }

      const conversaId = historicoDb[0]?.conversaId;
      if (conversaId) {
        await prisma.mensagem.create({
          data: {
            conversaId: conversaId,
            remetente: 'assistente',
            conteudo: respostaTexto,
            tipo: 'texto',
            enviadaEm: new Date()
          }
        });
        console.log(`[ELYON] 💾 Resposta salva no banco`);
      } else {
        console.warn(`[ELYON] ⚠️  Conversa não encontrada, mensagem não salva`);
      }

      console.log(`[ELYON] ✨ Processamento completo com sucesso`);
      return;

    } catch (error) {
      console.error('[ELYON] 💥 Erro ao processar mensagem:', error);

      // TODO: Implementar sistema de fallback/retry
      // Por enquanto, apenas loga o erro
    }
  }

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
              const resultadoConversao = await converterParaLeadTool.execute({
                contatoId: contato.id,
                tipoInteresse: 'VENDA',
                temperatura: 'QUENTE',
                timeline: matchTimeline?.[1] || 'não informado',
                quartos: matchQuartos ? parseInt(matchQuartos[1]) : undefined,
                observacoes: `[FISCALIZAÇÃO ELYON] Conversão automática: Lead aceitou anunciar/agendar mas SDR não chamou tool. Detectado: ${sinaisFechamento.find(r => r.test(mensagensLead))}`
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

  /**
   * Retorna informações sobre o ELYON (para monitoring/debug)
   */
  getStatus(): {
    version: string;
    workersDisponiveis: string[];
    supervisorAtivo: boolean;
    ragConversasAtivo: boolean;
    estaAtivo: boolean;
  } {
    return {
      version: '0.5.0-alpha',
      workersDisponiveis: ['SDR', 'DOCUMENTOS'],
      supervisorAtivo: true,
      ragConversasAtivo: true,
      estaAtivo: true
    };
  }
}

// Exportar instância única (singleton)
export const elyonCore = new ElyonCore();
