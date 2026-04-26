import axios from 'axios';
import { openaiService } from './openai';

export type ProvedorVozTenant = 'openai' | 'elevenlabs';

export interface ConfiguracaoVozTenant {
  provedor?: string;
  vozOpenAI?: string;
  elevenLabsVoiceId?: string;
  elevenLabsModelId?: string;
  perfil?: string;
}

export const INSTRUCOES_VOZ_VENDAS_ALTA_ENERGIA =
  'Fale em português brasileiro com energia de vendedor imobiliário de alta performance: confiante, caloroso, motivado e consultivo. Tenha impacto na primeira frase, ritmo vivo, sorriso na voz e naturalidade de WhatsApp. Evite soar robótico, apressado, teatral ou agressivo. Transmita segurança, foco em resultado e entusiasmo elegante.';

const MODELO_ELEVENLABS_PADRAO = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

function normalizarProvedor(provedor?: string): ProvedorVozTenant {
  return provedor === 'elevenlabs' ? 'elevenlabs' : 'openai';
}

function textoSeguro(texto: string): string {
  return (texto || '').replace(/\s+/g, ' ').trim().slice(0, 4000);
}

async function sintetizarComElevenLabs(
  texto: string,
  voiceId: string,
  modelId?: string
): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !voiceId) return null;

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: textoSeguro(texto),
        model_id: modelId || MODELO_ELEVENLABS_PADRAO,
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.86,
          style: 0.34,
          use_speaker_boost: true,
        },
      },
      {
        responseType: 'arraybuffer',
        timeout: 20_000,
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        params: {
          output_format: 'mp3_44100_128',
        },
      }
    );

    return Buffer.from(response.data).toString('base64');
  } catch (error: any) {
    console.error('[Voz] Erro ElevenLabs:', error?.response?.data || error?.message || error);
    return null;
  }
}

export async function sintetizarFalaTenant(
  texto: string,
  config: ConfiguracaoVozTenant = {}
): Promise<string | null> {
  const provedor = normalizarProvedor(config.provedor);
  const vozOpenAI = config.vozOpenAI || 'onyx';

  if (provedor === 'elevenlabs') {
    const audioEleven = await sintetizarComElevenLabs(
      texto,
      config.elevenLabsVoiceId || '',
      config.elevenLabsModelId
    );
    if (audioEleven) return audioEleven;
  }

  return openaiService.sintetizarFala(textoSeguro(texto), {
    voz: vozOpenAI,
    instrucoes: INSTRUCOES_VOZ_VENDAS_ALTA_ENERGIA,
  });
}
