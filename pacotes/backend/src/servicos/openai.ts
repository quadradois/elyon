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

  async transcreverAudioBase64(base64: string, apiKey?: string): Promise<string> {
    const tempFilePath = path.join(os.tmpdir(), `audio_${Date.now()}.ogg`);

    try {
      // 1. Converter Base64 para Arquivo Temporário
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(tempFilePath, buffer);

      // 2. Enviar para Whisper API
      const client = this.getClient(apiKey);
      const transcription = await client.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: 'pt', // Forçar português ou deixar auto-detect
      });

      return transcription.text;
    } catch (error) {
      console.error('[OpenAI] Erro na transcrição:', error);
      throw error;
    } finally {
      // 3. Limpar Arquivo Temporário
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
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
}

export const openaiService = new OpenAIService();
