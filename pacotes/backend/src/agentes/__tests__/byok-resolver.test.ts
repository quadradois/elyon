/**
 * Testes para byok-resolver.ts
 * Cobre: chave corrompida, provedor null, fallback, resolução correta
 * 
 * Apenas provedores OpenAI-compatible (openai, openrouter) são suportados.
 * Uma única chave (llmApiKeyCriptografada) cobre todos os serviços.
 */

// Mock do módulo de criptografia
jest.mock('../../lib/crypto', () => ({
  descriptografar: jest.fn(),
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

import { descriptografar } from '../../lib/crypto';
import { logger } from '../../lib/logger';
import {
  resolverChaveAgentes,
  resolverChaveWhisper,
  resolverChaveEmbeddings,
  TenantBYOK,
  MODELO_PADRAO_PRINCIPAL,
} from '../byok-resolver';

const mockedDescriptografar = descriptografar as jest.MockedFunction<typeof descriptografar>;

const PLATAFORMA_KEY = 'platform-key-123';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OPENAI_API_KEY = PLATAFORMA_KEY;
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

// Helper para criar tenant
function criarTenant(overrides: Partial<TenantBYOK> = {}): TenantBYOK {
  return {
    llmProvedor: 'openai',
    llmModelo: 'gpt-4.1',
    llmApiKeyCriptografada: 'encrypted-abc',
    llmBaseUrl: null,
    ...overrides,
  };
}

// ============================================
// resolverChaveAgentes
// ============================================

describe('resolverChaveAgentes', () => {
  it('retorna chave do tenant quando a descriptografia funciona', () => {
    mockedDescriptografar.mockReturnValue('real-api-key');
    const tenant = criarTenant();
    const result = resolverChaveAgentes(tenant);
    expect(result).toMatchObject({
      apiKey: 'real-api-key',
      modelo: 'gpt-4.1',
      fonte: 'tenant',
    });
  });

  it('retorna modelo do tenant quando configurado', () => {
    mockedDescriptografar.mockReturnValue('key');
    const tenant = criarTenant({ llmModelo: 'gpt-4.1-mini' });
    expect(resolverChaveAgentes(tenant).modelo).toBe('gpt-4.1-mini');
  });

  it('inclui baseUrl quando configurada (OpenRouter)', () => {
    mockedDescriptografar.mockReturnValue('key');
    const tenant = criarTenant({ llmProvedor: 'openrouter', llmBaseUrl: 'https://openrouter.ai/api/v1' });
    expect(resolverChaveAgentes(tenant).baseUrl).toBe('https://openrouter.ai/api/v1');
  });

  it('cai para plataforma quando chave é corrompida', () => {
    mockedDescriptografar.mockImplementation(() => {
      throw new Error('Decryption failed: invalid padding');
    });
    const tenant = criarTenant();
    const result = resolverChaveAgentes(tenant);
    expect(result.fonte).toBe('plataforma');
    expect(result.apiKey).toBe(PLATAFORMA_KEY);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[BYOK] Falha ao descriptografar chave do tenant')
    );
  });

  it('cai para plataforma quando tenant é null', () => {
    const result = resolverChaveAgentes(null);
    expect(result.fonte).toBe('plataforma');
    expect(result.apiKey).toBe(PLATAFORMA_KEY);
    expect(result.modelo).toBe(MODELO_PADRAO_PRINCIPAL);
  });

  it('cai para plataforma quando provedor é null', () => {
    const tenant = criarTenant({ llmProvedor: null });
    const result = resolverChaveAgentes(tenant);
    expect(result.fonte).toBe('plataforma');
  });

  it('cai para plataforma quando chave criptografada é null', () => {
    const tenant = criarTenant({ llmApiKeyCriptografada: null });
    const result = resolverChaveAgentes(tenant);
    expect(result.fonte).toBe('plataforma');
  });

  it('não envia chave OpenRouter ao endpoint de embeddings da OpenAI', () => {
    mockedDescriptografar.mockReturnValue('openrouter-key');
    const tenant = criarTenant({ llmProvedor: 'openrouter', llmBaseUrl: 'https://openrouter.ai/api/v1' });
    const result = resolverChaveEmbeddings(tenant);
    expect(result).toMatchObject({ fonte: 'plataforma', apiKey: PLATAFORMA_KEY });
    expect(mockedDescriptografar).not.toHaveBeenCalled();
  });
});

// ============================================
// resolverChaveWhisper
// ============================================

describe('resolverChaveWhisper', () => {
  it('retorna plataforma quando tenant é null', () => {
    expect(resolverChaveWhisper(null).fonte).toBe('plataforma');
  });

  it('usa chave do tenant quando configurada', () => {
    mockedDescriptografar.mockReturnValue('whisper-key');
    const tenant = criarTenant();
    const result = resolverChaveWhisper(tenant);
    expect(result.apiKey).toBe('whisper-key');
    expect(result.fonte).toBe('tenant');
  });

  it('cai para plataforma quando chave corrompida', () => {
    mockedDescriptografar.mockImplementation(() => {
      throw new Error('corrupted');
    });
    const tenant = criarTenant();
    const result = resolverChaveWhisper(tenant);
    expect(result.fonte).toBe('plataforma');
    expect(result.apiKey).toBe(PLATAFORMA_KEY);
  });

  it('cai para plataforma quando provedor é null', () => {
    const tenant = criarTenant({ llmProvedor: null });
    const result = resolverChaveWhisper(tenant);
    expect(result.fonte).toBe('plataforma');
  });

  it('cai para plataforma quando chave é null', () => {
    const tenant = criarTenant({ llmApiKeyCriptografada: null });
    const result = resolverChaveWhisper(tenant);
    expect(result.fonte).toBe('plataforma');
  });
});

// ============================================
// resolverChaveEmbeddings
// ============================================

describe('resolverChaveEmbeddings', () => {
  it('retorna plataforma quando tenant é null', () => {
    expect(resolverChaveEmbeddings(null).fonte).toBe('plataforma');
  });

  it('usa chave do tenant quando configurada', () => {
    mockedDescriptografar.mockReturnValue('embed-key');
    const tenant = criarTenant();
    const result = resolverChaveEmbeddings(tenant);
    expect(result.apiKey).toBe('embed-key');
    expect(result.fonte).toBe('tenant');
  });

  it('cai para plataforma quando chave corrompida', () => {
    mockedDescriptografar.mockImplementation(() => {
      throw new Error('bad key');
    });
    const tenant = criarTenant();
    const result = resolverChaveEmbeddings(tenant);
    expect(result.fonte).toBe('plataforma');
    expect(result.apiKey).toBe(PLATAFORMA_KEY);
  });

  it('cai para plataforma quando provedor é null', () => {
    const tenant = criarTenant({ llmProvedor: null });
    const result = resolverChaveEmbeddings(tenant);
    expect(result.fonte).toBe('plataforma');
  });
});
