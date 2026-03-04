import { run } from '@openai/agents';
import type { ElyonContext } from './elyon-context';

interface ExecutarAgenteComRetryReasoningParams {
  agente: any;
  inputSDK: any[];
  elyonContext: ElyonContext;
  cachedHistory?: any[];
  contatoId?: string;
  mensagensLength: number;
  construirInputSemCache: () => any[];
  limparHistoricoContato: (contatoId: string) => Promise<void>;
  executarRun?: typeof run;
}

interface ExecutarAgenteComRetryReasoningResult {
  result: any;
  inputSDKFinal: any[];
}

export async function executarAgenteComRetryReasoning(
  params: ExecutarAgenteComRetryReasoningParams
): Promise<ExecutarAgenteComRetryReasoningResult> {
  const {
    agente,
    inputSDK,
    elyonContext,
    cachedHistory,
    contatoId,
    mensagensLength,
    construirInputSemCache,
    limparHistoricoContato,
    executarRun = run,
  } = params;

  let inputSDKFinal = inputSDK;

  try {
    const result = await executarRun(agente, inputSDKFinal, {
      context: elyonContext,
    });
    return { result, inputSDKFinal };
  } catch (runError: any) {
    const mensagemErro = String(runError?.message || '');
    const erroReasoningContent = /reasoning_content is missing/i.test(mensagemErro);

    if (erroReasoningContent && cachedHistory && cachedHistory.length > 0) {
      console.warn('[ORCHESTRATOR] ⚠️ Histórico SDK incompatível com LLM atual (reasoning_content). Limpando cache e retry sem histórico SDK.');

      if (contatoId) {
        await limparHistoricoContato(contatoId);
        console.log(`[ORCHESTRATOR] 🧹 Cache SDK limpo para ${contatoId.substring(0, 8)}...`);
      }

      inputSDKFinal = construirInputSemCache();
      console.log(`[ORCHESTRATOR] 🔁 Retry sem cache SDK: ${inputSDKFinal.length} itens (1 system + ${mensagensLength} mensagens)`);

      const result = await executarRun(agente, inputSDKFinal, {
        context: elyonContext,
      });

      return { result, inputSDKFinal };
    }

    throw runError;
  }
}