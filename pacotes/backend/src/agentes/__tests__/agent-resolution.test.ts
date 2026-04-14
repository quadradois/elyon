// Mock do logger ANTES de importar o módulo
const mockLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
jest.mock('../../lib/logger', () => ({ logger: mockLogger }));

import { logAgenteResolvido, resolverAgenteFinal } from '../agent-resolution';

describe('agent-resolution', () => {
  const mapa = {
    opener_agent_v13: 'SDR',
    presenter_agent_v6: 'SDR',
    sdr_agent_v1: 'SDR',
    admin_agent_v4: 'ADMIN',
  } as const;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolve agente via mapa quando lastAgent.name existe', () => {
    const result = resolverAgenteFinal({
      nomeRealAgenteRespondeu: 'presenter_agent_v6',
      tipoAgenteInicial: 'SDR',
      mapaNomesAgentes: mapa as any,
    });

    expect(result.nomeAgenteResposta).toBe('presenter_agent_v6');
    expect(result.agenteQueRespondeuFormatado).toBe('SDR');
  });

  it('usa fallback SDR quando lastAgent.name não mapeia', () => {
    const result = resolverAgenteFinal({
      nomeRealAgenteRespondeu: 'agente_desconhecido',
      tipoAgenteInicial: 'ADMIN',
      mapaNomesAgentes: mapa as any,
    });

    expect(result.nomeAgenteResposta).toBe('agente_desconhecido');
    expect(result.agenteQueRespondeuFormatado).toBe('SDR');
  });

  it('mantém agente inicial quando lastAgent.name não existe', () => {
    const result = resolverAgenteFinal({
      tipoAgenteInicial: 'SDR',
      mapaNomesAgentes: mapa as any,
    });

    expect(result.nomeAgenteResposta).toBe('SDR');
    expect(result.agenteQueRespondeuFormatado).toBe('SDR');
  });

  it('loga linha padronizada do agente resolvido', () => {
    logAgenteResolvido('sdr_agent_v1', 'SDR');

    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[ORCHESTRATOR] ✅ Resposta gerada por: sdr_agent_v1 (Mapeado: SDR)'
    );
  });
});
