import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { MODELO_PADRAO_AUXILIAR } from '../agentes/byok-resolver';

export class OpenAIService {
  private getClient(apiKey?: string, baseURL?: string): OpenAI {
    return new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
      baseURL: baseURL || undefined
    });
  }

  private determinarExtensaoAudio(mimeType?: string, fileName?: string): string {
    if (fileName && fileName.includes('.')) {
      return path.extname(fileName) || '.ogg';
    }

    const mime = (mimeType || '').toLowerCase();
    if (mime.includes('mpeg') || mime.includes('mp3')) return '.mp3';
    if (mime.includes('mp4') || mime.includes('m4a')) return '.mp4';
    if (mime.includes('webm')) return '.webm';
    if (mime.includes('wav')) return '.wav';
    if (mime.includes('ogg') || mime.includes('opus')) return '.ogg';
    return '.ogg';
  }

  async transcreverAudioBuffer(
    buffer: Buffer,
    options?: {
      mimeType?: string;
      fileName?: string;
      apiKey?: string;
    }
  ): Promise<string> {
    const extensao = this.determinarExtensaoAudio(options?.mimeType, options?.fileName);
    const tempFilePath = path.join(os.tmpdir(), `audio_${Date.now()}_${Math.random().toString(36).slice(2)}${extensao}`);

    try {
      fs.writeFileSync(tempFilePath, buffer);

      const client = this.getClient(options?.apiKey);
      const transcription = await client.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1',
        language: 'pt',
      });

      return transcription.text;
    } catch (error) {
      console.error('[OpenAI] Erro na transcrição:', error);
      throw error;
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  async transcreverAudioBase64(base64: string, apiKey?: string): Promise<string> {
    const buffer = Buffer.from(base64, 'base64');
    return this.transcreverAudioBuffer(buffer, { mimeType: 'audio/ogg', apiKey });
  }

  async gerarResposta(
    mensagens: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      json?: boolean;
      apiKey?: string;
      baseURL?: string;
    }
  ): Promise<string> {
    try {
      const client = this.getClient(options?.apiKey, options?.baseURL);
      const completion = await client.chat.completions.create({
        messages: mensagens,
        model: options?.model || MODELO_PADRAO_AUXILIAR,
        temperature: options?.temperature ?? 0.7,
        max_completion_tokens: options?.maxTokens,
        response_format: options?.json ? { type: 'json_object' } : undefined
      });

      return completion.choices[0].message.content || 'Desculpe, não consegui gerar uma resposta.';
    } catch (error) {
      console.error('[OpenAI] Erro na geração de resposta:', error);
      return 'Estou com dificuldades técnicas no momento.';
    }
  }

  async sintetizarFala(
    texto: string,
    options?: {
      voz?: string;
      modelo?: string;
      instrucoes?: string;
      apiKey?: string;
      baseURL?: string;
    }
  ): Promise<string | null> {
    try {
      const client = this.getClient(options?.apiKey, options?.baseURL);
      const response = await client.audio.speech.create({
        model: options?.modelo || process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
        voice: options?.voz || process.env.OPENAI_TTS_VOICE || 'alloy',
        input: texto.slice(0, 4000),
        format: 'mp3',
        instructions: options?.instrucoes,
      } as any);

      const arrayBuffer = await (response as any).arrayBuffer();
      return Buffer.from(arrayBuffer).toString('base64');
    } catch (error) {
      console.error('[OpenAI] Erro na síntese de fala:', error);
      return null;
    }
  }
}

export const openaiService = new OpenAIService();
