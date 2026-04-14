import type { Agent, AgentInputItem, RunResult, RunItem } from '@openai/agents';
import type { AgentOutputType } from '@openai/agents-core';
import type { ElyonContext } from './elyon-context';

// ====================================
// ALIASES DE TIPOS SDK
// ====================================

/** Agente tipado com contexto Elyon (TextOutput default; SDR/Admin usam cast para resultType Zod) */
export type ElyonAgent = Agent<ElyonContext>;

/** Resultado de run() tipado para ElyonContext */
export type ElyonRunResult = RunResult<ElyonContext, Agent<ElyonContext, AgentOutputType>>;

/** Item de entrada do SDK (user msg, assistant msg, tool call, etc.) */
export type { AgentInputItem, RunItem };

/** Item de histórico de conversa SDK (cache/persistência) */
export type ConversationHistory = AgentInputItem[];

// ====================================
// TIPOS INTERNOS
// ====================================

export interface MessageItem {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null;
    name?: string;
    tool_calls?: Record<string, unknown>[];
    tool_call_id?: string;
    reasoning_content?: string;
    function_call?: Record<string, unknown>;
}

export interface ConversationHistoryItem extends MessageItem {
    id?: string;
    leadId?: string;
}

export interface AgentRunResult {
    output: string | Record<string, unknown>;
    agentRunResult?: ElyonRunResult;
    messages?: MessageItem[];
    context: ElyonContext;
}

export interface WebhookInputData {
    messageText: string;
    contactPhone: string;
    contactName?: string;
}

// ====================================
// CONFIG BYOK (usado para tipagem de resolverChaveAgentes)
// ====================================

/** Campos BYOK do Tenant para resolverChaveAgentes (evita `config as any`) */
export interface ByokTenantConfig {
    llmProvedor?: string | null;
    llmModelo?: string | null;
    llmApiKeyCriptografada?: string | null;
    llmBaseUrl?: string | null;
    llmApiKey?: string;
}
