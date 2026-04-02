import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getRedisClient } from '../lib/redis';

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

if (!SECRET) {
  throw new Error('[FATAL] JWT_SECRET não configurado! Configure a variável de ambiente antes de iniciar o servidor.');
}

export const gerarToken = (payload: object): string => {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN as any });
};

export const verificarToken = (token: string): { payload: any, erro: 'EXPIRADO' | 'INVALIDO' | null } => {
  try {
    const payload = jwt.verify(token, SECRET);
    return { payload, erro: null };
  } catch (erro) {
    if (erro instanceof TokenExpiredError) {
      return { payload: null, erro: 'EXPIRADO' };
    }
    return { payload: null, erro: 'INVALIDO' };
  }
};

const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 dias em segundos

export const gerarRefreshToken = async (usuarioId: string): Promise<string> => {
  const refreshToken = randomUUID();
  try {
    const redis = await getRedisClient();
    await redis.set(`refresh_token:${refreshToken}`, usuarioId, { EX: REFRESH_TOKEN_TTL });
  } catch (erro) {
    console.error('[Token] Erro ao salvar refresh token no Redis', erro);
  }
  return refreshToken;
};

export const validarRefreshToken = async (refreshToken: string): Promise<string | null> => {
  try {
    const redis = await getRedisClient();
    const usuarioId = await redis.get(`refresh_token:${refreshToken}`);
    return usuarioId;
  } catch (erro) {
    console.error('[Token] Erro ao validar refresh token no Redis', erro);
    return null;
  }
};

export const revogarRefreshToken = async (refreshToken: string): Promise<void> => {
  try {
    const redis = await getRedisClient();
    await redis.del(`refresh_token:${refreshToken}`);
  } catch (erro) {
    console.error('[Token] Erro ao revogar refresh token no Redis', erro);
  }
};
