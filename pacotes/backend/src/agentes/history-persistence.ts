import { getCacheStats, setHistory } from './conversation-cache';
import { removeHandoffNarration, sliceHistoryPreservingSystem } from './handoff-filters';

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
      const historySemNarracao = removeHandoffNarration(history as any);
      const historyFinal = sliceHistoryPreservingSystem(historySemNarracao as any, 20, 'Persistência Orchestrator');
      await setHistory(contatoId, historyFinal, lastAgentName);

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
        console.log(
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
    console.warn('[ORCHESTRATOR] ⚠️ Erro ao salvar history SDK (não-crítico):', histErr);
  }

  return retornoPadrao;
}
