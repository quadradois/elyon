import type { RunResult } from '@openai/agents';
import type { ElyonContext } from './elyon-context';

export interface MessageItem {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null;
    name?: string;
    tool_calls?: any[];
    tool_call_id?: string;
    reasoning_content?: string;
    function_call?: any;
}

export interface ConversationHistoryItem extends MessageItem {
    id?: string;
    leadId?: string;
}

export interface AgentRunResult {
    output: any; // O resultado final (string ou parsed json)
    agentRunResult?: RunResult<ElyonContext, any>; // resultado interno do SDK @openai/agents
    messages?: MessageItem[];
    context: ElyonContext;
}

export interface WebhookInputData {
    messageText: string;
    contactPhone: string;
    contactName?: string;
}
