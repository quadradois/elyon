import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { CircuitBreaker } from '../utils/circuit-breaker';

export class OpenAIService {
  private client: OpenAI | null = null;
  private breaker: CircuitBreaker;

  constructor() {
    // Inicialização preguiçosa (lazy) será feita no getClient()
    // Isso garante que as variáveis de ambiente já tenham sido carregadas pelo dotenv
    this.breaker = new CircuitBreaker('OpenAI', {
      failureThreshold: 3,
      resetTimeout: 30000 // 30 segundos
    });
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.client;
  }

  async transcreverAudioBase64(base64: string): Promise<string> {
    const tempFilePath = path.join(os.tmpdir(), `audio_${Date.now()}.ogg`);

    try {
      // 1. Converter Base64 para Arquivo Temporário
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(tempFilePath, buffer);

      // 2. Enviar para Whisper API
      const transcription = await this.breaker.execute(async () => {
        return await this.getClient().audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: 'whisper-1',
          language: 'pt', // Forçar português ou deixar auto-detect
        });
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
    }
  ): Promise<string> {
    try {
      const completion = await this.breaker.execute(async () => {
        return await this.getClient().chat.completions.create({
          messages: mensagens,
          model: options?.model || 'gpt-4o-mini',
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens,
          response_format: options?.json ? { type: 'json_object' } : undefined
        });
      });

      return completion.choices[0].message.content || 'Desculpe, não consegui gerar uma resposta.';
    } catch (error) {
      console.error('[OpenAI] Erro na geração de resposta:', error);
      return 'Estou com dificuldades técnicas no momento.';
    }
  }
}

export const openaiService = new OpenAIService();
