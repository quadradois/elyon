import { executarEventoWebhook, DependenciasExecutorWebhook } from '../webhook-worker-executor';
import { EventoInbox } from '../webhook-inbox';

const evento: EventoInbox = {
  id: 'event-1', provedor: 'EVOLUTION', eventoId: 'provider-1', tipo: 'messages.upsert',
  payload: { event: 'messages.upsert' }, tentativas: 1, maxTentativas: 5,
};

function dependencies(overrides: Partial<DependenciasExecutorWebhook> = {}): DependenciasExecutorWebhook {
  return {
    processar: jest.fn(async () => ({ statusCode: 200 })),
    concluir: jest.fn(async () => true),
    falhar: jest.fn(async () => 'RETRY'),
    renovar: jest.fn(async () => undefined),
    registrarResultado: jest.fn(),
    registrarErroHeartbeat: jest.fn(),
    registrarErroProcessamento: jest.fn(),
    heartbeatMs: 5,
    ...overrides,
  };
}

describe('executor real do worker de webhooks', () => {
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('captura rejeição do heartbeat sem unhandled rejection e preserva conclusão/métrica', async () => {
    jest.useFakeTimers();
    let finish!: (value: { statusCode: number }) => void;
    const processar = jest.fn(() => new Promise<{ statusCode: number }>((resolve) => { finish = resolve; }));
    const erroHeartbeat = new Error('lease indisponível');
    const deps = dependencies({ processar, renovar: jest.fn(async () => { throw erroHeartbeat; }) });

    const execution = executarEventoWebhook(evento, 'owner-1', deps);
    await jest.advanceTimersByTimeAsync(5);
    expect(deps.registrarErroHeartbeat).toHaveBeenCalledWith(evento, erroHeartbeat);
    finish({ statusCode: 200 });
    await expect(execution).resolves.toBe('CONCLUIDO');
    expect(deps.registrarResultado).toHaveBeenCalledWith(evento, 'concluido');
    expect(deps.registrarErroProcessamento).not.toHaveBeenCalled();
  });

  it('registra erro original do handler uma vez, agenda retry e mantém métrica', async () => {
    const erroHandler = new Error('handler explodiu');
    const deps = dependencies({ processar: jest.fn(async () => { throw erroHandler; }) });
    await expect(executarEventoWebhook(evento, 'owner-2', deps)).resolves.toBe('RETRY');
    expect(deps.registrarErroProcessamento).toHaveBeenCalledTimes(1);
    expect(deps.registrarErroProcessamento).toHaveBeenCalledWith(evento, erroHandler);
    expect(deps.falhar).toHaveBeenCalledWith(evento, erroHandler, false, 'owner-2');
    expect(deps.registrarResultado).toHaveBeenCalledWith(evento, 'retry');
  });
});
