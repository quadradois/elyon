/**
 * Testes: conversation-cache.ts
 *
 * Cobre:
 * - getHistory: Redis hit, Redis miss, fallback memória
 * - setHistory: persistência Redis, truncamento, fallback memória
 * - getLastAgent: retorno do último agente
 * - clearHistory: limpeza Redis + memória
 * - getCacheStats: contagem de chaves
 */

// Mock do Redis
const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
};

jest.mock('../../lib/redis', () => ({
    getRedisClient: jest.fn(async () => mockRedis),
}));

import {
    getHistory,
    setHistory,
    getLastAgent,
    clearHistory,
    getCacheStats,
} from '../conversation-cache';

beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setEx.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.keys.mockResolvedValue([]);
});

// ====================================
// GET HISTORY
// ====================================

describe('getHistory', () => {
    it('retorna undefined se Redis não tem dados', async () => {
        const result = await getHistory('contato-001');
        expect(result).toBeUndefined();
    });

    it('retorna histórico do Redis quando disponível', async () => {
        const history = [
            { role: 'user', content: 'Oi' },
            { role: 'assistant', content: 'Olá!' },
        ];
        mockRedis.get.mockResolvedValue(JSON.stringify({ history, lastAgent: 'OPENER' }));

        const result = await getHistory('contato-001');
        expect(result).toHaveLength(2);
        expect(result![0]).toEqual({ role: 'user', content: 'Oi' });
    });

    it('usa fallback de memória se Redis falhar', async () => {
        mockRedis.get.mockRejectedValue(new Error('Connection refused'));

        // Primeiro salva na memória (via setHistory com Redis falhando)
        mockRedis.setEx.mockRejectedValue(new Error('Connection refused'));
        await setHistory('contato-mem-001', [{ role: 'user', content: 'Test' }]);

        // Agora busca — deve usar memória
        const result = await getHistory('contato-mem-001');
        expect(result).toHaveLength(1);
        expect(result![0]).toEqual({ role: 'user', content: 'Test' });
    });
});

// ====================================
// SET HISTORY
// ====================================

describe('setHistory', () => {
    it('salva no Redis com TTL', async () => {
        const history = [{ role: 'user', content: 'Oi' }];
        await setHistory('contato-001', history, 'OPENER');

        expect(mockRedis.setEx).toHaveBeenCalledWith(
            'elyon:conv:contato-001',
            expect.any(Number), // TTL
            expect.any(String), // JSON
        );

        const savedJson = JSON.parse(mockRedis.setEx.mock.calls[0][2]);
        expect(savedJson.history).toHaveLength(1);
        expect(savedJson.lastAgent).toBe('OPENER');
    });

    it('trunca histórico se excede 50 itens', async () => {
        const history = Array.from({ length: 60 }, (_, i) => ({
            role: 'user',
            content: `Msg ${i}`,
        }));

        await setHistory('contato-001', history);

        const savedJson = JSON.parse(mockRedis.setEx.mock.calls[0][2]);
        expect(savedJson.history).toHaveLength(50);
        // Deve manter os últimos 50
        expect(savedJson.history[0].content).toBe('Msg 10');
    });

    it('usa memória como fallback se Redis falhar', async () => {
        mockRedis.setEx.mockRejectedValue(new Error('Connection refused'));
        mockRedis.get.mockRejectedValue(new Error('Connection refused'));

        await setHistory('contato-fallback', [{ role: 'user', content: 'Fallback' }]);

        // Busca deve funcionar via memória
        const result = await getHistory('contato-fallback');
        expect(result).toHaveLength(1);
    });
});

// ====================================
// GET LAST AGENT
// ====================================

describe('getLastAgent', () => {
    it('retorna undefined se não há cache', async () => {
        const result = await getLastAgent('contato-001');
        expect(result).toBeUndefined();
    });

    it('retorna último agente do Redis', async () => {
        mockRedis.get.mockResolvedValue(JSON.stringify({
            history: [],
            lastAgent: 'PRESENTER',
        }));

        const result = await getLastAgent('contato-001');
        expect(result).toBe('PRESENTER');
    });

    it('retorna do fallback se Redis falhar', async () => {
        mockRedis.get.mockRejectedValue(new Error('Offline'));
        mockRedis.setEx.mockRejectedValue(new Error('Offline'));

        // Salva via fallback
        await setHistory('contato-agent-fallback', [], 'ADMIN');

        const result = await getLastAgent('contato-agent-fallback');
        expect(result).toBe('ADMIN');
    });
});

// ====================================
// CLEAR HISTORY
// ====================================

describe('clearHistory', () => {
    it('remove do Redis', async () => {
        await clearHistory('contato-001');
        expect(mockRedis.del).toHaveBeenCalledWith('elyon:conv:contato-001');
    });

    it('não falha se Redis estiver offline', async () => {
        mockRedis.del.mockRejectedValue(new Error('Offline'));
        await expect(clearHistory('contato-001')).resolves.not.toThrow();
    });
});

// ====================================
// GET CACHE STATS
// ====================================

describe('getCacheStats', () => {
    it('retorna contagem de chaves Redis', async () => {
        mockRedis.keys.mockResolvedValue(['elyon:conv:a', 'elyon:conv:b']);
        const stats = await getCacheStats();
        expect(stats.redisKeys).toBe(2);
        expect(stats.memoryKeys).toBeGreaterThanOrEqual(0);
    });

    it('retorna 0 Redis keys se Redis offline', async () => {
        mockRedis.keys.mockRejectedValue(new Error('Offline'));
        const stats = await getCacheStats();
        expect(stats.redisKeys).toBe(0);
    });
});
