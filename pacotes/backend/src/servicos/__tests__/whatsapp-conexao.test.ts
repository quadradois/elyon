import axios from 'axios';
import { prisma } from '../../lib/db';
import { logger } from '../../lib/logger';
import { EvolutionIntegrationError } from '../evolution-error';
import {
  deletarInstanciaEvolutionPorId,
  listarInstanciasEvolution,
  WhatsAppService,
} from '../whatsapp';

jest.mock('axios');
jest.mock('../../lib/db', () => ({
  prisma: {
    sessaoWhatsapp: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock('../../lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockLoggerError = logger.error as jest.Mock;
const mockLoggerInfo = logger.info as jest.Mock;
const sessaoWhatsapp = prisma.sessaoWhatsapp as unknown as {
  findUnique: jest.Mock;
  update: jest.Mock;
};

function axiosFailure(status?: number, code?: string) {
  return {
    isAxiosError: true,
    code,
    response: status ? { status } : undefined,
  };
}

function qrAindaIndisponivel() {
  return {
    isAxiosError: true,
    response: { status: 400, data: { error: 'no QR code available. Please wait a moment and try again' } },
  };
}

describe('WhatsAppService - contrato de conexão Evolution Go', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EVOLUTION_API_URL = 'https://evolution.test';
    process.env.EVOLUTION_GLOBAL_API_KEY = 'forbidden-global-key';
    process.env.EVOLUTION_TENANT_API_KEY = 'tenant-test-key';
    process.env.EVOLUTION_TENANT_ID = 'tenant-test-id';
    delete process.env.EVOLUTION_API_KEY;
    process.env.BACKEND_URL = 'https://backend.test';
    (mockedAxios.isAxiosError as unknown as jest.Mock).mockImplementation((error) => !!error?.isAxiosError);
    sessaoWhatsapp.update.mockResolvedValue({});
  });

  it('cria instância nova, conecta e lê o QR no formato atual', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: null, evolutionToken: null });
    mockedAxios.post
      .mockResolvedValueOnce({ data: { data: { id: 'remote-id', token: 'remote-token' } } })
      .mockResolvedValueOnce({ data: { success: true } });
    mockedAxios.get.mockResolvedValueOnce({ data: { data: { Qrcode: 'qr-placeholder' } } });

    const result = await new WhatsAppService('elyon_test_new').conectarInstancia();

    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      'https://evolution.test/instance/create',
      expect.objectContaining({ name: 'elyon_test_new', token: expect.any(String) }),
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          apikey: 'tenant-test-key',
          'X-Tenant-ID': 'tenant-test-id',
        },
      }),
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      'https://evolution.test/instance/connect',
      { webhookUrl: 'https://backend.test/webhooks', subscribe: ['MESSAGE', 'CONNECTION', 'QRCODE'] },
      expect.any(Object),
    );
    expect(result.qrcode).toBe('qr-placeholder');
  });

  it('nenhuma rota /instance/* usa a Global API Key', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: null, evolutionToken: null });
    mockedAxios.post
      .mockResolvedValueOnce({ data: { data: { id: 'remote-id', token: 'remote-token' } } })
      .mockResolvedValueOnce({ data: { success: true } });
    mockedAxios.get.mockResolvedValueOnce({ data: { data: { Qrcode: 'qr-placeholder' } } });

    await new WhatsAppService('elyon_test_no_global').conectarInstancia();

    const requests = JSON.stringify([
      ...mockedAxios.get.mock.calls,
      ...mockedAxios.post.mock.calls,
      ...mockedAxios.delete.mock.calls,
    ]);
    expect(requests).not.toContain('forbidden-global-key');
  });

  it('preserva instância remota existente e conecta com seu token atual', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'remote-id', evolutionToken: 'remote-token' });
    mockedAxios.get
      .mockResolvedValueOnce({ data: { data: [{ id: 'remote-id', name: 'elyon_test_existing', token: 'remote-token' }] } })
      .mockResolvedValueOnce({ data: { data: { qrcode: 'qr-placeholder' } } });
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await new WhatsAppService('elyon_test_existing').conectarInstancia();

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      1,
      'https://evolution.test/instance/all',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'tenant-test-key',
          'X-Tenant-ID': 'tenant-test-id',
        }),
      }),
    );
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://evolution.test/instance/connect',
      expect.any(Object),
      expect.objectContaining({ headers: expect.objectContaining({ apikey: 'remote-token' }) }),
    );
  });

  it('recria instância local órfã antes de conectar', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'stale-id', evolutionToken: 'stale-token' });
    mockedAxios.get
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: { Qrcode: 'qr-placeholder' } } });
    mockedAxios.post
      .mockResolvedValueOnce({ data: { data: { id: 'new-id', token: 'stale-token' } } })
      .mockResolvedValueOnce({ data: { success: true } });

    await new WhatsAppService('elyon_test_stale').conectarInstancia();

    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      'https://evolution.test/instance/create',
      expect.objectContaining({ token: 'stale-token' }),
      expect.any(Object),
    );
  });

  it('classifica token inválido como 502 sem expor a credencial', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'remote-id', evolutionToken: 'invalid-token' });
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [{ id: 'remote-id', name: 'elyon_test_invalid', token: 'invalid-token' }] } });
    mockedAxios.post.mockRejectedValueOnce(axiosFailure(401));

    await expect(new WhatsAppService('elyon_test_invalid').conectarInstancia()).rejects.toMatchObject({
      stage: 'instance/connect',
      route: '/instance/connect',
      upstreamStatus: 401,
      reasonCode: 'EVOLUTION_AUTH_REJECTED',
      httpStatus: 502,
      instanceAlreadyExisted: true,
    });
  });

  it('classifica Evolution indisponível como 503', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'remote-id', evolutionToken: 'remote-token' });
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [{ id: 'remote-id', name: 'elyon_test_down', token: 'remote-token' }] } });
    mockedAxios.post.mockRejectedValueOnce(axiosFailure(undefined, 'ECONNREFUSED'));

    await expect(new WhatsAppService('elyon_test_down').conectarInstancia()).rejects.toMatchObject({
      stage: 'instance/connect',
      reasonCode: 'EVOLUTION_UNAVAILABLE',
      httpStatus: 503,
    });
  });

  it('classifica falha em /instance/create com estágio e rota seguros', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: null, evolutionToken: null });
    mockedAxios.post.mockRejectedValueOnce(axiosFailure(500));

    await expect(new WhatsAppService('elyon_test_create_failure').conectarInstancia()).rejects.toMatchObject({
      stage: 'instance/create',
      route: '/instance/create',
      upstreamStatus: 500,
      reasonCode: 'EVOLUTION_UPSTREAM_FAILURE',
      httpStatus: 502,
    });
  });

  it.each([
    ['EVOLUTION_TENANT_API_KEY'],
    ['EVOLUTION_TENANT_ID'],
  ])('falha fechado antes do create quando %s está ausente', async (missingVariable) => {
    delete process.env[missingVariable];
    process.env.EVOLUTION_API_KEY = 'legacy-key-must-not-be-used';
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: null, evolutionToken: null });

    await expect(new WhatsAppService('elyon_test_missing_tenant_config').conectarInstancia())
      .rejects.toMatchObject({
        stage: 'configuracao',
        reasonCode: 'EVOLUTION_CONFIG_MISSING',
        httpStatus: 503,
      });

    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('interrompe após create quando as credenciais não podem ser persistidas', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: null, evolutionToken: null });
    sessaoWhatsapp.update.mockRejectedValueOnce(new Error('database unavailable'));
    mockedAxios.post.mockResolvedValueOnce({ data: { data: { id: 'remote-id', token: 'remote-token' } } });

    await expect(new WhatsAppService('elyon_test_persist_create').conectarInstancia()).rejects.toMatchObject({
      stage: 'banco',
      reasonCode: 'WHATSAPP_DATABASE_FAILURE',
      httpStatus: 500,
    });

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).not.toHaveBeenCalledWith('https://evolution.test/instance/qr', expect.anything());
  });

  it('interrompe após adoption quando o token remoto não pode ser persistido', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'remote-id', evolutionToken: 'stale-token' });
    sessaoWhatsapp.update.mockRejectedValueOnce(new Error('database unavailable'));
    mockedAxios.get.mockResolvedValueOnce({
      data: { data: [{ id: 'remote-id', name: 'elyon_test_persist_adoption', token: 'current-token' }] },
    });

    await expect(new WhatsAppService('elyon_test_persist_adoption').conectarInstancia()).rejects.toMatchObject({
      stage: 'banco',
      reasonCode: 'WHATSAPP_DATABASE_FAILURE',
      httpStatus: 500,
    });

    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('classifica falha em /instance/qr depois de connect bem-sucedido', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'remote-id', evolutionToken: 'remote-token' });
    mockedAxios.get
      .mockResolvedValueOnce({ data: { data: [{ id: 'remote-id', name: 'elyon_test_qr_failure', token: 'remote-token' }] } })
      .mockRejectedValueOnce(axiosFailure(500));
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await expect(new WhatsAppService('elyon_test_qr_failure').conectarInstancia()).rejects.toMatchObject({
      stage: 'instance/qr',
      route: '/instance/qr',
      upstreamStatus: 500,
      reasonCode: 'EVOLUTION_UPSTREAM_FAILURE',
      httpStatus: 502,
    });
  });

  it('aguarda o QR transitório e retorna assim que a Evolution o disponibiliza', async () => {
    jest.useFakeTimers();
    try {
      sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'remote-id', evolutionToken: 'remote-token' });
      mockedAxios.get
        .mockResolvedValueOnce({ data: { data: [{ id: 'remote-id', name: 'elyon_test_qr_delayed', token: 'remote-token' }] } })
        .mockRejectedValueOnce(qrAindaIndisponivel())
        .mockResolvedValueOnce({ data: { data: { Connected: false, LoggedIn: false } } })
        .mockResolvedValueOnce({ data: { data: { Qrcode: 'qr-delayed' } } });
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const connection = new WhatsAppService('elyon_test_qr_delayed').conectarInstancia();
      await jest.advanceTimersByTimeAsync(1000);

      await expect(connection).resolves.toMatchObject({ qrcode: 'qr-delayed', count: 1 });
    } finally {
      jest.useRealTimers();
    }
  });

  it('encerra o polling quando a instância já ficou conectada', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'remote-id', evolutionToken: 'remote-token' });
    mockedAxios.get
      .mockResolvedValueOnce({ data: { data: [{ id: 'remote-id', name: 'elyon_test_open', token: 'remote-token' }] } })
      .mockRejectedValueOnce(qrAindaIndisponivel())
      .mockResolvedValueOnce({ data: { data: { Connected: true, LoggedIn: true } } });
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await expect(new WhatsAppService('elyon_test_open').conectarInstancia()).resolves.toMatchObject({
      status: 'open',
      count: 0,
    });
  });

  it('falha de forma limitada e identificável quando o QR não aparece', async () => {
    jest.useFakeTimers();
    try {
      sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: null, evolutionToken: null });
      mockedAxios.post
        .mockResolvedValueOnce({ data: { data: { id: 'remote-id', token: 'remote-token' } } })
        .mockResolvedValueOnce({ data: { success: true } });
      mockedAxios.get.mockImplementation(async (url) => {
        if (String(url).endsWith('/instance/qr')) throw qrAindaIndisponivel();
        return { data: { data: { Connected: false, LoggedIn: false } } };
      });

      const connection = new WhatsAppService('elyon_test_qr_timeout').conectarInstancia();
      const rejection = expect(connection).rejects.toMatchObject({
        stage: 'instance/qr',
        route: '/instance/qr',
        upstreamStatus: 400,
        reasonCode: 'WHATSAPP_QR_TIMEOUT',
        httpStatus: 502,
      });
      await jest.advanceTimersByTimeAsync(25000);

      await rejection;
      expect(mockedAxios.get.mock.calls.filter(([url]) => String(url).endsWith('/instance/qr'))).toHaveLength(11);
    } finally {
      jest.useRealTimers();
    }
  });

  it('coalesce duas conexões concorrentes e cria a instância uma única vez', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: null, evolutionToken: null });
    mockedAxios.post
      .mockResolvedValueOnce({ data: { data: { id: 'remote-id', token: 'remote-token' } } })
      .mockResolvedValueOnce({ data: { success: true } });
    mockedAxios.get.mockResolvedValueOnce({ data: { data: { Qrcode: 'qr-placeholder' } } });
    const service = new WhatsAppService('elyon_test_concurrent');

    const [first, second] = await Promise.all([service.conectarInstancia(), service.conectarInstancia()]);

    expect(first).toEqual(second);
    expect(mockedAxios.post.mock.calls.filter(([url]) => url === 'https://evolution.test/instance/create')).toHaveLength(1);
    expect(mockedAxios.post.mock.calls.filter(([url]) => url === 'https://evolution.test/instance/connect')).toHaveLength(1);
  });

  it('retry após falha reaproveita a instância criada sem duplicação', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: null, evolutionToken: null });
    mockedAxios.post
      .mockResolvedValueOnce({ data: { data: { id: 'remote-id', token: 'remote-token' } } })
      .mockRejectedValueOnce(axiosFailure(503))
      .mockResolvedValueOnce({ data: { success: true } });
    mockedAxios.get
      .mockResolvedValueOnce({ data: { data: [{ id: 'remote-id', name: 'elyon_test_retry', token: 'remote-token' }] } })
      .mockResolvedValueOnce({ data: { data: { Qrcode: 'qr-placeholder' } } });
    const service = new WhatsAppService('elyon_test_retry');

    await expect(service.conectarInstancia()).rejects.toMatchObject({ reasonCode: 'EVOLUTION_UNAVAILABLE' });
    await expect(service.conectarInstancia()).resolves.toMatchObject({ qrcode: 'qr-placeholder' });

    expect(mockedAxios.post.mock.calls.filter(([url]) => url === 'https://evolution.test/instance/create')).toHaveLength(1);
  });

  it('logs de falha não carregam token, nome da instância ou payload upstream', async () => {
    const sensitiveRemoteId = '11111111-2222-3333-4444-555555555555';
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: sensitiveRemoteId, evolutionToken: 'secret-instance-token' });
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [{ id: sensitiveRemoteId, name: 'elyon_sensitive_name', token: 'secret-instance-token' }] } });
    mockedAxios.post.mockRejectedValueOnce(axiosFailure(401));

    await expect(new WhatsAppService('elyon_sensitive_name').conectarInstancia()).rejects.toBeDefined();

    const serializedLogs = JSON.stringify(mockLoggerError.mock.calls);
    const serializedInfoLogs = JSON.stringify(mockLoggerInfo.mock.calls);
    for (const logs of [serializedLogs, serializedInfoLogs]) {
      expect(logs).not.toContain('secret-instance-token');
      expect(logs).not.toContain('elyon_sensitive_name');
      expect(logs).not.toContain(sensitiveRemoteId);
      expect(logs).not.toContain('tenant-test-id');
      expect(logs).not.toContain('tenant-test-key');
      expect(logs).not.toContain('forbidden-global-key');
    }
    expect(serializedLogs).toContain('EVOLUTION_AUTH_REJECTED');
  });

  it('usa o escopo tenant para excluir instância', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'remote-id', evolutionToken: 'remote-token' });
    mockedAxios.delete.mockResolvedValueOnce({ data: { success: true } });

    await expect(new WhatsAppService('elyon_test_delete').deletarInstancia()).resolves.toBe('deletada');

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      'https://evolution.test/instance/delete/remote-id',
      {
        headers: {
          'Content-Type': 'application/json',
          apikey: 'tenant-test-key',
          'X-Tenant-ID': 'tenant-test-id',
        },
      },
    );
  });

  it.each([
    ['EVOLUTION_TENANT_API_KEY'],
    ['EVOLUTION_TENANT_ID'],
  ])('falha fechado no delete quando %s está ausente', async (missingVariable) => {
    delete process.env[missingVariable];
    sessaoWhatsapp.findUnique.mockResolvedValue({
      evolutionInstanceId: 'remote-id',
      evolutionToken: 'remote-token',
    });

    await expect(new WhatsAppService('elyon_test_delete_missing_tenant').deletarInstancia())
      .rejects.toMatchObject({
        stage: 'configuracao',
        route: 'instance/delete',
        reasonCode: 'EVOLUTION_CONFIG_MISSING',
        httpStatus: 503,
      });

    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it('propaga indisponibilidade de /instance/all ao resolver ID para delete', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: null, evolutionToken: null });
    mockedAxios.get.mockRejectedValueOnce(axiosFailure(undefined, 'ECONNREFUSED'));

    await expect(new WhatsAppService('elyon_test_delete_all_down').deletarInstancia())
      .rejects.toMatchObject({
        stage: 'instance/delete',
        route: '/instance/all',
        reasonCode: 'EVOLUTION_UNAVAILABLE',
        httpStatus: 503,
      });

    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it('retorna inexistente somente após /instance/all comprovar ausência remota', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: null, evolutionToken: null });
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } });

    await expect(new WhatsAppService('elyon_test_delete_absent').deletarInstancia())
      .resolves.toBe('inexistente');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://evolution.test/instance/all',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'tenant-test-key',
          'X-Tenant-ID': 'tenant-test-id',
        }),
      }),
    );
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it('não confunde resposta inválida de /instance/all com ausência remota', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: null, evolutionToken: null });
    mockedAxios.get.mockResolvedValueOnce({ data: { unexpected: true } });

    await expect(new WhatsAppService('elyon_test_delete_invalid_all').deletarInstancia())
      .rejects.toMatchObject({
        stage: 'instance/delete',
        route: '/instance/all',
        reasonCode: 'EVOLUTION_CONTRACT_INVALID',
        httpStatus: 502,
      });

    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it('trata 404 do delete como sucesso idempotente', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'remote-id', evolutionToken: 'remote-token' });
    mockedAxios.delete.mockRejectedValueOnce(axiosFailure(404));

    await expect(new WhatsAppService('elyon_test_delete_404').deletarInstancia())
      .resolves.toBe('inexistente');

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      'https://evolution.test/instance/delete/remote-id',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'tenant-test-key',
          'X-Tenant-ID': 'tenant-test-id',
        }),
      }),
    );
  });

  it('delete 500 é idempotente somente após ausência comprovada', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'remote-id', evolutionToken: 'remote-token' });
    mockedAxios.delete.mockRejectedValueOnce(axiosFailure(500));
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } });

    await expect(new WhatsAppService('elyon_test_delete_500_absent').deletarInstancia())
      .resolves.toBe('inexistente');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://evolution.test/instance/all',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'tenant-test-key',
          'X-Tenant-ID': 'tenant-test-id',
        }),
      }),
    );
  });

  it('delete 500 permanece erro quando a instância ainda existe', async () => {
    const sensitiveRemoteId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    sessaoWhatsapp.findUnique.mockResolvedValue({
      evolutionInstanceId: sensitiveRemoteId,
      evolutionToken: 'remote-token',
    });
    mockedAxios.delete.mockRejectedValueOnce(axiosFailure(500));
    mockedAxios.get.mockResolvedValueOnce({
      data: { data: [{ id: sensitiveRemoteId, name: 'elyon_test_delete_500_present' }] },
    });

    await expect(new WhatsAppService('elyon_test_delete_500_present').deletarInstancia())
      .rejects.toMatchObject({
        stage: 'instance/delete',
        route: '/instance/delete/:id',
        upstreamStatus: 500,
        reasonCode: 'EVOLUTION_UPSTREAM_FAILURE',
      });

    const logs = JSON.stringify(mockLoggerError.mock.calls);
    expect(logs).not.toContain(sensitiveRemoteId);
    expect(logs).not.toContain('elyon_test_delete_500_present');
    expect(logs).not.toContain('tenant-test-id');
    expect(logs).not.toContain('tenant-test-key');
  });

  it('falha na verificação após delete 500 permanece fail-closed', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'remote-id', evolutionToken: 'remote-token' });
    mockedAxios.delete.mockRejectedValueOnce(axiosFailure(500));
    mockedAxios.get.mockRejectedValueOnce(axiosFailure(undefined, 'ECONNREFUSED'));

    await expect(new WhatsAppService('elyon_test_delete_500_check_failure').deletarInstancia())
      .rejects.toMatchObject({
        stage: 'instance/delete',
        route: '/instance/all',
        reasonCode: 'EVOLUTION_UNAVAILABLE',
        httpStatus: 503,
      });
  });

  it('usa o escopo tenant na listagem administrativa de reconciliação', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } });

    await expect(listarInstanciasEvolution()).resolves.toEqual([]);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://evolution.test/instance/all',
      {
        headers: {
          'Content-Type': 'application/json',
          apikey: 'tenant-test-key',
          'X-Tenant-ID': 'tenant-test-id',
        },
      },
    );
  });

  it.each([
    ['EVOLUTION_TENANT_API_KEY'],
    ['EVOLUTION_TENANT_ID'],
  ])('falha fechado na reconciliação quando %s está ausente', async (missingVariable) => {
    delete process.env[missingVariable];
    process.env.EVOLUTION_API_KEY = 'legacy-key-must-not-be-used';

    await expect(listarInstanciasEvolution()).rejects.toMatchObject({
      stage: 'configuracao',
      reasonCode: 'EVOLUTION_CONFIG_MISSING',
      httpStatus: 503,
    });

    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('delete de reconciliação confirma ausência após 500 sem usar chave global', async () => {
    mockedAxios.delete.mockRejectedValueOnce(axiosFailure(500));
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } });

    await expect(deletarInstanciaEvolutionPorId('remote-id')).resolves.toBeUndefined();

    const requests = JSON.stringify([
      ...mockedAxios.get.mock.calls,
      ...mockedAxios.delete.mock.calls,
    ]);
    expect(requests).not.toContain('forbidden-global-key');
    expect(requests).not.toContain('legacy-key-must-not-be-used');
  });

  it('delete de reconciliação permanece erro após 500 quando o ID ainda existe', async () => {
    mockedAxios.delete.mockRejectedValueOnce(axiosFailure(500));
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [{ id: 'remote-id' }] } });

    await expect(deletarInstanciaEvolutionPorId('remote-id')).rejects.toMatchObject({
      stage: 'instance/delete',
      route: '/instance/delete/:id',
      upstreamStatus: 500,
      reasonCode: 'EVOLUTION_UPSTREAM_FAILURE',
    });
  });

  it('delete de reconciliação permanece fail-closed se a confirmação pós-500 falhar', async () => {
    mockedAxios.delete.mockRejectedValueOnce(axiosFailure(500));
    mockedAxios.get.mockRejectedValueOnce(axiosFailure(undefined, 'ECONNREFUSED'));

    await expect(deletarInstanciaEvolutionPorId('remote-id')).rejects.toMatchObject({
      stage: 'instance/delete',
      route: '/instance/all',
      reasonCode: 'EVOLUTION_UNAVAILABLE',
      httpStatus: 503,
    });
  });

  it('detecta mudança incompatível no contrato de criação', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: null, evolutionToken: null });
    mockedAxios.post.mockResolvedValueOnce({ data: { data: { instance: 'new-shape' } } });

    await expect(new WhatsAppService('elyon_test_contract').conectarInstancia()).rejects.toMatchObject({
      name: EvolutionIntegrationError.name,
      stage: 'instance/create',
      route: '/instance/create',
      reasonCode: 'EVOLUTION_CONTRACT_INVALID',
      httpStatus: 502,
    });
  });
});
