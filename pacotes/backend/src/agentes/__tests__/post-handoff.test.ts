import { processarPosHandoff } from '../post-handoff';

describe('processarPosHandoff', () => {
  it('retorna sem ações quando não houve handoff', async () => {
    const atualizarUltimoAgente = jest.fn();
    const getHistoryContato = jest.fn();

    const result = await processarPosHandoff({
      contatoId: 'contato-1',
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      atualizarUltimoAgente,
      getHistoryContato,
      setHistoryContato: jest.fn(),
      gerarBriefing: jest.fn(),
    });

    expect(result.houveHandoff).toBe(false);
    expect(atualizarUltimoAgente).not.toHaveBeenCalled();
    expect(getHistoryContato).not.toHaveBeenCalled();
  });

  it('atualiza cache de último agente quando houve handoff SDR→ADMIN', async () => {
    const atualizarUltimoAgente = jest.fn();

    const result = await processarPosHandoff({
      contatoId: 'contato-1',
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'ADMIN',
      atualizarUltimoAgente,
      getHistoryContato: jest.fn().mockResolvedValue(undefined),
      setHistoryContato: jest.fn(),
      gerarBriefing: jest.fn(),
    });

    expect(result.houveHandoff).toBe(true);
    expect(atualizarUltimoAgente).toHaveBeenCalledWith('contato-1', 'ADMIN');
  });

  it('injeta briefing no topo do histórico quando disponível', async () => {
    const atualizarUltimoAgente = jest.fn();
    const setHistoryContato = jest.fn().mockResolvedValue(undefined);
    const getHistoryContato = jest
      .fn()
      .mockResolvedValue([{ role: 'message', content: 'hist-1' }]);
    const gerarBriefing = jest
      .fn()
      .mockResolvedValue({ role: 'system', content: 'briefing' });

    await processarPosHandoff({
      contatoId: 'contato-1',
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'ADMIN',
      atualizarUltimoAgente,
      getHistoryContato,
      setHistoryContato,
      gerarBriefing,
    });

    expect(gerarBriefing).toHaveBeenCalledWith(
      [{ role: 'message', content: 'hist-1' }],
      'SDR',
      'ADMIN'
    );
    expect(setHistoryContato).toHaveBeenCalledWith(
      'contato-1',
      [
        { role: 'system', content: 'briefing' },
        { role: 'message', content: 'hist-1' },
      ],
      'ADMIN'
    );
  });

  it('não lança erro quando geração de briefing falha', async () => {
    const atualizarUltimoAgente = jest.fn();

    await expect(
      processarPosHandoff({
        contatoId: 'contato-1',
        tipoAgente: 'SDR',
        agenteQueRespondeuFormatado: 'ADMIN',
        atualizarUltimoAgente,
        getHistoryContato: jest.fn().mockRejectedValue(new Error('falhou cache')),
        setHistoryContato: jest.fn(),
        gerarBriefing: jest.fn(),
      })
    ).resolves.toEqual({ houveHandoff: true });
  });
});
