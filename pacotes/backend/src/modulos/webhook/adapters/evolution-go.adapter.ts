const TIPOS_MIDIA_WHATSMEOW = [
  'imageMessage',
  'audioMessage',
  'videoMessage',
  'documentMessage',
  'stickerMessage',
  'documentWithCaptionMessage',
];

export interface MetadadosMidiaWebhook {
  caption?: string;
  fileName?: string;
  mimeType?: string;
  url?: string;
  base64?: string;
}

export function extrairMetadadosMidia(message: any, messageType: string): MetadadosMidiaWebhook {
  const payload = message?.message || {};
  const campoDireto = payload?.[messageType] || {};
  const campoDocumento = payload?.documentWithCaptionMessage?.message?.documentMessage || {};
  const campo = Object.keys(campoDireto).length > 0 ? campoDireto : campoDocumento;
  const base64 = campo?.base64
    || campo?.media
    || payload?.base64
    || message?.base64
    || message?.mediaBase64
    || message?.message?.base64
    || message?.message?.mediaBase64;

  return {
    caption: campo?.caption || payload?.extendedTextMessage?.text || undefined,
    fileName: campo?.fileName || campo?.title || undefined,
    mimeType: campo?.mimetype || undefined,
    url: campo?.url || campo?.mediaUrl || message?.mediaUrl || undefined,
    base64: typeof base64 === 'string' && !base64.startsWith('http') ? base64 : undefined,
  };
}

export function montarResumoMidiaParaIA(
  messageType: string,
  meta: Pick<MetadadosMidiaWebhook, 'caption' | 'fileName' | 'mimeType'>,
  analiseAutomatica?: string | null,
): string {
  const legenda = meta.caption ? ` | legenda: "${meta.caption}"` : '';
  const analise = analiseAutomatica ? ` | análise: ${analiseAutomatica}` : '';
  if (messageType === 'imageMessage') return `[MÍDIA RECEBIDA: imagem enviada pelo lead${legenda}${analise}]`;
  if (messageType === 'audioMessage') return `[MÍDIA RECEBIDA: áudio enviado pelo lead${analise}]`;
  if (messageType === 'videoMessage') return `[MÍDIA RECEBIDA: vídeo enviado pelo lead${legenda}${analise}]`;
  if (messageType === 'documentMessage' || messageType === 'documentWithCaptionMessage') {
    const nome = meta.fileName ? ` | arquivo: "${meta.fileName}"` : '';
    const mime = meta.mimeType ? ` | mime: ${meta.mimeType}` : '';
    return `[MÍDIA RECEBIDA: anexo/documento enviado pelo lead${nome}${mime}${legenda}${analise}]`;
  }
  return `[MÍDIA RECEBIDA pelo lead${analise ? ` | análise: ${analiseAutomatica}` : ''}]`;
}

function converterMensagemWhatsmeow(data: any): any | null {
  if (!data) return null;
  if (data.key) return data;
  const info = data.Info || data.info;
  const conteudo = data.Message || data.message;
  if (!info) return null;

  let messageType = 'conversation';
  const message: any = {};
  if (conteudo && typeof conteudo === 'object') {
    if (typeof conteudo.conversation === 'string') message.conversation = conteudo.conversation;
    if (conteudo.extendedTextMessage) message.extendedTextMessage = conteudo.extendedTextMessage;
    for (const tipo of TIPOS_MIDIA_WHATSMEOW) {
      if (!conteudo[tipo]) continue;
      messageType = tipo;
      const midia = { ...conteudo[tipo] };
      if (conteudo.base64) midia.base64 = conteudo.base64;
      if (conteudo.mediaUrl) midia.mediaUrl = conteudo.mediaUrl;
      if (conteudo.mimetype && !midia.mimetype) midia.mimetype = conteudo.mimetype;
      delete midia.url;
      message[tipo] = midia;
      break;
    }
  }

  const timestamp = info.Timestamp ?? info.timestamp;
  let messageTimestamp: number | undefined;
  if (typeof timestamp === 'number') messageTimestamp = timestamp;
  if (typeof timestamp === 'string') {
    const milissegundos = Date.parse(timestamp);
    if (!Number.isNaN(milissegundos)) messageTimestamp = Math.floor(milissegundos / 1000);
  }

  return {
    key: {
      remoteJid: info.Chat || info.chat || '',
      fromMe: !!(info.IsFromMe ?? info.isFromMe),
      id: info.ID || info.id,
      remoteJidAlt: info.SenderAlt || info.senderAlt,
    },
    message,
    messageType,
    messageTimestamp,
    pushName: info.PushName || info.pushName,
    mediaUrl: conteudo?.mediaUrl,
  };
}

export function normalizarWebhookEvolutionGo(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const evento = body.event;
  if (!evento || body.instance) return body;
  const eventoNormalizado = String(evento).toLowerCase();
  const instance = body.instanceName || body.instance;
  if (eventoNormalizado === 'connected' || eventoNormalizado === 'pairsuccess') {
    return { event: 'CONNECTION_UPDATE', instance, data: { ...(body.data || {}), state: 'open' } };
  }
  if (['disconnected', 'loggedout', 'connectfailure'].includes(eventoNormalizado)) {
    return { event: 'CONNECTION_UPDATE', instance, data: { ...(body.data || {}), state: 'close' } };
  }
  if (eventoNormalizado === 'qrcode' || eventoNormalizado === 'qrtimeout') {
    return { event: 'CONNECTION_UPDATE', instance, data: { state: 'connecting' } };
  }
  if (['message', 'messages.upsert', 'messages_upsert'].includes(eventoNormalizado)) {
    const mensagem = converterMensagemWhatsmeow(body.data);
    if (!mensagem) return body;
    return { event: 'MESSAGES_UPSERT', instance, data: mensagem };
  }
  return { event: evento, instance, data: body.data };
}
