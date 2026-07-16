import axios from 'axios';
import { prisma } from '../../lib/db';
import { logger } from '../../lib/logger';
import { EvolutionIntegrationError } from '../evolution-error';
import { WhatsAppService } from '../whatsapp';

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

describe('WhatsAppService - contrato de conexão Evolution Go', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EVOLUTION_API_URL = 'https://evolution.test';
    process.env.EVOLUTION_API_KEY = 'global-test-key';
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
      expect.any(Object),
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      'https://evolution.test/instance/connect',
      { webhookUrl: 'https://backend.test/webhooks', subscribe: ['MESSAGE', 'CONNECTION', 'QRCODE'] },
      expect.any(Object),
    );
    expect(result.qrcode).toBe('qr-placeholder');
  });

  it('preserva instância remota existente e conecta com seu token atual', async () => {
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'remote-id', evolutionToken: 'remote-token' });
    mockedAxios.get
      .mockResolvedValueOnce({ data: { data: [{ id: 'remote-id', name: 'elyon_test_existing', token: 'remote-token' }] } })
      .mockResolvedValueOnce({ data: { data: { qrcode: 'qr-placeholder' } } });
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await new WhatsAppService('elyon_test_existing').conectarInstancia();

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
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
    sessaoWhatsapp.findUnique.mockResolvedValue({ evolutionInstanceId: 'remote-id', evolutionToken: 'secret-instance-token' });
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [{ id: 'remote-id', name: 'elyon_sensitive_name', token: 'secret-instance-token' }] } });
    mockedAxios.post.mockRejectedValueOnce(axiosFailure(401));

    await expect(new WhatsAppService('elyon_sensitive_name').conectarInstancia()).rejects.toBeDefined();

    const serializedLogs = JSON.stringify(mockLoggerError.mock.calls);
    expect(serializedLogs).not.toContain('secret-instance-token');
    expect(serializedLogs).not.toContain('elyon_sensitive_name');
    expect(serializedLogs).toContain('EVOLUTION_AUTH_REJECTED');
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
