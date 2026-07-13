const queryRawUnsafe = jest.fn();
const updateMany = jest.fn();

jest.mock('../../lib/db', () => ({
  prisma: {
    $queryRawUnsafe: queryRawUnsafe,
    webhookEvento: { updateMany },
  },
}));
jest.mock('../../rotas/webhook', () => ({ processarWebhookEvolution: jest.fn() }));
jest.mock('../../rotas/webhook-manus', () => ({ processarWebhookManus: jest.fn() }));
jest.mock('../../rotas/rotas-billing', () => ({ processarWebhookAsaas: jest.fn() }));

import {
  calcularBackoffMs,
  concluirTentativa,
  falharTentativa,
  reivindicarProximoEvento,
} from '../webhook-inbox';

const evento = {
  id: 'evento-1',
  provedor: 'ASAAS' as const,
  eventoId: 'evt-1',
  tipo: 'PAYMENT_RECEIVED',
  payload: { id: 'evt-1' },
  tentativas: 1,
  maxTentativas: 5,
};

describe('webhook inbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WEBHOOK_WORKER_BACKOFF_BASE_MS;
    delete process.env.WEBHOOK_WORKER_BACKOFF_MAX_MS;
  });

  it('reivindica um evento com lock nao bloqueante e lease atomico', async () => {
    queryRawUnsafe.mockResolvedValue([evento]);

    await expect(reivindicarProximoEvento('worker-1')).resolves.toEqual(evento);
    expect(queryRawUnsafe.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(queryRawUnsafe.mock.calls[0][0]).toContain('"leaseOwner" = $1');
    expect(queryRawUnsafe.mock.calls[0].slice(1)).toEqual(['worker-1', 300]);
  });

  it('aplica backoff exponencial limitado', () => {
    process.env.WEBHOOK_WORKER_BACKOFF_BASE_MS = '1000';
    process.env.WEBHOOK_WORKER_BACKOFF_MAX_MS = '4000';
    expect([1, 2, 3, 4].map(calcularBackoffMs)).toEqual([1000, 2000, 4000, 4000]);
  });

  it('envia para dead letter ao esgotar tentativas e sanitiza segredos', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const esgotado = { ...evento, tentativas: 5 };

    await expect(falharTentativa(esgotado, 'api_key=segredo-supersecreto', false, 'worker-1'))
      .resolves.toBe('MORTO');
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: evento.id, status: 'PROCESSANDO', leaseOwner: 'worker-1' },
      data: expect.objectContaining({ status: 'MORTO', ultimoErro: 'api_key=[REDACTED]' }),
    }));
  });

  it('conclui somente quando a instancia ainda possui o lease', async () => {
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await expect(concluirTentativa(evento, 'worker-1')).resolves.toBe(true);
    await expect(concluirTentativa(evento, 'worker-2')).resolves.toBe(false);
    expect(updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: evento.id, status: 'PROCESSANDO', leaseOwner: 'worker-1' },
    }));
  });
});
