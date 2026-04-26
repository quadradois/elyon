import { getCacheStats, setHistory } from './conversation-cache';
import { removeHandoffNarration, sliceHistoryPreservingSystem } from './handoff-filters';
import { sanitizeHistoryForToolProtocol } from './history-tool-sanitizer';
import { logger } from '../lib/logger';
import { MAPA_NOMES_AGENTES } from './agent-chain';
import type { ElyonRunResult } from './types';
import type { RunItem } from '@openai/agents';

function normalizarNomeAgente(nome?: string): string | undefined {
  if (!nome) return undefined;
  return MAPA_NOMES_AGENTES[nome] || nome;
}

export interface PersistenciaHistoryResult {
  nomesToolsTurno: string[];
  toolCallsTurno: number;
  handoffsTurno: number;
}

export async function persistirHistoricoSdk(
  contatoId: string,
  result: ElyonRunResult
): Promise<PersistenciaHistoryResult> {
  const retornoPadrao: PersistenciaHistoryResult = {
    nomesToolsTurno: [],
    toolCallsTurno: 0,
    handoffsTurno: 0,
  };

  try {
    const history = result.history;
    if (history && Array.isArray(history)) {
      const lastAgentName = result.lastAgent?.name;
      const lastAgentNormalizado = normalizarNomeAgente(lastAgentName);
      const historySemNarracao = removeHandoffNarration(history);
      const historyFinal = sliceHistoryPreservingSystem(historySemNarracao, 40, 'Persistência Orchestrator');
      const historySanitizado = sanitizeHistoryForToolProtocol(historyFinal, 'Persistência Orchestrator');
      await setHistory(contatoId, historySanitizado, lastAgentNormalizado);

      const newItems: RunItem[] = result.newItems;
      if (newItems && Array.isArray(newItems)) {
        const toolCalls = newItems.filter(
          (i: RunItem) =>
            i.type === 'tool_call_item' ||
            i.type === 'tool_call_output_item'
        );

        const handoffs = newItems.filter(
          (i: RunItem) => i.type === 'handoff_call_item' || i.type === 'handoff_output_item'
        );

        const nomesToolsTurno = toolCalls
          .map((i: RunItem) => ('name' in i ? (i as unknown as Record<string, unknown>).name as string : undefined) || ('toolName' in i ? (i as unknown as Record<string, unknown>).toolName as string : undefined))
          .filter((n): n is string => typeof n === 'string' && n.length > 0);

        const toolCallsTurno = toolCalls.length;
        const handoffsTurno = handoffs.length;

        const stats = await getCacheStats();
        logger.debug(
          `[ORCHESTRATOR] 📊 Turno SDK: ${newItems.length} itens gerados (${toolCalls.length} tool calls, ${handoffs.length} handoffs). Cache: ${stats.redisKeys} Redis + ${stats.memoryKeys} memória.`
        );

        return {
          nomesToolsTurno,
          toolCallsTurno,
          handoffsTurno,
        };
      }
    }
  } catch (histErr) {
    logger.warn({ err: histErr }, '[HISTORY-PERSISTENCE] Erro ao persistir histórico SDK');
  }

  return retornoPadrao;
}
