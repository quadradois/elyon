const mockSetHistory = jest.fn();
const mockGetCacheStats = jest.fn();
const mockRemoveHandoffNarration = jest.fn();
const mockSliceHistoryPreservingSystem = jest.fn();

jest.mock('../conversation-cache', () => ({
  setHistory: (...args: any[]) => mockSetHistory(...args),
  getCacheStats: (...args: any[]) => mockGetCacheStats(...args),
}));

jest.mock('../handoff-filters', () => ({
  removeHandoffNarration: (...args: any[]) => mockRemoveHandoffNarration(...args),
  sliceHistoryPreservingSystem: (...args: any[]) => mockSliceHistoryPreservingSystem(...args),
}));

import { persistirHistoricoSdk } from '../history-persistence';

describe('persistirHistoricoSdk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCacheStats.mockResolvedValue({ redisKeys: 1, memoryKeys: 2 });
    mockRemoveHandoffNarration.mockImplementation((h: any) => h);
    mockSliceHistoryPreservingSystem.mockImplementation((h: any) => h);
  });

  it('persiste history e retorna métricas de tool calls/handoffs', async () => {
    const result = await persistirHistoricoSdk('contato-1', {
      history: [{ role: 'user', content: 'Oi' }],
      lastAgent: { name: 'presenter_agent_v4' },
      newItems: [
        { type: 'tool_call_item', name: 'qualificar_lead' },
        { type: 'tool_call_output_item', name: 'qualificar_lead', output: '{"success":true}' },
        { type: 'handoff_call_item' },
      ],
    } as any);

    expect(mockRemoveHandoffNarration).toHaveBeenCalled();
    expect(mockSliceHistoryPreservingSystem).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Oi' }],
      40,
      'Persistência Orchestrator'
    );
    expect(mockSetHistory).toHaveBeenCalledWith(
      'contato-1',
      [{ role: 'user', content: 'Oi' }],
      'SDR'
    );

    expect(result).toEqual({
      nomesToolsTurno: ['qualificar_lead'],
      nomesToolsSucessoTurno: ['qualificar_lead'],
      toolCallsTurno: 1,
      handoffsTurno: 1,
    });
  });

  it('retorna zeros quando history não existe', async () => {
    const result = await persistirHistoricoSdk('contato-2', {
      history: null,
    } as any);

    expect(mockSetHistory).not.toHaveBeenCalled();
    expect(result).toEqual({
      nomesToolsTurno: [],
      nomesToolsSucessoTurno: [],
      toolCallsTurno: 0,
      handoffsTurno: 0,
    });
  });

  it('preserva evidência da tool no formato real do SDK quando o cache falha', async () => {
    mockSetHistory.mockRejectedValueOnce(new Error('Falha cache'));

    const result = await persistirHistoricoSdk('contato-3', {
      history: [{ role: 'user', content: 'Oi' }],
      lastAgent: { name: 'opener_agent_v11' },
      newItems: [
        {
          type: 'tool_call_item',
          rawItem: { type: 'function_call', callId: 'call-cancel-1', name: 'cancelar_agendamento' },
        },
        {
          type: 'tool_call_output_item',
          rawItem: { type: 'function_call_result', callId: 'call-cancel-1' },
          output: '{"success":true,"statusAgendamento":"CANCELADO"}',
        },
      ],
    } as any);

    expect(result).toEqual({
      nomesToolsTurno: ['cancelar_agendamento'],
      nomesToolsSucessoTurno: ['cancelar_agendamento'],
      toolCallsTurno: 1,
      handoffsTurno: 0,
    });
  });

  it('não registra sucesso quando a tool retorna success=false', async () => {
    const result = await persistirHistoricoSdk('contato-4', {
      history: [{ role: 'user', content: 'Cancele' }],
      newItems: [
        {
          type: 'tool_call_item',
          rawItem: { type: 'function_call', callId: 'call-cancel-2', name: 'cancelar_agendamento' },
        },
        {
          type: 'tool_call_output_item',
          rawItem: { type: 'function_call_result', callId: 'call-cancel-2' },
          output: '{"success":false,"reasonCode":"NO_ACTIVE_APPOINTMENT"}',
        },
      ],
    } as any);

    expect(result.nomesToolsTurno).toEqual(['cancelar_agendamento']);
    expect(result.nomesToolsSucessoTurno).toEqual([]);
  });
});
