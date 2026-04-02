export interface ResultadoExtracaoOutput {
  respostaFinal: string;
  cotLog: string | null;
  structuredOutputDetectado: boolean;
  proximoPasso?: string;
}

export function extrairRespostaECot(result: any): ResultadoExtracaoOutput {
  let respostaFinal: string;
  let structuredOutputDetectado = false;
  let proximoPasso: string | undefined;

  if (typeof result.finalOutput === 'string') {
    respostaFinal = result.finalOutput;
  } else if (
    result.finalOutput &&
    typeof result.finalOutput === 'object' &&
    'respostaParaOCliente' in result.finalOutput
  ) {
    respostaFinal = (result.finalOutput as any).respostaParaOCliente;
    structuredOutputDetectado = true;
    proximoPasso = (result.finalOutput as any).proximoPasso;
  } else {
    respostaFinal = JSON.stringify(result.finalOutput);
  }

  const cotMatch = respostaFinal.match(/<cot>[\s\S]*?<\/cot>/);
  let cotLog: string | null = null;
  if (cotMatch) {
    cotLog = cotMatch[0];
    respostaFinal = respostaFinal.replace(/<cot>[\s\S]*?<\/cot>\s*/, '').trim();
  }

  return {
    respostaFinal,
    cotLog,
    structuredOutputDetectado,
    proximoPasso,
  };
}
