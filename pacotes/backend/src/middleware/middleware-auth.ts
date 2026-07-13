// Middleware de Autenticação e Autorização
// Protege rotas sensíveis verificando papel do usuário

import { responderErro } from '../utilitarios/resposta';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/db';
import { getRedisClient } from '../lib/redis';
import { verificarToken } from '../utilitarios/token';

// ✅ TASK-01 + TASK-04: Apenas Authorization: Bearer é aceito.
// Tokens via query string (?token=) ficam nos logs do servidor (viloação LGPD).
// Headers alternativos aumentam superfície de ataque desnecessariamente.
const extrairToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
};

// Extender Request para incluir dados do usuário
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      usuario?: {
        id: string;
        email: string;
        papel: string;
        tenantId: string;
      };
    }
  }
}

// ✅ TASK-07: Função base compartilhada — elimina DRY violation nos 3 middlewares.
// Antes: extração de token + verificação JWT + lookup na DB repetidos 3x (240 linhas).
// Agora: lógica em um único lugar, middlewares compostos sobre esta função.
type UsuarioAutenticado = {
  id: string;
  email: string;
  papel: string;
  tenantId: string;
};

type UsuarioAutenticadoCache = UsuarioAutenticado & {
  estaAtivo: boolean;
  tenantStatus: string;
};

type ResultadoAuth =
  | { usuario: UsuarioAutenticado }
  | { erro: 401 | 403; mensagem: string };

async function buscarUsuarioAutenticado(req: Request): Promise<ResultadoAuth> {
  // O guard global já autenticou a requisição; evita lookup/cache duplicado em
  // routers que mantêm middleware de papel mais restritivo.
  if (req.usuario) return { usuario: req.usuario };

  const token = extrairToken(req);
  if (!token) {
    return { erro: 401, mensagem: 'Token não fornecido' };
  }

  const tokenValido = verificarToken(token);

  if (tokenValido.erro === 'EXPIRADO') {
    return { erro: 401, mensagem: 'Token expirado' };
  }

  if (tokenValido.erro || !tokenValido.payload) {
    return { erro: 401, mensagem: 'Token inválido' };
  }

  const payload = tokenValido.payload;
  const userId = payload.id || payload.usuarioId;

  // ✅ TASK-08: Cache Redis para usuário autenticado (reduz 1 query/DB por request API)
  let cachedUser = null;
  let redis = null;
  try {
    redis = await getRedisClient();
    cachedUser = await redis.get(`auth:user:${userId}`);
    if (cachedUser) {
      const usuarioFromCache = JSON.parse(cachedUser) as Partial<UsuarioAutenticadoCache>;
      if (usuarioFromCache.estaAtivo === true && usuarioFromCache.tenantStatus === 'ATIVO'
        && usuarioFromCache.id && usuarioFromCache.email && usuarioFromCache.papel && usuarioFromCache.tenantId) {
        return {
          usuario: {
            id: usuarioFromCache.id,
            email: usuarioFromCache.email,
            papel: usuarioFromCache.papel,
            tenantId: usuarioFromCache.tenantId
          }
        };
      }
      // Entradas do formato antigo não carregam status e devem ser revalidadas no banco.
      await redis.del(`auth:user:${userId}`);
    }
  } catch (erroCache) {
    console.warn(`[Auth] Falha no Redis para o usuário ${userId}:`, erroCache);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      papel: true,
      tenantId: true,
      estaAtivo: true,
      tenant: { select: { status: true } }
    }
  });

  if (!usuario) {
    return { erro: 401, mensagem: 'Usuário não encontrado' };
  }

  if (!usuario.estaAtivo || usuario.tenant.status !== 'ATIVO') {
    return { erro: 403, mensagem: 'Usuário ou tenant inativo' };
  }

  const usuarioAutenticado: UsuarioAutenticado = {
    id: usuario.id,
    email: usuario.email,
    papel: usuario.papel,
    tenantId: usuario.tenantId
  };

  // Grava no cache por 5 min (300s)
  if (redis) {
    try {
      const usuarioCache: UsuarioAutenticadoCache = {
        ...usuarioAutenticado,
        estaAtivo: true,
        tenantStatus: 'ATIVO'
      };
      await redis.setEx(`auth:user:${userId}`, 300, JSON.stringify(usuarioCache));
    } catch (e) {
      console.warn(`[Auth] Erro ao gravar cache do usuário ${userId}:`, e);
    }
  }

  return { usuario: usuarioAutenticado };
}

/**
 * Middleware que verifica se o usuário é SUPER_ADMIN.
 * Deve ser usado em rotas que só o dono do sistema pode acessar.
 */
export const verificarSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const resultado = await buscarUsuarioAutenticado(req);

    if ('erro' in resultado) {
      responderErro(res, resultado.erro, resultado.mensagem);
      return;
    }

    const { usuario } = resultado;

    if (usuario.papel !== 'SUPER_ADMIN') {
      responderErro(res, 403, 'Acesso negado', {
        mensagem: 'Apenas administradores do sistema podem acessar este recurso',
        papelAtual: usuario.papel,
        papelNecessario: 'SUPER_ADMIN'
      });
      return;
    }

    req.usuario = usuario;
    next();
  } catch (erro) {
    console.error('[Auth] Erro ao verificar SUPER_ADMIN:', erro);
    responderErro(res, 500, 'Erro interno');
  }
};

/**
 * Middleware que verifica se o usuário é ADMIN ou superior.
 * Para rotas que donos de imobiliária podem acessar.
 */
export const verificarAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const resultado = await buscarUsuarioAutenticado(req);

    if ('erro' in resultado) {
      responderErro(res, resultado.erro, resultado.mensagem);
      return;
    }

    const { usuario } = resultado;

    if (!['SUPER_ADMIN', 'ADMIN'].includes(usuario.papel)) {
      responderErro(res, 403, 'Acesso negado', {
        mensagem: 'Apenas administradores podem acessar este recurso'
      });
      return;
    }

    req.usuario = usuario;
    req.tenantId = usuario.tenantId;
    next();
  } catch (erro) {
    console.error('[Auth] Erro ao verificar admin:', erro);
    responderErro(res, 500, 'Erro interno');
  }
};

/**
 * Middleware básico de autenticação.
 * Apenas verifica se está logado e extrai tenantId.
 */
export const verificarAutenticacao = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const resultado = await buscarUsuarioAutenticado(req);

    if ('erro' in resultado) {
      responderErro(res, resultado.erro, resultado.mensagem);
      return;
    }

    const { usuario } = resultado;

    req.usuario = usuario;
    req.tenantId = usuario.tenantId;

    if (!req.tenantId) {
      console.warn(`[Auth] Usuário ${usuario.email} autenticado mas sem Tenant ID vinculado.`);
    }

    next();
  } catch (erro) {
    console.error('[Auth] Erro ao verificar autenticação:', erro);
    responderErro(res, 500, 'Erro interno');
  }
};
