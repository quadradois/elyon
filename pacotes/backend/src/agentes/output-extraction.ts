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

  // LIMPEZA DE VAZAMENTO DE FERRAMENTAS
  // Alguns LLMs nativos emitem <tool_call>... tags dentro do corpo da resposta, muitas vezes de forma aninhada ou malformada.
  const firstOpen = respostaFinal.indexOf('<tool_call>');
  if (firstOpen !== -1) {
    const lastClose = respostaFinal.lastIndexOf('</tool_call>');
    if (lastClose !== -1 && lastClose > firstOpen) {
      // Remove o bloco completo desde a priemeira abertura até o último fechamento, salvando o texto válido depois
      respostaFinal = (respostaFinal.substring(0, firstOpen) + respostaFinal.substring(lastClose + 12)).trim();
    } else {
      // Bloco aberto sem fechamento de tag: a resposta quebrou e tudo depois é log da ferramenta
      respostaFinal = respostaFinal.substring(0, firstOpen).trim();
    }
  }

  // Failsafe para limpar <call> ou tags órfãs
  respostaFinal = respostaFinal.replace(/<\/?tool_call[^>]*>/gi, '').trim();
  respostaFinal = respostaFinal.replace(/<\/?call[^>]*>/gi, '').trim();

  // Limpar tags XML que parecem nomes de tools vazados pelo LLM
  // Ex: <qualificar_lead>...</qualificar_lead>, <converter_para_lead>...</converter_para_lead>,
  //     <transfer_to_presenter_agent_v5>
  respostaFinal = respostaFinal.replace(/<([a-z][a-z0-9_]*(?:\s[^>]*)?)>[\s\S]*?<\/\1>/gi, '').trim();
  respostaFinal = respostaFinal.replace(/<\/?[a-z][a-z0-9_]*(?:\s[^>]*)?>/gi, '').trim();

  return {
    respostaFinal,
    cotLog,
    structuredOutputDetectado,
    proximoPasso,
  };
}
