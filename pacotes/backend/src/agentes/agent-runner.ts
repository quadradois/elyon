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
    const erroToolCallId = /tool_call_id.*is not found|is not found.*tool_call_id/i.test(mensagemErro)
      || (runError?.status === 400 && /tool_call_id/i.test(mensagemErro));

    // ── Tratamento: reasoning_content missing ──
    if (erroReasoningContent) {
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

      logger.error('[ORCHESTRATOR] ❌ reasoning_content error sem cachedHistory. Verifique a compatibilidade do modelo com o SDK @openai/agents.');
    }

    // ── Tratamento: tool_call_id not found (histórico SDK com IDs obsoletos) ──
    if (erroToolCallId && contatoId) {
      logger.warn(`[ORCHESTRATOR] ⚠️ tool_call_id obsoleto detectado para ${contatoId.substring(0, 8)}. Purgando histórico SDK e fazendo retry...`);
      await limparHistoricoContato(contatoId);

      inputSDKFinal = construirInputSemCache();
      logger.debug(`[ORCHESTRATOR] 🔁 Retry sem cache (tool_call_id): ${inputSDKFinal.length} itens`);

      try {
        const result = await executarRun(agente, inputSDKFinal, { context: elyonContext });
        logger.debug('[ORCHESTRATOR] ✅ Retry por tool_call_id bem-sucedido.');
        return { result, inputSDKFinal };
      } catch (retryError: any) {
        logger.error('[ORCHESTRATOR] ❌ Retry após purge tool_call_id também falhou:', retryError?.message);
        throw retryError;
      }
    }

    throw runError;
  }

}