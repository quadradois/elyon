import axios from 'axios';
import OpenAI from 'openai';
import { MODELO_PADRAO_AUXILIAR } from '../agentes/byok-resolver';
import { openaiService } from './openai';

export interface EntradaAnaliseMidia {
  messageType: string;
  mediaUrl?: string;
  mediaBase64?: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
}

const ANALISE_MIDIA_ATIVA = process.env.ANALISE_MIDIA_ATIVA !== 'false';
const ANALISE_MIDIA_TIMEOUT_MS = Number(process.env.ANALISE_MIDIA_TIMEOUT_MS || 12000);
const MODELO_ANALISE_MIDIA = process.env.MODELO_ANALISE_MIDIA || MODELO_PADRAO_AUXILIAR;

function resumirTexto(texto: string, limite = 280): string {
  const limpo = (texto || '').replace(/\s+/g, ' ').trim();
  if (!limpo) return '';
  return limpo.length <= limite ? limpo : `${limpo.slice(0, limite - 1)}…`;
}

function montarContextoArquivo(entrada: EntradaAnaliseMidia): string {
  const parts: string[] = [];
  if (entrada.fileName) parts.push(`arquivo=${entrada.fileName}`);
  if (entrada.mimeType) parts.push(`mime=${entrada.mimeType}`);
  if (entrada.caption) parts.push(`legenda=${entrada.caption}`);
  return parts.join(' | ');
}

async function baixarMidia(mediaUrl: string): Promise<Buffer | null> {
  const headersBase = { 'User-Agent': 'Elyon/1.0' };
  const urls = [mediaUrl];

  if (process.env.EVOLUTION_API_URL && mediaUrl.startsWith('/')) {
    urls.unshift(`${process.env.EVOLUTION_API_URL.replace(/\/$/, '')}${mediaUrl}`);
  }

  const tentativas = urls.map((url) => ({ url, headers: headersBase }));

  for (const tentativa of tentativas) {
    try {
      const resposta = await axios.get(tentativa.url, {
        responseType: 'arraybuffer',
        timeout: ANALISE_MIDIA_TIMEOUT_MS,
        headers: tentativa.headers,
      });
      return Buffer.from(resposta.data);
    } catch {
      // Tenta o próximo formato/headers antes de desistir.
    }
  }

  return null;
}

function bufferDeBase64(mediaBase64?: string): Buffer | null {
  const valor = (mediaBase64 || '').trim();
  if (!valor) return null;

  const base64 = valor.includes(',')
    ? valor.slice(valor.indexOf(',') + 1)
    : valor;

  try {
    return Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
}

async function analisarImagemComOpenAI(entrada: EntradaAnaliseMidia, buffer: Buffer): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const mime = entrada.mimeType || 'image/jpeg';
    const base64 = buffer.toString('base64');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: MODELO_ANALISE_MIDIA,
      temperature: 0.2,
      max_completion_tokens: 220,
      messages: [
        {
          role: 'system',
          content:
            'Você analisa mídia recebida em conversa imobiliária. Responda em 1 linha curta em PT-BR dizendo: tipo da mídia (foto do imóvel, print, documento escaneado etc), possível contexto e próxima ação útil.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Contexto arquivo: ${montarContextoArquivo(entrada) || 'sem metadados'}` },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
          ] as any,
        },
      ],
    });

    const texto = response.choices?.[0]?.message?.content || '';
    return resumirTexto(texto, 320) || null;
  } catch {
    return null;
  }
}

async function analisarPdf(entrada: EntradaAnaliseMidia, buffer: Buffer): Promise<string | null> {
  try {
    const pdfParse = require('pdf-parse');
    const parsed = await pdfParse(buffer);
    const texto = resumirTexto(parsed.text || '', 380);
    if (!texto) {
      return `anexo PDF recebido${entrada.fileName ? ` (${entrada.fileName})` : ''}`;
    }
    return `documento PDF recebido; conteúdo principal: ${texto}`;
  } catch {
    return null;
  }
}

async function transcreverAudio(entrada: EntradaAnaliseMidia, buffer: Buffer): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const transcricao = await openaiService.transcreverAudioBuffer(buffer, {
      mimeType: entrada.mimeType,
      fileName: entrada.fileName,
    });
    const texto = resumirTexto(transcricao || '', 700);
    return texto ? `áudio transcrito: "${texto}"` : null;
  } catch {
    return null;
  }
}

function fallbackBasico(entrada: EntradaAnaliseMidia): string {
  const base = entrada.messageType;
  const meta = montarContextoArquivo(entrada);

  if (base === 'audioMessage') return `áudio recebido do lead; transcrição indisponível${meta ? ` (${meta})` : ''}`;
  if (base === 'videoMessage') return `vídeo recebido do lead${meta ? ` (${meta})` : ''}`;
  if (base === 'documentMessage' || base === 'documentWithCaptionMessage') {
    return `anexo/documento recebido${meta ? ` (${meta})` : ''}`;
  }
  if (base === 'imageMessage') return `imagem recebida${meta ? ` (${meta})` : ''}`;
  return 'mídia recebida do lead';
}

export async function analisarMidiaParaContexto(entrada: EntradaAnaliseMidia): Promise<string | null> {
  if (!ANALISE_MIDIA_ATIVA || (!entrada.mediaBase64 && !entrada.mediaUrl)) {
    return fallbackBasico(entrada);
  }

  const buffer = bufferDeBase64(entrada.mediaBase64) || (entrada.mediaUrl ? await baixarMidia(entrada.mediaUrl) : null);
  if (!buffer) return fallbackBasico(entrada);

  if (entrada.messageType === 'audioMessage') {
    const transcricao = await transcreverAudio(entrada, buffer);
    return transcricao || fallbackBasico(entrada);
  }

  if (entrada.messageType === 'imageMessage') {
    const analise = await analisarImagemComOpenAI(entrada, buffer);
    return analise || fallbackBasico(entrada);
  }

  if (
    entrada.messageType === 'documentMessage'
    || entrada.messageType === 'documentWithCaptionMessage'
  ) {
    const mime = (entrada.mimeType || '').toLowerCase();
    if (mime.includes('pdf')) {
      const analisePdf = await analisarPdf(entrada, buffer);
      return analisePdf || fallbackBasico(entrada);
    }

    if (mime.startsWith('image/')) {
      const analiseImagem = await analisarImagemComOpenAI(entrada, buffer);
      return analiseImagem || fallbackBasico(entrada);
    }
    return fallbackBasico(entrada);
  }

  return fallbackBasico(entrada);
}
