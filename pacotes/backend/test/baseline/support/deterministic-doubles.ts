import { prisma } from '../../../src/lib/db';
import { createHash } from 'crypto';

export const captured = {
  orchestrator: [] as Array<{ messages: unknown; config: unknown; context: unknown }>,
  sent: [] as Array<{ phone: string; body: string }>,
  failMidCommand: false,
};

export function resetDoubles(): void {
  captured.orchestrator.splice(0); captured.sent.splice(0); captured.failMidCommand = false;
}

export async function deterministicOrchestrator(messages: unknown, config: unknown, context: any) {
  captured.orchestrator.push({ messages, config, context });
  const text = JSON.stringify(messages).toLowerCase();
  const canonicalLeadId = context.leadId || context.contatoId;
  await prisma.$transaction(async (tx) => {
    if (text.includes('qualificar')) {
      await tx.lead.update({ where: { id: canonicalLeadId }, data: { schemaState: { qualificationPolicyVersion: 'spin-candidate-v1', evidence: { situation: true, motivation: true } }, statusProspeccao: 'LEAD' } });
      await tx.atividade.create({ data: { leadId: canonicalLeadId, tipo: 'NOTA', titulo: 'TOOL_EXEC:QUALIFY', descricao: 'policy=spin-candidate-v1' } });
    }
    if (text.includes('opt-out')) await tx.lead.update({ where: { id: canonicalLeadId }, data: { statusProspeccao: 'OPTOUT' } });
    if (text.includes('falhar comando')) {
      await tx.lead.update({ where: { id: canonicalLeadId }, data: { observacoes: 'MUTACAO_QUE_DEVE_ROLLBACK' } });
      await tx.atividade.create({ data: { leadId: canonicalLeadId, tipo: 'NOTA', titulo: 'TOOL_EXEC:FAIL' } });
      if (captured.failMidCommand) throw new Error('falha determinística no meio do comando');
    }
  });
  const respostaId = createHash('sha256').update(text).digest('hex').slice(0, 12);
  return { sucesso: true, resposta: `Resposta determinística ${respostaId}` };
}
