import { Router } from 'express';
import { ServicoAutenticacao } from '../servicos/autenticacao';
import { prisma } from '../lib/db';
import { compararSenha } from '../utilitarios/senha';
import { gerarToken } from '../utilitarios/token';
import { z } from 'zod';

const router = Router();
const servicoAuth = new ServicoAutenticacao();

router.post('/login', async (req, res) => {
  try {
    const resultado = await servicoAuth.login(req.body);
    res.json(resultado);
  } catch (erro: any) {
    res.status(401).json({ erro: erro.message });
  }
});

router.post('/registrar', async (req, res) => {
  try {
    const resultado = await servicoAuth.registrar(req.body);
    res.status(201).json(resultado);
  } catch (erro: any) {
    res.status(400).json({ erro: erro.message });
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
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
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
      return res.status(401).json({ erro: 'Credenciais inválidas ou sem permissão' });
    }
    
    if (!usuario.estaAtivo) {
      return res.status(401).json({ erro: 'Usuário inativo' });
    }
    
    // Verificar senha
    const senhaValida = await compararSenha(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }
    
    // Gerar token
    const token = gerarToken({
      id: usuario.id,
      email: usuario.email,
      tenantId: usuario.tenantId,
      papel: usuario.papel
    });
    
    // Atualizar último login
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLoginEm: new Date() }
    });
    
    res.json({
      token,
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
    res.status(500).json({ erro: 'Erro interno no login' });
  }
});

export default router;
