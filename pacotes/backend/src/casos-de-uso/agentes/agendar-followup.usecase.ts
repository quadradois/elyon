import { criarFollowupOutbound } from '../../servicos/followup-outbound';

export interface AgendarFollowupInput {
  tenantId: string; leadId: string; dataRecontato: string; timezoneIana: string;
  motivo: string; evidenciaPedido: string; origemPedido: string; policyVersion?: string;
}

export class AgendarFollowupUseCase {
  async execute(input: AgendarFollowupInput) {
    try {
      const result = await criarFollowupOutbound({ tenantId: input.tenantId, leadId: input.leadId,
        expressaoOriginal: input.dataRecontato, timezoneIana: input.timezoneIana, motivo: input.motivo,
        evidenciaPedido: input.evidenciaPedido, origemPedido: input.origemPedido, policyVersion: input.policyVersion });
      if (!result.success) return { success: false, error: result.reasonCode, reasonCode: result.reasonCode };
      return { success: true, message: result.deduplicado ? 'Follow-up ja existente' : 'Follow-up agendado',
        followupId: result.followup.id, dataRecontato: result.followup.agendadoParaUtc.toISOString(), deduplicado: result.deduplicado };
    } catch (error) {
      const reasonCode = error instanceof Error ? error.message.split(':')[0] : 'FOLLOWUP_CREATE_FAILED';
      return { success: false, error: reasonCode, reasonCode };
    }
  }
}
