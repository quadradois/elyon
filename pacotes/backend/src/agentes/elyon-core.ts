import { prisma } from '../servidor';
import { whatsappService } from '../servicos/whatsapp';
import { sdrWorker, ConfiguracaoAgente, configPadrao } from './workers/sdr-worker';
import { documentosWorker } from './workers/documentos-worker';
import { supervisor, ContextoSupervisao } from './supervisor';
import { ragConversasService } from '../servicos/rag-conversas';

/**
 * ELYON CORE v0.5.0
 * 
 * Orquestrador mestre do sistema multi-agentes.
 * 
 * Responsabilidades:
 * - Receber mensagens do webhook
 * - Identificar tenant e carregar configurações
 * - Carregar contexto RAG (empreendimentos + conversas anteriores + PERFIL IMOBILIÁRIA)
 * - Delegar para o worker apropriado (SDR, Documentos, etc.)
 * - SUPERVISIONAR a qualidade das respostas antes do envio
 * - Retornar resposta para o WhatsApp
 * - Processar conversas finalizadas para RAG
 * 
 * Arquitetura:
 * WhatsApp → Webhook → ELYON → Worker → SUPERVISOR → ELYON → WhatsApp
 *                                              ↓
 *                                        RAG Conversas
 */

export class ElyonCore {
  
