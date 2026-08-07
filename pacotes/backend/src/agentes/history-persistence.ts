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
  nomesToolsSucessoTurno: string[];
  toolCallsTurno: number;
  handoffsTurno: number;
}

function lerRegistro(valor: unknown): Record<string, unknown> | undefined {
  return valor && typeof valor === 'object' ? valor as Record<string, unknown> : undefined;
}

function lerTexto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim().length > 0 ? valor : undefined;
}

function nomeToolDoItem(item: RunItem): string | undefined {
  const registro = lerRegistro(item);
  const rawItem = lerRegistro(registro?.rawItem);
  return lerTexto(registro?.name)
    || lerTexto(registro?.toolName)
    || lerTexto(rawItem?.name)
    || lerTexto(rawItem?.toolName);
}

function callIdDoItem(item: RunItem): string | undefined {
  const registro = lerRegistro(item);
  const rawItem = lerRegistro(registro?.rawItem);
  return lerTexto(registro?.callId)
    || lerTexto(registro?.toolCallId)
    || lerTexto(rawItem?.callId)
    || lerTexto(rawItem?.toolCallId);
}

function resultadoToolDoItem(item: RunItem): Record<string, unknown> | undefined {
  const registro = lerRegistro(item);
  const rawItem = lerRegistro(registro?.rawItem);
  const output = registro?.output ?? rawItem?.output;
  if (typeof output === 'string') {
    try {
      return lerRegistro(JSON.parse(output));
    } catch {
      return undefined;
    }
  }
  return lerRegistro(output);
}

export function extrairEvidenciasTools(newItems?: RunItem[]): PersistenciaHistoryResult {
  const items = Array.isArray(newItems) ? newItems : [];
  const chamadas = items.filter((item) => item.type === 'tool_call_item');
  const saidas = items.filter((item) => item.type === 'tool_call_output_item');
  const handoffs = items.filter(
    (item) => item.type === 'handoff_call_item' || item.type === 'handoff_output_item'
  );
  const nomePorCallId = new Map<string, string>();

  for (const chamada of chamadas) {
    const callId = callIdDoItem(chamada);
    const nome = nomeToolDoItem(chamada);
    if (callId && nome) nomePorCallId.set(callId, nome);
  }

  const nomesToolsTurno = [...new Set(chamadas
    .map(nomeToolDoItem)
    .filter((nome): nome is string => Boolean(nome)))];
  const nomesToolsSucessoTurno = [...new Set(saidas
    .filter((saida) => resultadoToolDoItem(saida)?.success === true)
    .map((saida) => nomeToolDoItem(saida) || nomePorCallId.get(callIdDoItem(saida) || ''))
    .filter((nome): nome is string => Boolean(nome)))];

  return {
    nomesToolsTurno,
    nomesToolsSucessoTurno,
    toolCallsTurno: chamadas.length,
    handoffsTurno: handoffs.length,
  };
}

export async function persistirHistoricoSdk(
  contatoId: string,
  result: ElyonRunResult
): Promise<PersistenciaHistoryResult> {
  // A evidência de execução pertence ao resultado do turno e não pode depender
  // do Redis/histórico. O efeito da tool pode ter sido persistido mesmo quando
  // o cache falha em seguida.
  const evidencias = extrairEvidenciasTools(result.newItems);

  try {
    const history = result.history;
    if (history && Array.isArray(history)) {
      const lastAgentName = result.lastAgent?.name;
      const lastAgentNormalizado = normalizarNomeAgente(lastAgentName);
      const historySemNarracao = removeHandoffNarration(history);
      const historyFinal = sliceHistoryPreservingSystem(historySemNarracao, 40, 'Persistência Orchestrator');
      const historySanitizado = sanitizeHistoryForToolProtocol(historyFinal, 'Persistência Orchestrator');
      await setHistory(contatoId, historySanitizado, lastAgentNormalizado);

      const stats = await getCacheStats();
      logger.debug(
        `[ORCHESTRATOR] 📊 Turno SDK: ${result.newItems?.length || 0} itens gerados (${evidencias.toolCallsTurno} tool calls, ${evidencias.handoffsTurno} handoffs). Cache: ${stats.redisKeys} Redis + ${stats.memoryKeys} memória.`
      );
    }
  } catch (histErr) {
    logger.warn({ err: histErr }, '[HISTORY-PERSISTENCE] Erro ao persistir histórico SDK');
  }

  return evidencias;
}
