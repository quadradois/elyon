import { prisma } from '../servidor';
import { whatsappService } from '../servicos/whatsapp';
import { sdrWorker } from './workers/sdr-worker';

/**
 * ELYON CORE
 * 
 * Orquestrador mestre do sistema multi-agentes.
 * 
 * Responsabilidades:
 * - Receber mensagens do webhook
 * - Identificar tenant e carregar configurações
 * - Delegar para o worker apropriado (SDR, Documentos, etc.)
 * - Retornar resposta para o WhatsApp
 * 
 * Arquitetura:
 * WhatsApp → Webhook → ELYON → Worker → ELYON → WhatsApp
 */

export class ElyonCore {
  
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

      // 2. Recuperar Histórico da Conversa
      const historicoDb = await prisma.mensagemConversa.findMany({
        where: {
          conversa: {
            leadId: leadId,
            status: 'ATIVA'
          }
        },
        orderBy: { enviadaEm: 'desc' },
        take: 10 // Últimas 10 mensagens para contexto
      });

      // Formatar histórico para OpenAI (ordem cronológica)
      const mensagensOpenAI = historicoDb.reverse().map(msg => ({
        role: msg.papel === 'USUARIO' ? 'user' : 'assistant',
        content: msg.conteudo
      }));

      console.log(`[ELYON] 💬 Histórico carregado: ${mensagensOpenAI.length} mensagens`);

      // 3. DELEGAÇÃO: Determinar qual worker usar
      // Por enquanto sempre usa SDR, mas no futuro pode ser dinâmico:
      // - Se lead já qualificado → Document Worker
      // - Se pediu agendamento → Scheduling Worker
      // - Senão → SDR Worker
      
      const workerSelecionado = 'SDR'; // Simplificado para MVP
      
      console.log(`[ELYON] 🤖 Delegando para worker: ${workerSelecionado}`);

      // 4. Executar Worker
      let respostaTexto: string;
      
      if (workerSelecionado === 'SDR') {
        respostaTexto = await sdrWorker.processar(mensagensOpenAI as any, leadId);
      } else {
        // Futuramente: outros workers
        respostaTexto = 'Desculpe, estou com dificuldades no momento.';
      }

      console.log(`[ELYON] ✅ Resposta do ${workerSelecionado}: "${respostaTexto.substring(0, 80)}..."`);

      // 5. Enviar Resposta no WhatsApp
      if (lead.telefone) {
        await whatsappService.enviarMensagemTexto(lead.telefone, respostaTexto);
        console.log(`[ELYON] 📤 Resposta enviada para ${lead.telefone}`);
      } else {
        console.warn(`[ELYON] ⚠️  Lead sem telefone cadastrado, resposta não enviada`);
      }

      // 6. Salvar Resposta no Banco de Dados
      const conversaId = historicoDb[0]?.conversaId;
      
      if (conversaId) {
        await prisma.mensagemConversa.create({
          data: {
            conversaId: conversaId,
            papel: 'ASSISTENTE',
            conteudo: respostaTexto,
            tipo: 'TEXTO',
            enviadaEm: new Date()
          } as any
        });
        console.log(`[ELYON] 💾 Resposta salva no banco`);
      } else {
        console.warn(`[ELYON] ⚠️  Conversa não encontrada, mensagem não salva`);
      }

      console.log(`[ELYON] ✨ Processamento completo com sucesso`);

    } catch (error) {
      console.error('[ELYON] 💥 Erro ao processar mensagem:', error);
      
      // TODO: Implementar sistema de fallback/retry
      // Por enquanto, apenas loga o erro
    }
  }
  
  /**
   * Retorna informações sobre o ELYON (para monitoring/debug)
   */
  getStatus(): {
    version: string;
    workersDisponiveis: string[];
    estaAtivo: boolean;
  } {
    return {
      version: '0.1.0-alpha',
      workersDisponiveis: ['SDR'],
      estaAtivo: true
    };
  }
}

// Exportar instância única (singleton)
export const elyonCore = new ElyonCore();