  /**
   * Converte a configuração do banco para o formato do SDR Worker
   */
  private converterConfiguracao(
    configDb: any, 
    tenantNome: string
  ): ConfiguracaoAgente {
    if (!configDb) {
      return { ...configPadrao, tenantNome };
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
      }
    };
  }
  
  /**
   * Extrai o RAG do perfil da imobiliária da configuração
   */
  private extrairRagPerfil(configDb: any): string | undefined {
    if (!configDb) return undefined;
    
    // ragPerfil é o texto sintetizado do quiz de perfil da imobiliária
    return configDb.ragPerfil || undefined;
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
   * Baseado no estágio do lead e conteúdo da mensagem
   */
  private selecionarWorker(lead: any, mensagem: string): 'SDR' | 'DOCUMENTOS' {
    // Palavras-chave que indicam contexto de documentação
    const palavrasDocumentos = [
      'documento', 'documentação', 'rg', 'cpf', 'matrícula', 'matricula',
      'iptu', 'certidão', 'certidao', 'comprovante', 'procuração', 'procuracao',
      'contrato social', 'enviar', 'enviei', 'foto', 'arquivo', 'anexo'
    ];
    
    const mensagemLower = mensagem.toLowerCase();
    const mencionaDocumentos = palavrasDocumentos.some(p => mensagemLower.includes(p));
    
    // Se lead já foi qualificado como QUENTE e menciona documentos
    if (lead.temperatura === 'QUENTE' && mencionaDocumentos) {
      return 'DOCUMENTOS';
    }
    
    // Se o estágio do lead indica coleta de documentos
    // @ts-ignore
    if (lead.estagio === 'DOCUMENTACAO' || lead.estagio === 'CAPTACAO') {
      return 'DOCUMENTOS';
    }
    
    // Default: SDR para qualificação
    return 'SDR';
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
      // 1. Recuperar Lead + Tenant + Configuração do Agente
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          tenant: {
            include: {
              configuracaoAgente: true
            }
          }
        }
      });

      if (!lead) {
        console.error(`[ELYON] ❌ Lead ${leadId} não encontrado no banco`);
        return;
      }

      console.log(`[ELYON] 📋 Lead encontrado: ${lead.nome} (Tenant: ${lead.tenant.nome})`);
      
      // 2. Converter configuração do agente
      const configAgente = this.converterConfiguracao(
        lead.tenant.configuracaoAgente,
        lead.tenant.nome
      );
      console.log(`[ELYON] 🤖 Agente: ${configAgente.nome} (tom: ${configAgente.personalidade.tom})`);
      
      // 2.1. Extrair RAG do perfil da imobiliária (política de trabalho)
      const ragPerfil = this.extrairRagPerfil(lead.tenant.configuracaoAgente);

      // 3. Recuperar Histórico da Conversa
      const historicoDb = await prisma.mensagem.findMany({
        where: {
          conversa: {
            leadId: leadId,
            estadoConversa: 'ativa'
          }
        },
        orderBy: { enviadaEm: 'desc' },
        take: 10 // Últimas 10 mensagens para contexto
      });

      // Formatar histórico para OpenAI (ordem cronológica)
      const mensagensOpenAI = historicoDb.reverse().map((msg: any) => ({
        role: msg.remetente === 'usuario' ? 'user' : 'assistant',
        content: msg.conteudo
      }));

      console.log(`[ELYON] 💬 Histórico carregado: ${mensagensOpenAI.length} mensagens`);
      
      // 4. Buscar contexto RAG (perfil imobiliária + empreendimento + conversas anteriores)
      // @ts-ignore - campanhaOrigemId pode existir no lead
      const campanhaId = lead.campanhaOrigemId;
      const contextoRAG = await this.buscarContextoRAG(
        lead.tenantId,
        campanhaId,
        mensagemUsuario, // Passar mensagem para buscar conversas similares
        ragPerfil // RAG do perfil da imobiliária
      );
      
      if (contextoRAG) {
        console.log(`[ELYON] 📚 Contexto RAG carregado (${contextoRAG.length} caracteres)`);
      }

      // 5. DELEGAÇÃO: Determinar qual worker usar
      // Lógica de seleção baseada no estágio do lead
      const workerSelecionado = this.selecionarWorker(lead, mensagemUsuario);
      
      console.log(`[ELYON] 🤖 Delegando para worker: ${workerSelecionado}`);

      // 6. Executar Worker com configuração e contexto
      let respostaWorker: string;
      let workerAtual = workerSelecionado;
      let tentativas = 0;
      const maxTentativas = 2;
      
      while (tentativas < maxTentativas) {
        tentativas++;
        
        if (workerAtual === 'DOCUMENTOS') {
          respostaWorker = await documentosWorker.processar(
            mensagensOpenAI as any, 
            leadId,
            configAgente,
            {
              tipoOperacao: (lead as any).interesse || undefined,
              documentosPendentes: [] // Futuramente: buscar do banco
            }
          );
        } else {
          // Default: SDR Worker
          respostaWorker = await sdrWorker.processar(
            mensagensOpenAI as any, 
            leadId,
            configAgente,
            contextoRAG
          );
        }

        console.log(`[ELYON] 📝 Resposta do ${workerAtual}: "${respostaWorker.substring(0, 80)}..."`);

        // 7. SUPERVISÃO: Analisar qualidade antes de enviar
        const contextoSupervisao: ContextoSupervisao = {
          leadId,
          mensagemUsuario,
          respostaWorker,
          workerOrigem: workerAtual as any,
          historicoRecente: mensagensOpenAI as any,
          temperatura: (lead as any).temperatura
        };

        const resultadoSupervisao = await supervisor.supervisionar(contextoSupervisao);
        
        console.log(`[ELYON] 🔍 Supervisão: ${resultadoSupervisao.acao} (confiança: ${resultadoSupervisao.metricasQualidade.confianca}%)`);

        // Se supervisor sugerir mudar de worker, tentar novamente
        if (resultadoSupervisao.acao === 'MUDAR_WORKER' && resultadoSupervisao.novoWorker) {
          console.log(`[ELYON] 🔄 Mudando para worker ${resultadoSupervisao.novoWorker}`);
          workerAtual = resultadoSupervisao.novoWorker as any;
          continue;
        }

        // Usar resposta final do supervisor (pode ser original, refinada ou de escalação)
        const respostaTexto = resultadoSupervisao.respostaFinal;

        // 8. Enviar Resposta no WhatsApp
        if (lead.telefone) {
          await whatsappService.enviarMensagemTexto(lead.telefone, respostaTexto);
          console.log(`[ELYON] 📤 Resposta enviada para ${lead.telefone}`);
        } else {
          console.warn(`[ELYON] ⚠️  Lead sem telefone cadastrado, resposta não enviada`);
        }

        // 9. Salvar Resposta no Banco de Dados
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
          
          // Salvar métricas de qualidade para analytics
          // TODO: Criar tabela MetricasMensagem para armazenar isso
        } else {
          console.warn(`[ELYON] ⚠️  Conversa não encontrada, mensagem não salva`);
        }

        // Se houve alerta para corretor, registrar
        if (resultadoSupervisao.alertaCorretor) {
          console.log(`[ELYON] 🚨 Alerta enviado para corretor (risco: ${resultadoSupervisao.metricasQualidade.riscoEscalacao}%)`);
          // TODO: Implementar notificação WebSocket para dashboard
        }

        console.log(`[ELYON] ✨ Processamento completo com sucesso`);
        return; // Sucesso, sair do loop
      }

      console.warn(`[ELYON] ⚠️  Máximo de tentativas atingido`);

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
