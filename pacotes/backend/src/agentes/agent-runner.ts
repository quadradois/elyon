import { run } from '@openai/agents';
import type { ElyonContext } from './elyon-context';
import { logger } from '../lib/logger';

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

    if (erroReasoningContent) {
      // Limpar cache Redis se havia histórico cached
      if (cachedHistory && cachedHistory.length > 0 && contatoId) {
        await limparHistoricoContato(contatoId);
        logger.debug(`[ORCHESTRATOR] 🧹 Cache SDK limpo para ${contatoId.substring(0, 8)}...`);
        logger.warn('[ORCHESTRATOR] ⚠️ Histórico SDK incompatível com LLM atual (reasoning_content). Retry sem histórico SDK.');

        inputSDKFinal = construirInputSemCache();
        logger.debug(`[ORCHESTRATOR] 🔁 Retry sem cache SDK: ${inputSDKFinal.length} itens (1 system + ${mensagensLength} mensagens)`);

        try {
          const result = await executarRun(agente, inputSDKFinal, { context: elyonContext });
          return { result, inputSDKFinal };
        } catch (retryError: any) {
          const retryMsg = String(retryError?.message || '');
          if (/reasoning_content is missing/i.test(retryMsg)) {
            logger.warn('[ORCHESTRATOR] ⚠️ Retry também falhou com reasoning_content. Provável tool call item residual na DB. Abortando com erro estrutural.');
          }
          throw retryError;
        }
      }

      // Sem cachedHistory: logic de fallback — primeiro turno ainda falhou
      // Isso indica incompatibilidade estrutural da entrada com o modelo thinking
      logger.error('[ORCHESTRATOR] ❌ reasoning_content error sem cachedHistory. Verifique a compatibilidade do modelo com o SDK @openai/agents.');
    }

    throw runError;
  }
}