import type { GuardrailResult, MensagemContext } from './guardrails';

interface ExecutarGuardrailsEntradaParams {
  mensagens: Array<{ role: 'user' | 'assistant'; content: string }>;
  tenantId: string;
  telefone: string;
  contatoId?: string;
  leadId?: string;
  executarGuardrailsFn: (ctx: MensagemContext) => Promise<GuardrailResult>;
}

interface GuardrailEntradaResult {
  bloqueado: boolean;
  guardrailResult?: GuardrailResult;
}

export async function executarGuardrailsEntrada(
  params: ExecutarGuardrailsEntradaParams
): Promise<GuardrailEntradaResult> {
  const { mensagens, tenantId, telefone, contatoId, leadId, executarGuardrailsFn } = params;

  const ultimaMensagem = mensagens.filter((m) => m.role === 'user').pop();
  if (!ultimaMensagem) {
    return { bloqueado: false };
  }

  const guardrailCtx: MensagemContext = {
    telefone,
    conteudo: ultimaMensagem.content,
    tenantId,
    contatoId,
    leadId,
    timestamp: new Date(),
  };

  const guardrailResult = await executarGuardrailsFn(guardrailCtx);

  if (!guardrailResult.permitido) {
    return {
      bloqueado: true,
      guardrailResult,
    };
  }

  return { bloqueado: false };
}