import { run } from '@openai/agents';
import type { AgentInputItem } from '@openai/agents';
import type { ElyonContext } from './elyon-context';
import type { ElyonAgent, ElyonRunResult } from './types';
import { logger } from '../lib/logger';

/** Limite de turnos por execução do agente (segurança contra loops infinitos e custos) */
const MAX_TURNS = 15;

interface ExecutarAgenteComRetryParams {
  agente: ElyonAgent;
  inputSDK: AgentInputItem[];
  elyonContext: ElyonContext;
  cachedHistory?: AgentInputItem[];
  contatoId?: string;
  mensagensLength: number;
  construirInputSemCache: () => AgentInputItem[];
  limparHistoricoContato: (contatoId: string) => Promise<void>;
  executarRun?: typeof run;
  maxTurns?: number;
  /**
   * Callback para criar agente usando o provedor da plataforma (OpenAI).
   * Usado como fallback quando o provedor BYOK falha com erro de infra (5xx, timeout, rate limit).
   * Se omitido, o fallback de provedor é desativado.
   */
  criarAgenteFallback?: () => ElyonAgent;
}

interface ExecutarAgenteComRetryResult {
  result: ElyonRunResult;
  inputSDKFinal: AgentInputItem[];
  usouFallbackProvedor?: boolean;
}

/**
 * Detecta se um erro é de infraestrutura do provedor (5xx, rate limit, timeout, rede).
 * Esses erros justificam retry com provedor alternativo.
 */
function isErroInfraProvedor(error: unknown): boolean {
  const err = error as Record<string, unknown>;
  const status = (err?.status ?? err?.statusCode) as number | undefined;
  const mensagem = String(err?.message || '').toLowerCase();

  // 5xx — erro do servidor do provedor
  if (status !== undefined && status >= 500 && status < 600) return true;

  // 429 — rate limit
  if (status === 429) return true;

  // Timeout ou rede
  if (/timeout|econnrefused|enotfound|socket hang up|fetch failed|network/i.test(mensagem)) return true;

  // Erro explícito de overloaded
  if (/overloaded|capacity|unavailable/i.test(mensagem)) return true;

  return false;
}

/**
 * Executa o agente com retry para erros recuperáveis:
 * 1. tool_call_id obsoleto → purga cache e retenta com mesmo agente
 * 2. Erro de infra do provedor (5xx, timeout, rate limit) → retenta com provedor plataforma
 * 
 * maxTurns garante que o agente não execute mais que N turnos,
 * prevenindo loops infinitos e custos excessivos.
 */
