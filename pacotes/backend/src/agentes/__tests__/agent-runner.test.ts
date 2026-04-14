import { executarAgenteComRetry } from '../agent-runner';

describe('executarAgenteComRetry', () => {
  const agenteFake = { name: 'agente_teste' } as any;
  const contextFake = { tenantId: 'tenant-1' } as any;

  it('executa run uma vez quando não há erro', async () => {
    const runMock = jest.fn().mockResolvedValue({ finalOutput: 'ok' });
    const limparMock = jest.fn().mockResolvedValue(undefined);

    const result = await executarAgenteComRetry({
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
    // Deve passar maxTurns como option
    expect(runMock).toHaveBeenCalledWith(
      agenteFake,
      [{ role: 'user', content: 'Olá' }],
      expect.objectContaining({ maxTurns: 15 }),
    );
    expect(limparMock).not.toHaveBeenCalled();
    expect(result.result.finalOutput).toBe('ok');
    expect(result.inputSDKFinal).toEqual([{ role: 'user', content: 'Olá' }]);
  });

  it('faz retry quando erro é tool_call_id not found', async () => {
    const runMock = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('tool_call_id abc123 is not found'), { status: 400 }))
      .mockResolvedValueOnce({ finalOutput: 'ok-retry' });
    const limparMock = jest.fn().mockResolvedValue(undefined);

    const result = await executarAgenteComRetry({
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

  it('propaga erro original quando não é tool_call_id', async () => {
    const runMock = jest.fn().mockRejectedValue(new Error('outro erro'));

    await expect(
      executarAgenteComRetry({
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

  it('respeita maxTurns customizado', async () => {
    const runMock = jest.fn().mockResolvedValue({ finalOutput: 'ok' });

    await executarAgenteComRetry({
      agente: agenteFake,
      inputSDK: [{ role: 'user', content: 'Olá' }],
      elyonContext: contextFake,
      mensagensLength: 1,
      construirInputSemCache: () => [],
      limparHistoricoContato: jest.fn().mockResolvedValue(undefined),
      executarRun: runMock as any,
      maxTurns: 5,
    });

    expect(runMock).toHaveBeenCalledWith(
      agenteFake,
      expect.anything(),
      expect.objectContaining({ maxTurns: 5 }),
    );
  });

  // ====================================
  // FALLBACK ENTRE PROVEDORES
  // ====================================

  it('ativa fallback de provedor quando erro é 5xx e criarAgenteFallback fornecido', async () => {
    const erro500 = Object.assign(new Error('Internal Server Error'), { status: 500 });
    const runMock = jest
      .fn()
      .mockRejectedValueOnce(erro500)
      .mockResolvedValueOnce({ finalOutput: 'fallback-ok' });
    const agenteFallback = { name: 'agente_fallback' } as any;
    const criarAgenteFallbackMock = jest.fn().mockReturnValue(agenteFallback);

    const result = await executarAgenteComRetry({
      agente: agenteFake,
      inputSDK: [{ role: 'user', content: 'Olá' }],
      elyonContext: contextFake,
      mensagensLength: 1,
      construirInputSemCache: () => [],
      limparHistoricoContato: jest.fn().mockResolvedValue(undefined),
      executarRun: runMock as any,
      criarAgenteFallback: criarAgenteFallbackMock,
    });

    expect(runMock).toHaveBeenCalledTimes(2);
    expect(criarAgenteFallbackMock).toHaveBeenCalledTimes(1);
    // Segundo call deve usar o agente fallback
    expect(runMock.mock.calls[1][0]).toBe(agenteFallback);
    expect(result.result.finalOutput).toBe('fallback-ok');
    expect(result.usouFallbackProvedor).toBe(true);
  });

  it('ativa fallback de provedor no rate limit (429)', async () => {
    const erro429 = Object.assign(new Error('Rate limit exceeded'), { status: 429 });
    const runMock = jest
      .fn()
      .mockRejectedValueOnce(erro429)
      .mockResolvedValueOnce({ finalOutput: 'rate-limit-fallback' });
    const criarAgenteFallbackMock = jest.fn().mockReturnValue({ name: 'fallback' });

    const result = await executarAgenteComRetry({
      agente: agenteFake,
      inputSDK: [{ role: 'user', content: 'Olá' }],
      elyonContext: contextFake,
      mensagensLength: 1,
      construirInputSemCache: () => [],
      limparHistoricoContato: jest.fn().mockResolvedValue(undefined),
      executarRun: runMock as any,
      criarAgenteFallback: criarAgenteFallbackMock,
    });

    expect(result.usouFallbackProvedor).toBe(true);
  });

  it('ativa fallback de provedor no timeout/rede', async () => {
    const erroTimeout = new Error('connect ECONNREFUSED 10.0.0.1:443');
    const runMock = jest
      .fn()
      .mockRejectedValueOnce(erroTimeout)
      .mockResolvedValueOnce({ finalOutput: 'timeout-fallback' });

    const result = await executarAgenteComRetry({
      agente: agenteFake,
      inputSDK: [{ role: 'user', content: 'Olá' }],
      elyonContext: contextFake,
      mensagensLength: 1,
      construirInputSemCache: () => [],
      limparHistoricoContato: jest.fn().mockResolvedValue(undefined),
      executarRun: runMock as any,
      criarAgenteFallback: jest.fn().mockReturnValue({ name: 'fallback' }),
    });

    expect(result.usouFallbackProvedor).toBe(true);
  });

  it('NÃO ativa fallback quando criarAgenteFallback não é fornecido (provedor plataforma)', async () => {
    const erro500 = Object.assign(new Error('Internal Server Error'), { status: 500 });
    const runMock = jest.fn().mockRejectedValue(erro500);

    await expect(
      executarAgenteComRetry({
        agente: agenteFake,
        inputSDK: [{ role: 'user', content: 'Olá' }],
        elyonContext: contextFake,
        mensagensLength: 1,
        construirInputSemCache: () => [],
        limparHistoricoContato: jest.fn().mockResolvedValue(undefined),
        executarRun: runMock as any,
        // criarAgenteFallback NÃO fornecido
      })
    ).rejects.toThrow('Internal Server Error');

    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it('lança erro ORIGINAL quando fallback também falha', async () => {
    const erroOriginal = Object.assign(new Error('OpenRouter caiu'), { status: 502 });
    const erroFallback = new Error('OpenAI também caiu');
    const runMock = jest
      .fn()
      .mockRejectedValueOnce(erroOriginal)
      .mockRejectedValueOnce(erroFallback);

    await expect(
      executarAgenteComRetry({
        agente: agenteFake,
        inputSDK: [{ role: 'user', content: 'Olá' }],
        elyonContext: contextFake,
        mensagensLength: 1,
        construirInputSemCache: () => [],
        limparHistoricoContato: jest.fn().mockResolvedValue(undefined),
        executarRun: runMock as any,
        criarAgenteFallback: jest.fn().mockReturnValue({ name: 'fallback' }),
      })
    ).rejects.toThrow('OpenRouter caiu'); // Deve lançar o erro ORIGINAL

    expect(runMock).toHaveBeenCalledTimes(2);
  });

  it('NÃO ativa fallback para erro 400 (não é infra)', async () => {
    const erro400 = Object.assign(new Error('Invalid request'), { status: 400 });
    const runMock = jest.fn().mockRejectedValue(erro400);
    const criarAgenteFallbackMock = jest.fn();

    await expect(
      executarAgenteComRetry({
        agente: agenteFake,
        inputSDK: [{ role: 'user', content: 'Olá' }],
        elyonContext: contextFake,
        mensagensLength: 1,
        construirInputSemCache: () => [],
        limparHistoricoContato: jest.fn().mockResolvedValue(undefined),
        executarRun: runMock as any,
        criarAgenteFallback: criarAgenteFallbackMock,
      })
    ).rejects.toThrow('Invalid request');

    // Fallback NÃO deve ser chamado para erro 400 genérico
    expect(criarAgenteFallbackMock).not.toHaveBeenCalled();
  });
});
