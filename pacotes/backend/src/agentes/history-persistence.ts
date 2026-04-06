import { getCacheStats, setHistory } from './conversation-cache';
import { removeHandoffNarration, sliceHistoryPreservingSystem } from './handoff-filters';
import { logger } from '../lib/logger';

function normalizarNomeAgente(nome?: string): string | undefined {
  if (!nome) return undefined;

  const mapa: Record<string, string> = {
    OPENER: 'OPENER',
    PRESENTER: 'PRESENTER',
    ADMIN: 'ADMIN',
    CLOSER: 'PRESENTER',
    opener_agent_v11: 'OPENER',
    opener_agent_v12: 'OPENER',
    presenter_agent_v4: 'PRESENTER',
    presenter_agent_v5: 'PRESENTER',
    closer_agent_v5: 'PRESENTER',
    admin_agent_v4: 'ADMIN',
  };

  return mapa[nome] || nome;
}

export interface PersistenciaHistoryResult {
  nomesToolsTurno: string[];
  toolCallsTurno: number;
  handoffsTurno: number;
}

export async function persistirHistoricoSdk(
  contatoId: string,
  result: any
): Promise<PersistenciaHistoryResult> {
  const retornoPadrao: PersistenciaHistoryResult = {
    nomesToolsTurno: [],
    toolCallsTurno: 0,
    handoffsTurno: 0,
  };

  try {
    const history = (result as any).history;
    if (history && Array.isArray(history)) {
      const lastAgentName = (result as any).lastAgent?.name;
      const lastAgentNormalizado = normalizarNomeAgente(lastAgentName);
      const historySemNarracao = removeHandoffNarration(history as any);
      const historyFinal = sliceHistoryPreservingSystem(historySemNarracao as any, 20, 'Persistência Orchestrator');
      await setHistory(contatoId, historyFinal, lastAgentNormalizado);

      const newItems = (result as any).newItems;
      if (newItems && Array.isArray(newItems)) {
        const toolCalls = newItems.filter(
          (i: any) =>
            i.type === 'tool_call_item' ||
            i.type === 'tool_call_output_item' ||
            i.type === 'function_call' ||
            i.type === 'function_call_result'
        );

        const handoffs = newItems.filter(
          (i: any) => i.type === 'handoff_call_item' || i.type === 'handoff_output_item'
        );

        const nomesToolsTurno = toolCalls
          .map((i: any) => i.name || i.tool_name)
          .filter((n: any) => typeof n === 'string' && n.length > 0);

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
    logger.warn("[erro capturado]");
  }

  return retornoPadrao;
}
