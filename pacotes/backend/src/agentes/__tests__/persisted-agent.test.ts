import { resolverAgentePersistido } from '../persisted-agent';

describe('resolverAgentePersistido', () => {
  it('retorna undefined sem contatoId', async () => {
    const getLastAgentFn = jest.fn();
    const atualizarUltimoAgente = jest.fn();

    const result = await resolverAgentePersistido({
      getLastAgentFn,
      atualizarUltimoAgente,
    });

    expect(result).toBeUndefined();
    expect(getLastAgentFn).not.toHaveBeenCalled();
    expect(atualizarUltimoAgente).not.toHaveBeenCalled();
  });

  it('retorna agente persistido válido e atualiza cache em memória', async () => {
    const getLastAgentFn = jest.fn().mockResolvedValue('ADMIN');
    const atualizarUltimoAgente = jest.fn();

    const result = await resolverAgentePersistido({
      contatoId: 'contato-1',
      getLastAgentFn,
      atualizarUltimoAgente,
    });

    expect(result).toBe('ADMIN');
    expect(getLastAgentFn).toHaveBeenCalledWith('contato-1');
    expect(atualizarUltimoAgente).toHaveBeenCalledWith('contato-1', 'ADMIN');
  });

  it('mapeia nome do SDK para tipo interno (presenter_agent_v4 → SDR)', async () => {
    const getLastAgentFn = jest.fn().mockResolvedValue('presenter_agent_v4');
    const atualizarUltimoAgente = jest.fn();

    const result = await resolverAgentePersistido({
      contatoId: 'contato-1',
      getLastAgentFn,
      atualizarUltimoAgente,
    });

    expect(result).toBe('SDR');
    expect(atualizarUltimoAgente).toHaveBeenCalledWith('contato-1', 'SDR');
  });

  it('migra CLOSER legado para SDR', async () => {
    const getLastAgentFn = jest.fn().mockResolvedValue('CLOSER');
    const atualizarUltimoAgente = jest.fn();

    const result = await resolverAgentePersistido({
      contatoId: 'contato-1',
      getLastAgentFn,
      atualizarUltimoAgente,
    });

    expect(result).toBe('SDR');
    expect(atualizarUltimoAgente).toHaveBeenCalledWith('contato-1', 'SDR');
  });

  it('retorna undefined para valor não reconhecido', async () => {
    const getLastAgentFn = jest.fn().mockResolvedValue('DESCONHECIDO');
    const atualizarUltimoAgente = jest.fn();

    const result = await resolverAgentePersistido({
      contatoId: 'contato-1',
      getLastAgentFn,
      atualizarUltimoAgente,
    });

    expect(result).toBeUndefined();
    expect(atualizarUltimoAgente).not.toHaveBeenCalled();
  });
});
