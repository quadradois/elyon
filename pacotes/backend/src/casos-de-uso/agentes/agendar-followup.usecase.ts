import { criarFollowupOutbound, reagendarFollowupOutbound } from '../../servicos/followup-outbound';
import type { FollowupRequestIdentity } from '../../servicos/followup-outbound';

export interface AgendarFollowupInput {
  tenantId: string; leadId: string; dataRecontato: string; timezoneIana: string;
  motivo: string; mensagemEnvio: string; evidenciaPedido: string; origemPedido: string;
  requestIdentity: FollowupRequestIdentity; policyVersion?: string;
  followupId?: string;
}

export class AgendarFollowupUseCase {
  async execute(input: AgendarFollowupInput) {
    try {
      const params = { tenantId: input.tenantId, leadId: input.leadId,
        expressaoOriginal: input.dataRecontato, timezoneIana: input.timezoneIana, motivo: input.motivo,
        mensagemEnvio: input.mensagemEnvio, evidenciaPedido: input.evidenciaPedido,
        origemPedido: input.origemPedido, requestIdentity: input.requestIdentity, policyVersion: input.policyVersion };
      const result = input.followupId
        ? await reagendarFollowupOutbound({ ...params, followupId: input.followupId })
        : await criarFollowupOutbound(params);
      if (!result.success) return { success: false, error: result.reasonCode, reasonCode: result.reasonCode };
      return { success: true, message: result.deduplicado ? 'Follow-up ja existente' : 'Follow-up agendado',
        followupId: result.followup.id, dataRecontato: result.followup.agendadoParaUtc.toISOString(), deduplicado: result.deduplicado,
        reasonCode: 'reasonCode' in result ? result.reasonCode : undefined,
        requestOutcome: 'requestOutcome' in result ? result.requestOutcome : undefined };
    } catch (error) {
      const reasonCode = error instanceof Error ? error.message.split(':')[0] : 'FOLLOWUP_CREATE_FAILED';
      return { success: false, error: reasonCode, reasonCode };
    }
  }
}
