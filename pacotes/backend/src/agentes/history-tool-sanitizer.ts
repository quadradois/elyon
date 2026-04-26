import type { AgentInputItem } from '@openai/agents';
import { logger } from '../lib/logger';

type GenericRecord = Record<string, unknown>;

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function extractAssistantToolCallIds(item: AgentInputItem): string[] {
  const rec = item as GenericRecord;
  const ids: string[] = [];
  const toolCalls = rec.tool_calls;

  if (!Array.isArray(toolCalls)) return ids;

  for (const rawCall of toolCalls) {
    if (rawCall && typeof rawCall === 'object') {
      const id = readString((rawCall as GenericRecord).id);
      if (id) ids.push(id);
    }
  }

  return ids;
}

function extractToolCallId(item: AgentInputItem): string | undefined {
  const rec = item as GenericRecord;

  return (
    readString(rec.tool_call_id)
    || readString(rec.toolCallId)
    || readString(rec.call_id)
    || readString(rec.callId)
    || readString(rec.id)
  );
}

/**
 * Remove itens de tool órfãos (sem tool call correspondente no histórico anterior),
 * evitando erros 400 de provedores OpenAI-compatible:
 * "messages with role 'tool' must be a response to a preceeding message with 'tool_calls'".
 */
export function sanitizeHistoryForToolProtocol(
  history: AgentInputItem[],
  context = 'history'
): AgentInputItem[] {
  const validToolCallIds = new Set<string>();
  const sanitized: AgentInputItem[] = [];
  let removed = 0;

  for (const item of history) {
    const rec = item as GenericRecord;
    const role = readString(rec.role);
    const type = readString(rec.type);

    for (const id of extractAssistantToolCallIds(item)) {
      validToolCallIds.add(id);
    }

    if (type === 'tool_call_item') {
      const toolCallId = extractToolCallId(item);
      if (toolCallId) validToolCallIds.add(toolCallId);
      sanitized.push(item);
      continue;
    }

    if (role === 'tool' || type === 'tool_call_output_item') {
      const toolCallId = extractToolCallId(item);
      if (toolCallId && !validToolCallIds.has(toolCallId)) {
        removed += 1;
        continue;
      }
      if (!toolCallId && role === 'tool') {
        removed += 1;
        continue;
      }
    }

    sanitized.push(item);
  }

  if (removed > 0) {
    logger.warn(`[HISTORY-SANITIZER] ⚠️ ${context}: removidos ${removed} item(ns) de tool órfãos do histórico SDK.`);
  }

  return sanitized;
}