export async function executarAgenteComRetry(
  params: ExecutarAgenteComRetryParams
): Promise<ExecutarAgenteComRetryResult> {
  const {
    agente,
    inputSDK,
    elyonContext,
    contatoId,
    mensagensLength,
    construirInputSemCache,
    limparHistoricoContato,
    executarRun = run,
    maxTurns = MAX_TURNS,
    criarAgenteFallback,
  } = params;

  let inputSDKFinal = inputSDK;

  try {
    const result = await executarRun(agente, inputSDKFinal, {
      context: elyonContext,
      maxTurns,
    });
    return { result: result as ElyonRunResult, inputSDKFinal };
  } catch (runError: unknown) {
    const errObj = runError as Record<string, unknown>;
    const mensagemErro = String(errObj?.message || '');

    // ── Tratamento 0: MaxTurnsExceededError (agente em loop infinito) ──
    const isMaxTurnsError = (runError as Record<string, unknown>)?.constructor?.name === 'MaxTurnsExceededError'
      || /max.*turns.*exceeded/i.test(mensagemErro);

    if (isMaxTurnsError) {
      logger.warn(`[ORCHESTRATOR] ⚠️ MaxTurnsExceeded: agente atingiu o limite de ${maxTurns} turnos. Retornando resposta amigável.`);
      return {
        result: {
          finalOutput: JSON.stringify({
            respostaParaOCliente: 'Desculpe, tive um probleminha aqui. Pode repetir o que você precisa? 😊',
            raciocinio: `MaxTurnsExceeded: agente atingiu ${maxTurns} turnos sem concluir.`,
            proximoPasso: 'aguardar_resposta',
            sinaisDetectados: []
          }),
        } as unknown as ElyonRunResult,
        inputSDKFinal,
      };
    }

    // ── Tratamento 1: erros de protocolo de tools no histórico (cache obsoleto) ──
    const erroToolCallId = /tool_call_id.*is not found|is not found.*tool_call_id/i.test(mensagemErro)
      || ((errObj?.status as number) === 400 && /tool_call_id/i.test(mensagemErro));
    const erroToolRoleOrfao = /messages with role ['"]tool['"] must be a response to a preceeding message with ['"]tool_calls['"]/i.test(mensagemErro)
      || /messages with role ['"]tool['"] must be a response to a preceding message with ['"]tool_calls['"]/i.test(mensagemErro);

    if ((erroToolCallId || erroToolRoleOrfao) && contatoId) {
      const motivo = erroToolCallId ? 'tool_call_id obsoleto' : 'role tool órfão';
      logger.warn(`[ORCHESTRATOR] ⚠️ ${motivo} detectado para ${contatoId.substring(0, 8)}. Purgando histórico SDK e fazendo retry...`);
      await limparHistoricoContato(contatoId);

      inputSDKFinal = construirInputSemCache();
      logger.debug(`[ORCHESTRATOR] 🔁 Retry sem cache (tool_call_id): ${inputSDKFinal.length} itens`);

      try {
        const result = await executarRun(agente, inputSDKFinal, {
          context: elyonContext,
          maxTurns,
        });
        logger.debug('[ORCHESTRATOR] ✅ Retry por tool_call_id bem-sucedido.');
        return { result: result as ElyonRunResult, inputSDKFinal };
      } catch (retryError: unknown) {
        logger.error({ err: retryError }, '[ORCHESTRATOR] ❌ Retry após purge tool_call_id também falhou.');
        throw retryError;
      }
    }

    // ── Tratamento 1.5: ToolCallError (falha na execução de uma tool) ──
    const isToolCallError = (runError as Record<string, unknown>)?.constructor?.name === 'ToolCallError'
      || (runError as Record<string, unknown>)?.constructor?.name === 'ToolTimeoutError'
      || /tool.*call.*error|tool.*execution.*fail|tool.*timeout/i.test(mensagemErro);

    if (isToolCallError) {
      logger.warn(`[ORCHESTRATOR] ⚠️ ToolCallError detectado: ${mensagemErro.substring(0, 120)}. Retry único...`);
      try {
        const result = await executarRun(agente, inputSDKFinal, {
          context: elyonContext,
          maxTurns,
        });
        logger.info('[ORCHESTRATOR] ✅ Retry após ToolCallError bem-sucedido.');
        return { result: result as ElyonRunResult, inputSDKFinal };
      } catch (retryToolError: unknown) {
        logger.error({ err: retryToolError }, '[ORCHESTRATOR] ❌ Retry de ToolCallError também falhou.');
        throw retryToolError;
      }
    }

    // ── Tratamento 2: Fallback de provedor (BYOK → Plataforma) ──
    if (isErroInfraProvedor(runError) && criarAgenteFallback) {
      const statusCode = errObj?.status || errObj?.statusCode || 'N/A';
      logger.warn(`[ORCHESTRATOR] ⚠️ Provedor BYOK falhou (status: ${statusCode}, erro: ${mensagemErro.substring(0, 100)}). Ativando fallback para provedor da plataforma...`);

      try {
        const agenteFallback = criarAgenteFallback();
        const result = await executarRun(agenteFallback, inputSDKFinal, {
          context: elyonContext,
          maxTurns,
        });
        logger.info('[ORCHESTRATOR] ✅ Fallback de provedor bem-sucedido (BYOK → Plataforma).');
        return { result: result as ElyonRunResult, inputSDKFinal, usouFallbackProvedor: true };
      } catch (fallbackError: unknown) {
        logger.error({ err: fallbackError }, '[ORCHESTRATOR] ❌ Fallback de provedor também falhou.');
        // Lança o erro ORIGINAL (mais informativo para debug)
        throw runError;
      }
    }

    throw runError;
  }

}
