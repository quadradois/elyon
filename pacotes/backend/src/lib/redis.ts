/**
 * Cliente Redis para Elyon
 * Usado para cache, filas de jobs e armazenamento temporário
 */

import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err) => {
        console.error('[Redis] Erro de conexão:', err);
    });

    redisClient.on('connect', () => {
        console.log('[Redis] Conectado com sucesso');
    });

    await redisClient.connect();
    return redisClient;
}

export async function closeRedisClient(): Promise<void> {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        redisClient = null;
    }
}

export { redisClient };
