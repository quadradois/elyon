import { Router } from 'express';
import { prisma } from '../servidor';
import { openaiService } from '../servicos/openai';
import { elyonCore } from '../agentes/elyon-core';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { event, type, instance, data, sender } = req.body;

    console.log('--- WEBHOOK RECEBIDO ---');
    console.log('Event:', event || type);
    // Log detalhado para debug
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // Suporta tanto 'event' (novo) quanto 'type' (antigo)
    const eventType = event || type;

    if (eventType === 'MESSAGES_UPSERT' || eventType === 'messages.upsert') {
      // Normalização das mensagens: Evolution pode enviar um array em data.messages ou um objeto único em data
      let messages: any[] = [];
      
      if (Array.isArray(data)) {
        messages = data;
      } else if (data?.messages && Array.isArray(data.messages)) {
        messages = data.messages;
      } else if (data?.data) {
        // Formato legado ou específico
        messages = [data.data];
      } else if (data) {
        // Tenta usar o próprio data como mensagem se não for nenhum dos anteriores
        messages = [data];
      }

      console.log(`[Webhook] Processando ${messages.length} mensagens...`);

      for (const message of messages) {
        try {
          if (!message || !message.key) {
             console.warn('[Webhook] Mensagem inválida ignorada:', message);
             continue;
          }

          const remoteJid = message.key.remoteJid;
          const fromMe = message.key.fromMe;
          
          if (fromMe) {
            console.log('[Webhook] Ignorando mensagem enviada por mim (fromMe=true)');
            continue;
          }

          if (remoteJid) {
            // Mensagem recebida de um cliente
            
            // Lógica para garantir que pegamos o número de telefone e não o LID
            let targetJid = remoteJid;
            const remoteJidAlt = message.key.remoteJidAlt;

            if (targetJid.includes('@lid') && remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net')) {
                console.log(`[Webhook] Trocando remoteJid (LID) por remoteJidAlt (Phone): ${remoteJidAlt}`);
                targetJid = remoteJidAlt;
            }

            const telefone = targetJid.split('@')[0];
            const texto = message.message?.conversation || message.message?.extendedTextMessage?.text;
            
            // Verifica se é mídia
            const messageType = message.messageType || (message.message?.imageMessage ? 'imageMessage' : (message.message?.audioMessage ? 'audioMessage' : 'conversation'));
            const isImage = messageType === 'imageMessage';
            const isAudio = messageType === 'audioMessage';
            const isMedia = isImage || isAudio;

            if (texto || isMedia) {
              console.log(`[Webhook] Mensagem de ${telefone}. Texto: ${texto || '[Mídia]'}`);

              // 1. Buscar Lead pelo telefone (tenta formatos variados)
              const ultimosDigitos = telefone.slice(-8);
              
              const lead = await prisma.lead.findFirst({
                where: {
                  telefone: {
                    contains: ultimosDigitos
                  }
                }
              });

              let leadId = lead?.id;

              // Se não encontrar o lead, cria um novo automaticamente
              if (!lead) {
                console.log(`[Webhook] Lead não encontrado. Criando novo lead para ${telefone}...`);
                
                // Busca tenant padrão (primeiro encontrado)
                const tenant = await prisma.tenant.findFirst();
                if (!tenant) {
                    console.error('[Webhook] ERRO: Nenhum tenant encontrado para vincular o lead.');
                    continue; // Pula para a próxima mensagem
                }

                const novoLead = await prisma.lead.create({
                  data: {
                    nome: message.pushName || `Lead WhatsApp ${telefone}`,
                    telefone: telefone,
                    status: 'NOVO',
                    temperatura: 'FRIO',
                    origem: 'WHATSAPP_INBOUND',
                    tenantId: tenant.id,
                    // cpf é opcional agora
                  }
                });
                leadId = novoLead.id;
                console.log(`[Webhook] Novo lead criado: ${novoLead.nome} (${novoLead.id})`);
              }

              if (leadId) {
                console.log(`[Webhook] Processando mensagem para lead ${leadId}`);

                // 2. Buscar ou Criar Conversa Ativa
                let conversa = await prisma.conversa.findFirst({
                  where: {
                    leadId: leadId,
                    canal: 'WHATSAPP',
                    estadoConversa: 'ativa'
                  }
                });

                if (!conversa) {
                  conversa = await prisma.conversa.create({
                    data: {
                      leadId: leadId,
                      canal: 'WHATSAPP',
                      numeroOrigem: remoteJid.replace('@s.whatsapp.net', ''),
                      estadoConversa: 'ativa',
                      contexto: {}
                    }
                  });
                }

                // 3. Identificar Tipo de Mensagem e Conteúdo
                let tipoMensagem = 'TEXTO';
                let conteudoMensagem = texto || '';
                let urlMidia = null;

                if (isMedia) {
                    tipoMensagem = isImage ? 'IMAGEM' : 'AUDIO';
                    
                    // Tenta pegar o Base64 (Evolution manda se webhookBase64: true)
                    // A estrutura pode variar, vamos tentar achar o base64
                    // Log mostra que está em message.message.base64
                    const base64 = data.base64 || message.base64 || message.message?.base64 || message.message?.imageMessage?.jpegThumbnail; 
                    
                    if (base64) {
                        const mime = isImage ? 'image/jpeg' : 'audio/ogg'; 
                        urlMidia = `data:${mime};base64,${base64}`;
                        conteudoMensagem = isImage ? (message.message?.imageMessage?.caption || '') : ''; 

                        // SE FOR ÁUDIO: Transcrever
                        if (isAudio) {
                            try {
                                console.log('[Webhook] Transcrevendo áudio...');
                                const transcricao = await openaiService.transcreverAudioBase64(base64);
                                conteudoMensagem = transcricao;
                                console.log(`[Webhook] Transcrição: "${transcricao}"`);
                            } catch (err) {
                                console.error('[Webhook] Falha na transcrição:', err);
                                conteudoMensagem = '[Áudio sem transcrição]';
                            }
                        }

                    } else {
                        conteudoMensagem = '[Mídia recebida]';
                        console.warn('[Webhook] Mídia recebida sem base64 explícito.');
                    }
                }

                // 4. Salvar Mensagem
                await prisma.mensagem.create({
                  data: {
                    conversaId: conversa.id,
                    remetente: 'usuario',
                    conteudo: conteudoMensagem,
                    tipo: tipoMensagem.toLowerCase(),
                    metadata: urlMidia ? { urlMidia } : undefined,
                    enviadaEm: new Date((message.messageTimestamp || Date.now() / 1000) * 1000)
                  }
                });
                
                // Atualizar última interação do lead
                try {
                    await prisma.lead.update({
                      where: { id: leadId },
                      data: { ultimaInteracao: new Date() }
                    });
                } catch (e) {
                    console.warn('[Webhook] Aviso: Não foi possível atualizar ultimaInteracao');
                }
                
                console.log(`[Webhook] Mensagem salva para o lead ${leadId}`);

                // 5. Acionar Agente Mestre
                // Fire-and-forget para não travar o webhook (ou await se quisermos garantir)
                // Vamos usar await por enquanto para debug
                await elyonCore.processarMensagem(leadId, conteudoMensagem, tipoMensagem as any);
              }
            }
          }
        } catch (msgError) {
          console.error('[Webhook] Erro ao processar mensagem individual:', msgError);
          // Continua para a próxima mensagem
        }
      }
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
