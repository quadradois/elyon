import { responderErro } from '../utilitarios/resposta';
import { Router } from 'express';
import { ServicoAutenticacao } from '../servicos/autenticacao';
import { prisma } from '../lib/db';
import { compararSenha } from '../utilitarios/senha';
import { gerarToken, gerarRefreshToken, validarRefreshToken, revogarRefreshToken } from '../utilitarios/token';
import { verificarAdmin } from '../middleware/middleware-auth';
import { ServicoAuditoria } from '../servicos/servico-auditoria';
import { z } from 'zod';

const router = Router();
const servicoAuth = new ServicoAutenticacao();

router.post('/login', async (req, res) => {
  try {
    const resultado = await servicoAuth.login(req.body);
    ServicoAuditoria.registrar({
      tenantId: resultado.tenant?.id || 'GLOBAL',
      usuarioId: resultado.usuario.id,
      acao: 'LOGIN',
      ip: req.socket.remoteAddress || req.headers['x-forwarded-for'] as string
    });
    res.json(resultado);
  } catch (erro: any) {
    responderErro(res, 401, 'Erro de validação ou processamento');
  }
});

// ✅ PROTEGIDA: Apenas ADMIN ou SUPER_ADMIN podem criar usuários
router.post('/registrar', verificarAdmin, async (req, res) => {
  try {
    const resultado = await servicoAuth.registrar(req.body);
    res.status(201).json(resultado);
  } catch (erro: any) {
    responderErro(res, 400, 'Erro de validação ou processamento');
  }
});

// ====================================
// REFRESH TOKEN
// ====================================
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return responderErro(res, 400, 'Refresh token é obrigatório');
    }
    
    const usuarioId = await validarRefreshToken(refreshToken);
    if (!usuarioId) {
      return responderErro(res, 401, 'Refresh token inválido ou expirado');
    }
    
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { tenant: true }
    });
    
    if (!usuario || !usuario.estaAtivo) {
      return responderErro(res, 401, 'Usuário inativo ou não encontrado');
    }
    
    // Revoga o token atual (rotation)
    await revogarRefreshToken(refreshToken);
    
    // Gera novos tokens
    const novoToken = gerarToken({
      id: usuario.id,
      email: usuario.email,
      tenantId: usuario.tenantId,
      papel: usuario.papel
    });
    
    const novoRefreshToken = await gerarRefreshToken(usuario.id);
    
    res.json({ token: novoToken, refreshToken: novoRefreshToken });
  } catch (erro: any) {
    console.error('[Auth] Erro no refresh token:', erro);
    responderErro(res, 500, 'Erro interno na atualização do token');
  }
});

// ====================================
// LOGIN ADMIN (SUPER_ADMIN apenas)
// Não requer tenantSlug - busca por email globalmente
// ====================================
router.post('/admin-login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    
    if (!email || !senha) {
      return responderErro(res, 400, 'Email e senha são obrigatórios');
    }
    
    // Buscar usuário SUPER_ADMIN por email (qualquer tenant)
    const usuario = await prisma.usuario.findFirst({
      where: {
        email: email,
        papel: 'SUPER_ADMIN'
      },
      include: {
        tenant: true
      }
    });
    
    if (!usuario) {
      return responderErro(res, 401, 'Credenciais inválidas ou sem permissão');
    }
    
    if (!usuario.estaAtivo) {
      return responderErro(res, 401, 'Usuário inativo');
    }
    
    // Verificar senha
    const senhaValida = await compararSenha(senha, usuario.senha);
    if (!senhaValida) {
      return responderErro(res, 401, 'Credenciais inválidas');
    }
    
    // Gerar token
    const token = gerarToken({
      id: usuario.id,
      email: usuario.email,
      tenantId: usuario.tenantId,
      papel: usuario.papel
    });
    
    const refreshToken = await gerarRefreshToken(usuario.id);

    // Atualizar último login
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLoginEm: new Date() }
    });
    
    ServicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.id,
      acao: 'LOGIN',
      entidade: 'SUPER_ADMIN',
      ip: req.socket.remoteAddress || req.headers['x-forwarded-for'] as string
    });

    res.json({
      token,
      refreshToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel
      },
      tenant: usuario.tenant ? {
        id: usuario.tenant.id,
        nome: usuario.tenant.nome,
        slug: usuario.tenant.slug
      } : null
    });
    
  } catch (erro: any) {
    console.error('[Auth] Erro no admin-login:', erro);
    responderErro(res, 500, 'Erro interno no login');
  }
});

export default router;
