/**
 * Serviço de Captura de Documentos via WhatsApp
 *
 * Quando um cliente envia mídia (imagem, documento, áudio, vídeo)
 * via WhatsApp, este serviço:
 *   1. Detecta o tipo e extrai a URL da Evolution API
 *   2. Faz o download do arquivo
 *   3. Faz o upload para o S3 na pasta do lead
 *   4. Cria o registro em DocumentoLead
 *
 * Chamado de forma não-bloqueante (fire-and-forget) no webhook.
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../lib/s3';
import { prisma } from '../lib/db';

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'rag-eloyn';
const CAPTURA_DOCS_INCLUIR_AUDIO = process.env.CAPTURA_DOCS_INCLUIR_AUDIO === 'true';

// ─── Tipos de mídia suportados ────────────────────

interface DadosMidia {
  url?: string;
  base64?: string;
  mimetype?: string;
  fileName?: string;
  fileLength?: number;
  caption?: string;
}

export interface EventoMidia {
  message: any;        // Payload bruto da Evolution API
  messageType: string; // imageMessage | audioMessage | documentMessage | videoMessage
  leadId: string;
  tenantId: string;
}

// Mapeamento de messageType → mime padrão fallback
const MIME_FALLBACK: Record<string, string> = {
  imageMessage:    'image/jpeg',
  audioMessage:    'audio/ogg',
  videoMessage:    'video/mp4',
  documentMessage: 'application/octet-stream',
};

// Mapeamento de messageType → tipo no banco
const TIPO_DOCUMENTO: Record<string, string> = {
  imageMessage:    'imagem',
  audioMessage:    'audio',
  videoMessage:    'video',
  documentMessage: 'documento',
};

// Extensão padrão quando não há filename
const EXTENSAO_FALLBACK: Record<string, string> = {
  imageMessage:    '.jpg',
  audioMessage:    '.ogg',
  videoMessage:    '.mp4',
  documentMessage: '.bin',
};

// ─── Extrai dados de mídia do payload ────────────

function extrairDadosMidia(message: any, messageType: string): DadosMidia | null {
  const campoMensagem = message.message?.[messageType];
  if (!campoMensagem) return null;

  return {
    url:        campoMensagem.url          || campoMensagem.mediaUrl || message.mediaUrl,
    base64:     campoMensagem.base64       || message.message?.base64 || message.base64,
    mimetype:   campoMensagem.mimetype     || MIME_FALLBACK[messageType],
    fileName:   campoMensagem.fileName     || campoMensagem.title,
    fileLength: campoMensagem.fileLength   || campoMensagem.fileSize,
    caption:    campoMensagem.caption,
  };
}

// Determina extensão a partir do mimetype ou filename
function determinarExtensao(dados: DadosMidia, messageType: string): string {
  if (dados.fileName) {
    const ext = dados.fileName.lastIndexOf('.');
    if (ext >= 0) return dados.fileName.substring(ext);
  }

  const mime = dados.mimetype || '';
  if (mime.includes('pdf'))       return '.pdf';
  if (mime.includes('jpeg'))      return '.jpg';
  if (mime.includes('png'))       return '.png';
  if (mime.includes('webp'))      return '.webp';
  if (mime.includes('ogg'))       return '.ogg';
  if (mime.includes('mp4'))       return '.mp4';
  if (mime.includes('mpeg'))      return '.mp3';
  if (mime.includes('word'))      return '.docx';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '.xlsx';

  return EXTENSAO_FALLBACK[messageType] || '.bin';
}

// ─── Função principal ─────────────────────────────

/**
 * Captura um documento recebido via WhatsApp e salva no S3 + banco.
 * Deve ser chamada de forma não-bloqueante (sem await no webhook).
 */
export async function capturarDocumentoWhatsapp(evento: EventoMidia): Promise<void> {
  const { message, messageType, leadId, tenantId } = evento;

  try {
    const dados = extrairDadosMidia(message, messageType);
    if (!dados?.url && !dados?.base64) {
      console.log(`[CapturaDoc] ⚠️ Sem URL/base64 de mídia para ${messageType} — ignorando`);
      return;
    }

    console.log(`[CapturaDoc] 📥 Capturando ${messageType} do lead ${leadId}`);

    // ── 1. Obter a mídia (base64 do Evolution GO ou download via URL) ──
    let buffer: Buffer;
    if (dados.base64) {
      try {
        const b64 = dados.base64.includes(',')
          ? dados.base64.slice(dados.base64.indexOf(',') + 1)
          : dados.base64;
        buffer = Buffer.from(b64, 'base64');
      } catch (b64Error: any) {
        console.error(`[CapturaDoc] ❌ Base64 inválido: ${b64Error.message}`);
        return;
      }
    } else {
      try {
        const resposta = await axios.get(dados.url!, {
          responseType: 'arraybuffer',
          timeout: 30_000, // 30s timeout
          headers: { 'User-Agent': 'Elyon/1.0' },
        });
        buffer = Buffer.from(resposta.data);
      } catch (dlError: any) {
        console.error(`[CapturaDoc] ❌ Falha no download: ${dlError.message}`);
        return; // Não lança — fire-and-forget
      }
    }

    // ── 2. Upload para S3 ─────────────────────────
    const extensao = determinarExtensao(dados, messageType);
    const s3Key = `documentos-lead/${tenantId}/${leadId}/${uuidv4()}${extensao}`;
    const mimeType = dados.mimetype || MIME_FALLBACK[messageType];

    await s3Client.send(new PutObjectCommand({
      Bucket:      BUCKET_NAME,
      Key:         s3Key,
      Body:        buffer,
      ContentType: mimeType,
    }));

    console.log(`[CapturaDoc] ✅ Upload S3 OK: ${s3Key}`);

    // ── 3. Salvar no banco ────────────────────────
    await (prisma as any).documentoLead.create({
      data: {
        leadId,
        tenantId,
        nomeOriginal: dados.fileName || null,
        mimeType,
        tamanhoBytes: buffer.length,
        s3Key,
        tipo:   TIPO_DOCUMENTO[messageType] || 'documento',
        origem: 'whatsapp',
      },
    });

    console.log(`[CapturaDoc] ✅ DocumentoLead criado para lead ${leadId}`);

  } catch (erro: any) {
    // Fire-and-forget: nunca deve travar o webhook principal
    console.error(`[CapturaDoc] ❌ Erro inesperado: ${erro.message}`);
  }
}

// ─── Helper para o webhook ────────────────────────

/**
 * Retorna quais tipos de mensagem são considerados documentos capturáveis.
 */
export const TIPOS_MIDIA_CAPTURÁVEIS = new Set([
  'imageMessage',
  'videoMessage',
  'documentMessage',
  'documentWithCaptionMessage',
  ...(CAPTURA_DOCS_INCLUIR_AUDIO ? ['audioMessage'] : []),
]);

/**
 * Detecta tipo de mídia de um payload bruto da Evolution API.
 * Retorna null se não for mídia capturável.
 */
export function detectarTipoMidia(message: any): string | null {
  const tipo = message.messageType;

  if (tipo && TIPOS_MIDIA_CAPTURÁVEIS.has(tipo)) return tipo;

  // Fallback via chave do objeto message
  const payloadMsg = message.message || {};
  for (const tipoConhecido of TIPOS_MIDIA_CAPTURÁVEIS) {
    if (payloadMsg[tipoConhecido]) return tipoConhecido;
  }

  return null;
}
