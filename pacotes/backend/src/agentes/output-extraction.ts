import type { ElyonRunResult } from './types';
import { sanitizarRespostaParaCliente } from './client-response-sanitizer';

export interface ResultadoExtracaoOutput {
  respostaFinal: string;
  cotLog: string | null;
  structuredOutputDetectado: boolean;
  proximoPasso?: string;
  dadosEstruturados?: Record<string, unknown>;
}

function montarResultadoStructured(output: Record<string, unknown>): ResultadoExtracaoOutput | null {
  const resposta = output.respostaParaOCliente;
  if (typeof resposta !== 'string' || !resposta.trim()) {
    return null;
  }

  const { respostaParaOCliente: _, ...extras } = output;
  return {
    respostaFinal: sanitizarRespostaParaCliente(resposta),
    cotLog: (typeof output.raciocinio === 'string' ? output.raciocinio : null),
    structuredOutputDetectado: true,
    proximoPasso: typeof output.proximoPasso === 'string' ? output.proximoPasso : undefined,
    dadosEstruturados: extras,
  };
}

function tentarExtrairStructuredDeString(raw: string): ResultadoExtracaoOutput | null {
  if (!raw.includes('respostaParaOCliente')) return null;

  // Tentativa A: string inteira é um JSON válido.
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'respostaParaOCliente' in parsed) {
      return montarResultadoStructured(parsed as Record<string, unknown>);
    }
  } catch {
    // segue para outras heurísticas
  }

  // Tentativa B: JSON em bloco markdown (```json ... ```).
  const blocosMarkdown = raw.match(/```(?:json)?\s*([\s\S]*?)```/gi) || [];
  for (const bloco of blocosMarkdown) {
    const conteudo = bloco.replace(/```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    try {
      const parsed = JSON.parse(conteudo);
      if (parsed && typeof parsed === 'object' && 'respostaParaOCliente' in parsed) {
        return montarResultadoStructured(parsed as Record<string, unknown>);
      }
    } catch {
      // continua procurando outros blocos
    }
  }

  // Tentativa C: texto + JSON no final (caso clássico de vazamento).
  // Percorre os possíveis inícios de objeto de trás para frente e tenta parsear o sufixo.
  const indicesAbreChave: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{') indicesAbreChave.push(i);
  }
  for (let i = indicesAbreChave.length - 1; i >= 0; i--) {
    const sufixo = raw.slice(indicesAbreChave[i]).trim();
    try {
      const parsed = JSON.parse(sufixo);
      if (parsed && typeof parsed === 'object' && 'respostaParaOCliente' in parsed) {
        return montarResultadoStructured(parsed as Record<string, unknown>);
      }
    } catch {
      // tenta o próximo candidato
    }
  }

  // Tentativa D: formato texto "key: value" em qualquer trecho.
  const matchResposta = raw.match(/(?:^|\n)respostaParaOCliente:\s*(.+?)(?:\n\n(?:raciocinio|proximoPasso|pvamInferido|sinaisDetectados):|\s*$)/s);
  if (matchResposta) {
    const respostaExtraida = matchResposta[1].trim();
    const matchRaciocinio = raw.match(/\nraciocinio:\s*([\s\S]*?)(?:\n\n(?:proximoPasso|pvamInferido|sinaisDetectados):|\s*$)/);
    const matchProximo = raw.match(/\nproximoPasso:\s*(.+?)(?:\n|$)/);
    return {
      respostaFinal: sanitizarRespostaParaCliente(respostaExtraida),
      cotLog: matchRaciocinio ? matchRaciocinio[1].trim() : null,
      structuredOutputDetectado: true,
      proximoPasso: matchProximo ? matchProximo[1].trim() : undefined,
      dadosEstruturados: undefined,
    };
  }

  return null;
}

/**
 * Extrai resposta e CoT do resultado do agente.
 * 
 * COM Structured Output (resultType ativo):
 *   → finalOutput é um objeto Zod-validado. Extração direta, sem regex.
 *   → Campos extras (raciocinio, sinaisDetectados, pvamInferido, dadosColetados)
 *     são preservados em dadosEstruturados para logging/analytics.
 * 
 * SEM Structured Output (fallback string):
 *   → Aplica limpeza de CoT, tool_call leaks e XML tags orphãs.
 */
export function extrairRespostaECot(result: ElyonRunResult): ResultadoExtracaoOutput {
  let respostaFinal: string;
  let structuredOutputDetectado = false;
  let proximoPasso: string | undefined;
  let dadosEstruturados: Record<string, unknown> | undefined;

  // ──── CAMINHO 1: Structured Output (objeto Zod-validado) ────
  if (
    result.finalOutput &&
    typeof result.finalOutput === 'object' &&
    'respostaParaOCliente' in result.finalOutput
  ) {
    const resultadoStructured = montarResultadoStructured(result.finalOutput as Record<string, unknown>);
    if (resultadoStructured) {
      return resultadoStructured;
    }
  }

  // ──── CAMINHO 2: Fallback string (agentes sem resultType) ────
  if (typeof result.finalOutput === 'string') {
    respostaFinal = result.finalOutput;
  } else {
    respostaFinal = JSON.stringify(result.finalOutput);
  }

  // ──── CAMINHO 2.5: Detecção de Structured Output em formato string ────
  // Quando o SDK retorna o Structured Output como JSON string (em vez de objeto parsed),
  // ou quando o modelo emite os campos como texto "key: value" (sem JSON válido).
  
  // Tentativa A: pode ser JSON string válido contendo respostaParaOCliente
  if (respostaFinal.includes('respostaParaOCliente')) {
    const resultadoStructured = tentarExtrairStructuredDeString(respostaFinal);
    if (resultadoStructured) {
      return resultadoStructured;
    }
  }

  // Extrair CoT entre tags <cot>...</cot>
  const cotMatch = respostaFinal.match(/<cot>[\s\S]*?<\/cot>/);
  let cotLog: string | null = null;
  if (cotMatch) {
    cotLog = cotMatch[0];
    respostaFinal = respostaFinal.replace(/<cot>[\s\S]*?<\/cot>\s*/, '').trim();
  }

  // LIMPEZA DE VAZAMENTO DE FERRAMENTAS
  const firstOpen = respostaFinal.indexOf('<tool_call>');
  if (firstOpen !== -1) {
    const lastClose = respostaFinal.lastIndexOf('</tool_call>');
    if (lastClose !== -1 && lastClose > firstOpen) {
      respostaFinal = (respostaFinal.substring(0, firstOpen) + respostaFinal.substring(lastClose + 12)).trim();
    } else {
      respostaFinal = respostaFinal.substring(0, firstOpen).trim();
    }
  }

  // Failsafe para limpar tags orphãs
  respostaFinal = respostaFinal.replace(/<\/?tool_call[^>]*>/gi, '').trim();
  respostaFinal = respostaFinal.replace(/<\/?call[^>]*>/gi, '').trim();
  respostaFinal = respostaFinal.replace(/<([a-z][a-z0-9_]*(?:\s[^>]*)?)>[\s\S]*?<\/\1>/gi, '').trim();
  respostaFinal = respostaFinal.replace(/<\/?[a-z][a-z0-9_]*(?:\s[^>]*)?>/gi, '').trim();
  respostaFinal = sanitizarRespostaParaCliente(respostaFinal);

  return {
    respostaFinal,
    cotLog,
    structuredOutputDetectado,
    proximoPasso,
    dadosEstruturados,
  };
}
