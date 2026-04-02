import { executarAgenteComRetryReasoning } from '../agent-runner';

describe('executarAgenteComRetryReasoning', () => {
  const agenteFake = { name: 'agente_teste' } as any;
  const contextFake = { tenantId: 'tenant-1' } as any;

  it('executa run uma vez quando não há erro', async () => {
    const runMock = jest.fn().mockResolvedValue({ finalOutput: 'ok' });
    const limparMock = jest.fn().mockResolvedValue(undefined);

    const result = await executarAgenteComRetryReasoning({
      agente: agenteFake,
      inputSDK: [{ role: 'user', content: 'Olá' }],
      elyonContext: contextFake,
      cachedHistory: [{ role: 'system', content: 'hist' }],
      contatoId: 'contato-1',
      mensagensLength: 1,
      construirInputSemCache: () => [{ role: 'system', content: 'novo' }],
      limparHistoricoContato: limparMock,
      executarRun: runMock as any,
    });

    expect(runMock).toHaveBeenCalledTimes(1);
    expect(limparMock).not.toHaveBeenCalled();
    expect(result.result.finalOutput).toBe('ok');
    expect(result.inputSDKFinal).toEqual([{ role: 'user', content: 'Olá' }]);
  });

  it('faz retry quando erro é reasoning_content e há cachedHistory', async () => {
    const runMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('reasoning_content is missing'))
      .mockResolvedValueOnce({ finalOutput: 'ok-retry' });
    const limparMock = jest.fn().mockResolvedValue(undefined);

    const result = await executarAgenteComRetryReasoning({
      agente: agenteFake,
      inputSDK: [{ role: 'user', content: 'Olá' }],
      elyonContext: contextFake,
      cachedHistory: [{ role: 'system', content: 'hist' }],
      contatoId: 'contato-1',
      mensagensLength: 3,
      construirInputSemCache: () => [{ role: 'system', content: 'novo-input' }],
      limparHistoricoContato: limparMock,
      executarRun: runMock as any,
    });

    expect(runMock).toHaveBeenCalledTimes(2);
    expect(limparMock).toHaveBeenCalledWith('contato-1');
    expect(result.result.finalOutput).toBe('ok-retry');
    expect(result.inputSDKFinal).toEqual([{ role: 'system', content: 'novo-input' }]);
  });

  it('propaga erro original quando não é reasoning_content', async () => {
    const runMock = jest.fn().mockRejectedValue(new Error('outro erro'));;

    await expect(
      executarAgenteComRetryReasoning({
        agente: agenteFake,
        inputSDK: [{ role: 'user', content: 'Olá' }],
        elyonContext: contextFake,
        cachedHistory: [{ role: 'system', content: 'hist' }],
        contatoId: 'contato-1',
        mensagensLength: 1,
        construirInputSemCache: () => [{ role: 'system', content: 'novo' }],
        limparHistoricoContato: jest.fn().mockResolvedValue(undefined),
        executarRun: runMock as any,
      })
    ).rejects.toThrow('outro erro');

    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it('não faz retry quando não há cachedHistory', async () => {
    const runMock = jest.fn().mockRejectedValue(new Error('reasoning_content is missing'));

    await expect(
      executarAgenteComRetryReasoning({
        agente: agenteFake,
        inputSDK: [{ role: 'user', content: 'Olá' }],
        elyonContext: contextFake,
        cachedHistory: [],
        contatoId: 'contato-1',
        mensagensLength: 1,
        construirInputSemCache: () => [{ role: 'system', content: 'novo' }],
        limparHistoricoContato: jest.fn().mockResolvedValue(undefined),
        executarRun: runMock as any,
      })
    ).rejects.toThrow('reasoning_content is missing');

    expect(runMock).toHaveBeenCalledTimes(1);
  });
});
