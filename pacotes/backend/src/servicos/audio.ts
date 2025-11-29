import axios from 'axios';

export class AudioService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.AUDIO_CONVERTER_URL || 'http://localhost:4040';
    this.apiKey = process.env.AUDIO_CONVERTER_API_KEY || 'elyon_audio_secret';
  }

  async converterAudio(base64: string): Promise<{ audio?: string; url?: string; transcription?: string }> {
    try {
      console.log('[AudioService] Enviando áudio para conversão/transcrição...');
      
      const response = await axios.post(
        `${this.apiUrl}/process-audio`,
        {
          base64: base64,
          format: 'mp3',
          transcribe: true,
          language: 'pt'
        },
        {
          headers: {
            'apikey': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('[AudioService] Resposta recebida:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[AudioService] Erro ao converter áudio:', error.message);
      if (error.response) {
        console.error('Detalhes:', error.response.data);
      }
      // Retorna null ou lança erro dependendo da estratégia. 
      // Aqui vamos lançar para tratar no webhook.
      throw error;
    }
  }
}

export const audioService = new AudioService();
