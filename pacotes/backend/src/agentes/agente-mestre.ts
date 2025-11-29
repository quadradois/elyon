import { prisma } from '../servidor';
import { openaiService } from '../servicos/openai';
import { whatsappService } from '../servicos/whatsapp';

export class AgenteMestre {
  
  async processarMensagem(leadId: string, mensagemUsuario: string, tipo: 'TEXTO' | 'AUDIO' | 'IMAGEM'): Promise<void> {
    console.log(`[Agente] Processando mensagem do Lead ${leadId} (${tipo})`);

    try {
      // 1. Recuperar Histórico Recente (últimas 10 mensagens)
      const historicoDb = await prisma.mensagemConversa.findMany({
        where: {
          conversa: {
            leadId: leadId,
            status: 'ATIVA'
          }
        },
        orderBy: { enviadaEm: 'desc' },
        take: 10
      });

      // Formatar para OpenAI (inverter ordem para ficar cronológico)
      const mensagensOpenAI = historicoDb.reverse().map(msg => ({
        role: msg.papel === 'USUARIO' ? 'user' : 'assistant',
        content: msg.conteudo
      }));

      // Adicionar a mensagem atual se ela ainda não estiver no banco (o webhook salva antes, mas vamos garantir)
      // Nota: O webhook já salva a mensagem do usuário antes de chamar o agente, então ela deve estar no históricoDb.
      // Se não estiver (race condition), poderíamos adicionar aqui. Mas vamos assumir que está.

      // 2. Montar Prompt do Sistema
      const systemPrompt = {
        role: 'system',
        content: `Você é o ELYON, um assistente virtual inteligente e proativo da imobiliária Quadra Dois.
        Seu objetivo é qualificar leads, tirar dúvidas sobre imóveis e agendar visitas.
        Seja cordial, profissional e use emojis moderadamente.
        Responda de forma concisa (máximo 2 parágrafos).
        Se o usuário mandar áudio, responda como se tivesse ouvido.`
      };

      // 3. Gerar Resposta
      const respostaTexto = await openaiService.gerarResposta([
        systemPrompt as any,
        ...mensagensOpenAI as any
      ]);

      console.log(`[Agente] Resposta gerada: ${respostaTexto}`);

      // 4. Enviar Resposta no WhatsApp
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (lead && lead.telefone) {
        await whatsappService.enviarMensagemTexto(lead.telefone, respostaTexto);
      }

      // 5. Salvar Resposta no Banco
      // Precisamos do ID da conversa. Pegamos da primeira mensagem do histórico ou buscamos.
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
      }

    } catch (error) {
      console.error('[Agente] Erro ao processar mensagem:', error);
    }
  }
}

export const agenteMestre = new AgenteMestre();
