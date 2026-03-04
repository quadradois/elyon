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
        { type: 'handoff_call_item' },
      ],
    });

    expect(mockRemoveHandoffNarration).toHaveBeenCalled();
    expect(mockSliceHistoryPreservingSystem).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Oi' }],
      20,
      'Persistência Orchestrator'
    );
    expect(mockSetHistory).toHaveBeenCalledWith(
      'contato-1',
      [{ role: 'user', content: 'Oi' }],
      'presenter_agent_v4'
    );

    expect(result).toEqual({
      nomesToolsTurno: ['qualificar_lead'],
      toolCallsTurno: 1,
      handoffsTurno: 1,
    });
  });

  it('retorna zeros quando history não existe', async () => {
    const result = await persistirHistoricoSdk('contato-2', {
      history: null,
    });

    expect(mockSetHistory).not.toHaveBeenCalled();
    expect(result).toEqual({
      nomesToolsTurno: [],
      toolCallsTurno: 0,
      handoffsTurno: 0,
    });
  });

  it('retorna zeros quando ocorre erro interno', async () => {
    mockSetHistory.mockRejectedValueOnce(new Error('Falha cache'));

    const result = await persistirHistoricoSdk('contato-3', {
      history: [{ role: 'user', content: 'Oi' }],
      lastAgent: { name: 'opener_agent_v11' },
      newItems: [{ type: 'tool_call_item', name: 'buscar_contexto' }],
    });

    expect(result).toEqual({
      nomesToolsTurno: [],
      toolCallsTurno: 0,
      handoffsTurno: 0,
    });
  });
});
