/**
 * Redis Cache Helpers — Elyon Webhook
 *
 * Substitui Maps/Sets em memória por operações Redis,
 * garantindo que debounce/dedupe/cooldown sobrevivam a restarts
 * e funcionem corretamente em múltiplas réplicas.
 */

import { getRedisClient } from './redis';

// ─────────────────────────────────────────────────
// DEDUPE DE MENSAGENS (substitui mensagensJaVistas Map)
// ─────────────────────────────────────────────────

const TTL_DEDUPE_MSG_S = 10 * 60; // 10 minutos em segundos

export async function marcarMensagemComoVista(chave: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.set(`dedupe:msg:${chave}`, '1', { EX: TTL_DEDUPE_MSG_S });
  } catch {
    // Falha silenciosa: se Redis estiver fora, não bloquear o fluxo
  }
}

export async function jaVimosMensagem(chave: string): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    const exists = await redis.exists(`dedupe:msg:${chave}`);
    return exists > 0;
  } catch {
    return false; // Em caso de falha, permitir processamento
  }
}

// ─────────────────────────────────────────────────
// COOLDOWN DE RESPOSTA (substitui ultimaRespostaPorContato Map)
// ─────────────────────────────────────────────────

const COOLDOWN_RESPOSTA_S = 10; // 10 segundos

export async function registrarRespostaEnviada(contatoId: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.set(`cooldown:resposta:${contatoId}`, Date.now().toString(), { EX: COOLDOWN_RESPOSTA_S });
  } catch {}
}

export async function estaNoCooldown(contatoId: string): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    const exists = await redis.exists(`cooldown:resposta:${contatoId}`);
    return exists > 0;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────
// MUTEX DE PROCESSAMENTO (substitui processandoContato Map)
// ─────────────────────────────────────────────────

const TTL_MUTEX_S = 30; // 30 segundos máximo de lock

export async function adquirirMutexContato(contatoId: string): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    // NX = set only if not exists → atomic mutex
    const result = await redis.set(`mutex:contato:${contatoId}`, '1', { NX: true, EX: TTL_MUTEX_S });
    return result === 'OK';
  } catch {
    return true; // Em caso de falha, permitir processamento
  }
}

export async function liberarMutexContato(contatoId: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.del(`mutex:contato:${contatoId}`);
  } catch {}
}

// ─────────────────────────────────────────────────
// DEDUPE DE ASSINATURAS (substitui ultimasAssinaturasProcessadas Map)
// ─────────────────────────────────────────────────

const TTL_DEDUPE_ASSINATURA_S = 5 * 60; // 5 minutos

export async function marcarAssinaturaProcessada(contatoId: string, assinatura: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.set(`assinatura:${contatoId}`, assinatura, { EX: TTL_DEDUPE_ASSINATURA_S });
  } catch {}
}

export async function obterAssinaturaProcessada(contatoId: string): Promise<string | null> {
  try {
    const redis = await getRedisClient();
    return await redis.get(`assinatura:${contatoId}`);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────
// DEDUPE DE RESPOSTA (substitui ultimoHashRespostaPorContato Map)
// ─────────────────────────────────────────────────

const TTL_DEDUPE_RESPOSTA_S = 30; // 30 segundos

export async function registrarHashResposta(contatoId: string, hash: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.set(`hash:resposta:${contatoId}`, hash, { EX: TTL_DEDUPE_RESPOSTA_S });
  } catch {}
}

export async function obterHashResposta(contatoId: string): Promise<string | null> {
  try {
    const redis = await getRedisClient();
    return await redis.get(`hash:resposta:${contatoId}`);
  } catch {
    return null;
  }
}
