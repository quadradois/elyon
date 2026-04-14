/**
 * Testes para classificador-objecao.ts
 * Cobre: mock do fetch, timeout (AbortController), ID inválido, bypass em erros HTTP
 */

// Mock do logger
jest.mock('../../lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('../byok-resolver', () => ({
  MODELO_PADRAO_AUXILIAR: 'gpt-4.1-mini',
  MODELO_PADRAO_PRINCIPAL: 'gpt-4.1',
}));

import { tentarDetectarObjecao } from '../classificador-objecao';
import { BIBLIOTECA_OBJECOES } from '../catalogo-objecoes';

// ============================================
// Setup & helpers
// ============================================

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

function mockFetchResolve(content: string, status: number = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  });
}

function mockFetchReject(error: Error) {
  global.fetch = jest.fn().mockRejectedValue(error);
}

function mockFetchHang(ms: number = 5000) {
  global.fetch = jest.fn().mockImplementation((_url: string, opts?: RequestInit) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: '1' } }] }),
        });
      }, ms);

      // Respect the AbortController signal
      if (opts?.signal) {
        opts.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }
    });
  });
}

// ============================================
// Guard clauses (retornos antecipados)
// ============================================

describe('tentarDetectarObjecao - guard clauses', () => {
  it('retorna null quando apiKey não é fornecida', async () => {
    expect(await tentarDetectarObjecao('mensagem teste')).toBeNull();
  });

  it('retorna null quando mensagem é vazia', async () => {
    expect(await tentarDetectarObjecao('', 'key')).toBeNull();
  });

  it('retorna null quando mensagem é apenas espaços', async () => {
    expect(await tentarDetectarObjecao('   ', 'key')).toBeNull();
  });
});

// ============================================
// Classificação de objeções
// ============================================

describe('tentarDetectarObjecao - classificação', () => {
  it('retorna objeção quando API retorna ID válido', async () => {
    const primeiraObjecao = BIBLIOTECA_OBJECOES[0];
    mockFetchResolve(String(primeiraObjecao.id));

    const result = await tentarDetectarObjecao('não tenho pressa', 'test-key');
    expect(result).not.toBeNull();
    expect(result!.id).toBe(primeiraObjecao.id);
    expect(result!.contorno).toBeDefined();
  });

  it('retorna null quando API retorna "0" (sem objeção)', async () => {
    mockFetchResolve('0');
    const result = await tentarDetectarObjecao('Qual o prazo de contrato?', 'test-key');
    expect(result).toBeNull();
  });

  it('retorna null para ID não existente na biblioteca', async () => {
    mockFetchResolve('9999');
    const result = await tentarDetectarObjecao('mensagem qualquer', 'test-key');
    expect(result).toBeNull();
  });

  it('retorna null quando API retorna texto não-numérico', async () => {
    mockFetchResolve('sem objeção detectada');
    const result = await tentarDetectarObjecao('mensagem qualquer', 'test-key');
    expect(result).toBeNull();
  });
});

// ============================================
// Erros HTTP
// ============================================

describe('tentarDetectarObjecao - erros HTTP', () => {
  it('retorna null para erro HTTP 429 (rate limit)', async () => {
    mockFetchResolve('', 429);
    const result = await tentarDetectarObjecao('teste', 'test-key');
    expect(result).toBeNull();
  });

  it('retorna null para erro HTTP 500', async () => {
    mockFetchResolve('', 500);
    const result = await tentarDetectarObjecao('teste', 'test-key');
    expect(result).toBeNull();
  });

  it('retorna null para erro HTTP 404 (modelo inválido)', async () => {
    mockFetchResolve('', 404);
    const result = await tentarDetectarObjecao('teste', 'test-key');
    expect(result).toBeNull();
  });
});

// ============================================
// Timeout e AbortController
// ============================================

describe('tentarDetectarObjecao - timeout', () => {
  it('aborta após 2s quando API não responde', async () => {
    mockFetchHang(10000); // Simula API que demora 10s

    const start = Date.now();
    const result = await tentarDetectarObjecao('não tenho pressa', 'test-key');
    const elapsed = Date.now() - start;

    expect(result).toBeNull();
    // Deve abortar antes de 3s (2s timeout + margem)
    expect(elapsed).toBeLessThan(3000);
  }, 10000);

  it('passa signal para o fetch', async () => {
    mockFetchResolve('0');
    await tentarDetectarObjecao('teste', 'test-key');

    const fetchMock = global.fetch as jest.Mock;
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1]).toHaveProperty('signal');
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
  });
});

// ============================================
// Erros de rede
// ============================================

describe('tentarDetectarObjecao - erros de rede', () => {
  it('retorna null quando fetch rejeita (network error)', async () => {
    mockFetchReject(new Error('ECONNREFUSED'));
    const result = await tentarDetectarObjecao('teste', 'test-key');
    expect(result).toBeNull();
  });
});

// ============================================
// URL e modelo
// ============================================

describe('tentarDetectarObjecao - URL e modelo', () => {
  it('usa URL padrão OpenAI quando baseUrl não é fornecida', async () => {
    mockFetchResolve('0');
    await tentarDetectarObjecao('teste', 'key');

    const fetchMock = global.fetch as jest.Mock;
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('usa baseUrl customizada quando fornecida', async () => {
    mockFetchResolve('0');
    await tentarDetectarObjecao('teste', 'key', 'https://groq.example.com/v1/');

    const fetchMock = global.fetch as jest.Mock;
    expect(fetchMock.mock.calls[0][0]).toBe('https://groq.example.com/v1/chat/completions');
  });

  it('remove trailing slash da baseUrl', async () => {
    mockFetchResolve('0');
    await tentarDetectarObjecao('teste', 'key', 'https://api.custom.com/v1/');

    const fetchMock = global.fetch as jest.Mock;
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.custom.com/v1/chat/completions');
  });

  it('usa modelo customizado quando fornecido', async () => {
    mockFetchResolve('0');
    await tentarDetectarObjecao('teste', 'key', undefined, 'llama-3-8b');

    const fetchMock = global.fetch as jest.Mock;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('llama-3-8b');
  });

  it('usa MODELO_PADRAO_AUXILIAR como modelo default', async () => {
    mockFetchResolve('0');
    await tentarDetectarObjecao('teste', 'key');

    const fetchMock = global.fetch as jest.Mock;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-4.1-mini');
  });
});
