/**
 * MEDIA SERVICE
 * 
 * Responsável por:
 * 1. Processar Base64 de imagens e áudios
 * 2. Transcrever áudio usando OpenAI (Whisper)
 * 3. Upload para S3/Storage (Futuro)
 */

import { openaiService } from './openai';

export interface ProcessamentoMidiaResult {
    urlMidia?: string;
    textoExtraido?: string; // Transcrição ou legenda
    tipo: 'IMAGEM' | 'AUDIO';
}

export class MediaService {
    /**
     * Processa mídia recebida do Webhook
     */
    async processarMidia(
        tipo: 'IMAGEM' | 'AUDIO',
        base64?: string,
        legenda?: string
    ): Promise<ProcessamentoMidiaResult> {
        try {
            if (!base64) {
                console.warn('[MediaService] Base64 não fornecido');
                return { tipo, textoExtraido: legenda || '[Mídia sem conteúdo]' };
            }

            // Gerar Data URI para salvar no banco/enviar frontend
            const mime = tipo === 'IMAGEM' ? 'image/jpeg' : 'audio/ogg';
            const urlMidia = `data:${mime};base64,${base64}`;

            let textoExtraido = legenda || '';

            // Se for áudio, transcrever
            if (tipo === 'AUDIO') {
                try {
                    console.log('[MediaService] 🎙️ Iniciando transcrição de áudio...');
                    const transcricao = await openaiService.transcreverAudioBase64(base64);

                    if (transcricao) {
                        textoExtraido = transcricao;
                        console.log(`[MediaService] ✅ Transcrição: "${transcricao.substring(0, 50)}..."`);
                    } else {
                        textoExtraido = '[Áudio inaudível]';
                    }
                } catch (error) {
                    console.error('[MediaService] ❌ Erro na transcrição:', error);
                    textoExtraido = '[Erro na transcrição do áudio]';
                }
            }

            return {
                urlMidia,
                textoExtraido,
                tipo
            };

        } catch (error) {
            console.error('[MediaService] Erro fatal ao processar mídia:', error);
            throw error;
        }
    }
}

export const mediaService = new MediaService();
