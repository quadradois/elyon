/**
 * Cliente Redis para Elyon
 * Usado para cache, filas de jobs e armazenamento temporário
 */

import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let redisConnectionPromise: Promise<RedisClientType> | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    // Evita sockets duplicados quando readiness, autenticação e schedulers
    // inicializam o Redis simultaneamente durante o startup.
    if (redisConnectionPromise) {
        return redisConnectionPromise;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    const client = createClient({ url: redisUrl }) as RedisClientType;
    redisClient = client;

    client.on('error', (err) => {
        console.error('[Redis] Erro de conexão:', err);
    });

    client.on('connect', () => {
        console.log('[Redis] Conectado com sucesso');
    });

    redisConnectionPromise = client.connect()
        .then(() => client)
        .catch(async (error) => {
            if (redisClient === client) redisClient = null;
            if (client.isOpen) await client.disconnect();
            throw error;
        })
        .finally(() => {
            redisConnectionPromise = null;
        });

    return redisConnectionPromise;
}

export async function closeRedisClient(): Promise<void> {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        redisClient = null;
    }
    redisConnectionPromise = null;
}

export { redisClient };
