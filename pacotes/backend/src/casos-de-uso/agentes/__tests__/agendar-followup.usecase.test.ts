const criarFollowupOutbound = jest.fn();
jest.mock('../../../servicos/followup-outbound', () => ({ criarFollowupOutbound: (...args: unknown[]) => criarFollowupOutbound(...args) }));
import { AgendarFollowupUseCase } from '../agendar-followup.usecase';

describe('AgendarFollowupUseCase', () => {
  beforeEach(() => jest.clearAllMocks());
  it('propaga contrato estruturado e retorna o agregado duravel', async () => {
    criarFollowupOutbound.mockResolvedValue({ success: true, deduplicado: false, followup: { id: 'f1', agendadoParaUtc: new Date('2027-01-01T12:00:00Z') } });
    const result = await new AgendarFollowupUseCase().execute({ tenantId: 't1', leadId: 'l1', dataRecontato: '01/01/2027 09:00', timezoneIana: 'America/Sao_Paulo', motivo: 'Retorno pedido', mensagemEnvio: 'Posso retomar nosso contato?', evidenciaPedido: 'pode me chamar dia 1', origemPedido: 'TOOL', policyVersion: 'followup-v1' });
    expect(result).toMatchObject({ success: true, followupId: 'f1', deduplicado: false });
    expect(criarFollowupOutbound).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't1', leadId: 'l1', timezoneIana: 'America/Sao_Paulo', evidenciaPedido: 'pode me chamar dia 1' }));
  });
  it('preserva reason code de esclarecimento sem persistir', async () => {
    criarFollowupOutbound.mockResolvedValue({ success: false, reasonCode: 'DATE_AMBIGUOUS' });
    await expect(new AgendarFollowupUseCase().execute({ tenantId: 't1', leadId: 'l1', dataRecontato: 'depois', timezoneIana: 'America/Sao_Paulo', motivo: 'pensar', mensagemEnvio: 'Posso retomar nosso contato?', evidenciaPedido: 'depois', origemPedido: 'TOOL' })).resolves.toMatchObject({ success: false, reasonCode: 'DATE_AMBIGUOUS' });
  });
});
