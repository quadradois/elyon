/**
 * WEBHOOK NORMALIZER
 * 
 * Responsável por sanear e padronizar os payloads da Evolution API.
 * Isola a lógica de "parsing" do controller principal.
 */

export interface MensagemEntrada {
    tipo: 'TEXTO' | 'IMAGEM' | 'AUDIO' | 'DESCONHECIDO';
    conteudo: string;
    telefone: string;
    remoteJid: string;
    messageId: string;
    timestamp: number;
    instancia: string;
    isFromMe: boolean;
    urlMidia?: string;
    base64?: string;
    mimetype?: string;
    pushName?: string;
}

export class WebhookNormalizer {
    /**
     * Converte o payload bruto do Webhook em uma estrutura limpa
     */
    static normalizar(body: any): MensagemEntrada[] {
        const mensagensLimpas: MensagemEntrada[] = [];

        try {
            const { event, type, instance, data } = body;

            // 1. Normalizar Instância
            const instancia = instance || process.env.EVOLUTION_INSTANCE_NAME || 'elyon_main';

            // 2. Normalizar Tipo de Evento
            const eventType = event || type;
            if (eventType !== 'MESSAGES_UPSERT' && eventType !== 'messages.upsert') {
                return []; // Ignora outros eventos por enquanto
            }

            // 3. Normalizar Lista de Mensagens
            let messages: any[] = [];
            if (Array.isArray(data)) {
                messages = data;
            } else if (data?.messages && Array.isArray(data.messages)) {
                messages = data.messages;
            } else if (data?.data) {
                messages = [data.data];
            } else if (data) {
                messages = [data];
            }

            // 4. Processar cada mensagem
            for (const msg of messages) {
                if (!msg || !msg.key) continue;

                const isFromMe = msg.key.fromMe || false;
                const messageId = msg.key.id;
                const pushName = msg.pushName;
                const timestamp = (msg.messageTimestamp || Date.now() / 1000) * 1000;

                // Resolver RemoteJID e Telefone
                let remoteJid = msg.key.remoteJid;
                const remoteJidAlt = msg.key.remoteJidAlt;

                if (remoteJid && remoteJid.includes('@lid') && remoteJidAlt) {
                    remoteJid = remoteJidAlt;
                }

                if (!remoteJid) continue;

                const telefone = remoteJid.split('@')[0];

                // Extrair Conteúdo e Tipo
                const messageContent = msg.message;
                if (!messageContent) continue;

                let tipo: MensagemEntrada['tipo'] = 'DESCONHECIDO';
                let conteudo = '';
                let base64: string | undefined;
                let mimetype: string | undefined;

                // Texto Simples
                if (messageContent.conversation) {
                    tipo = 'TEXTO';
                    conteudo = messageContent.conversation;
                }
                // Texto Extendido
                else if (messageContent.extendedTextMessage?.text) {
                    tipo = 'TEXTO';
                    conteudo = messageContent.extendedTextMessage.text;
                }
                // Imagem
                else if (messageContent.imageMessage) {
                    tipo = 'IMAGEM';
                    conteudo = messageContent.imageMessage.caption || '';
                    base64 = msg.base64 || messageContent.imageMessage.jpegThumbnail; // Evolution geralmente manda base64 no root do data
                    mimetype = messageContent.imageMessage.mimetype || 'image/jpeg';
                }
                // Áudio
                else if (messageContent.audioMessage) {
                    tipo = 'AUDIO';
                    conteudo = ''; // Será transcrito depois
                    base64 = msg.base64; // Evolution manda base64 no root
                    mimetype = messageContent.audioMessage.mimetype || 'audio/ogg';
                }

                if (tipo !== 'DESCONHECIDO') {
                    mensagensLimpas.push({
                        tipo,
                        conteudo,
                        telefone,
                        remoteJid,
                        messageId,
                        timestamp,
                        instancia,
                        isFromMe,
                        base64,
                        mimetype,
                        pushName
                    });
                }
            }

        } catch (error) {
            console.error('[WebhookNormalizer] Erro ao normalizar:', error);
        }

        return mensagensLimpas;
    }
}
