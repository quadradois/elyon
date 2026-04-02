import { logAgenteResolvido, resolverAgenteFinal } from '../agent-resolution';

describe('agent-resolution', () => {
  const mapa = {
    opener_agent_v11: 'OPENER',
    presenter_agent_v4: 'PRESENTER',
    admin_agent_v4: 'ADMIN',
  } as const;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolve agente via mapa quando lastAgent.name existe', () => {
    const result = resolverAgenteFinal({
      nomeRealAgenteRespondeu: 'presenter_agent_v4',
      tipoAgenteInicial: 'OPENER',
      mapaNomesAgentes: mapa as any,
    });

    expect(result.nomeAgenteResposta).toBe('presenter_agent_v4');
    expect(result.agenteQueRespondeuFormatado).toBe('PRESENTER');
  });

  it('usa fallback OPENER quando lastAgent.name não mapeia', () => {
    const result = resolverAgenteFinal({
      nomeRealAgenteRespondeu: 'agente_desconhecido',
      tipoAgenteInicial: 'ADMIN',
      mapaNomesAgentes: mapa as any,
    });

    expect(result.nomeAgenteResposta).toBe('agente_desconhecido');
    expect(result.agenteQueRespondeuFormatado).toBe('OPENER');
  });

  it('mantém agente inicial quando lastAgent.name não existe', () => {
    const result = resolverAgenteFinal({
      tipoAgenteInicial: 'PRESENTER',
      mapaNomesAgentes: mapa as any,
    });

    expect(result.nomeAgenteResposta).toBe('PRESENTER');
    expect(result.agenteQueRespondeuFormatado).toBe('PRESENTER');
  });

  it('loga linha padronizada do agente resolvido', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    logAgenteResolvido('presenter_agent_v4', 'PRESENTER');

    expect(logSpy).toHaveBeenCalledWith(
      '[ORCHESTRATOR] ✅ Resposta gerada por: presenter_agent_v4 (Mapeado: PRESENTER)'
    );
  });
});
