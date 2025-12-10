// Middleware de Autenticação e Autorização - Billing
// Protege rotas sensíveis verificando papel do usuário

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/db';
import { verificarToken } from '../utilitarios/token';

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

/**
 * Middleware que verifica se o usuário é SUPER_ADMIN
 * Deve ser usado em rotas que só você (dono do sistema) pode acessar
 */
export const verificarSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Verificar token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        erro: 'Não autorizado',
        mensagem: 'Token não fornecido'
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verificarToken(token);

    if (!payload) {
      res.status(401).json({
        erro: 'Token inválido',
        mensagem: 'Faça login novamente'
      });
      return;
    }

    // Buscar usuário no banco
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.id || payload.usuarioId }
    });

    if (!usuario) {
      res.status(401).json({
        erro: 'Usuário não encontrado',
        mensagem: 'Usuário foi removido ou não existe'
      });
      return;
    }

    // Verificar se é SUPER_ADMIN
    if (usuario.papel !== 'SUPER_ADMIN') {
      res.status(403).json({
        erro: 'Acesso negado',
        mensagem: 'Apenas administradores do sistema podem acessar este recurso',
        papelAtual: usuario.papel,
        papelNecessario: 'SUPER_ADMIN'
      });
      return;
    }

    // Anexar dados do usuário à requisição
    req.usuario = {
      id: usuario.id,
      email: usuario.email,
      papel: usuario.papel,
      tenantId: usuario.tenantId
    };

    // Para rotas de SUPER_ADMIN, não precisa de tenantId específico
    // pois ele pode ver todos os tenants
    
    next();
  } catch (erro) {
    console.error('Erro ao verificar SUPER_ADMIN:', erro);
    res.status(500).json({
      erro: 'Erro interno',
      mensagem: 'Não foi possível verificar autorização'
    });
  }
};

/**
 * Middleware que verifica se o usuário é ADMIN ou superior
 * Para rotas que donos de imobiliária podem acessar
 */
export const verificarAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ erro: 'Token não fornecido' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verificarToken(token);

    if (!payload) {
      res.status(401).json({ erro: 'Token inválido' });
      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.id || payload.usuarioId }
    });

    if (!usuario) {
      res.status(401).json({ erro: 'Usuário não encontrado' });
      return;
    }

    // SUPER_ADMIN, ADMIN podem acessar
    if (!['SUPER_ADMIN', 'ADMIN'].includes(usuario.papel)) {
      res.status(403).json({
        erro: 'Acesso negado',
        mensagem: 'Apenas administradores podem acessar este recurso'
      });
      return;
    }

    req.usuario = {
      id: usuario.id,
      email: usuario.email,
      papel: usuario.papel,
      tenantId: usuario.tenantId
    };
    req.tenantId = usuario.tenantId;
    
    next();
  } catch (erro) {
    console.error('Erro ao verificar admin:', erro);
    res.status(500).json({ erro: 'Erro interno' });
  }
};

/**
 * Middleware básico de autenticação
 * Apenas verifica se está logado e extrai tenantId
 */
export const verificarAutenticacao = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ erro: 'Token não fornecido' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verificarToken(token);

    if (!payload) {
      res.status(401).json({ erro: 'Token inválido' });
      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.id || payload.usuarioId }
    });

    if (!usuario) {
      res.status(401).json({ erro: 'Usuário não encontrado' });
      return;
    }

    req.usuario = {
      id: usuario.id,
      email: usuario.email,
      papel: usuario.papel,
      tenantId: usuario.tenantId
    };
    req.tenantId = usuario.tenantId;
    
    next();
  } catch (erro) {
    console.error('Erro ao verificar autenticação:', erro);
    res.status(500).json({ erro: 'Erro interno' });
  }
};
