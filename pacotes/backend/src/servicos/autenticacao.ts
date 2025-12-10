import { prisma } from '../lib/db';
import { hashSenha, compararSenha } from '../utilitarios/senha';
import { gerarToken } from '../utilitarios/token';
import { z } from 'zod';

// Schemas de Validação
const LoginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6),
  tenantSlug: z.string()
});

const RegistroSchema = z.object({
  nome: z.string().min(3),
  email: z.string().email(),
  senha: z.string().min(6),
  tenantSlug: z.string()
});

export class ServicoAutenticacao {
  
  async login(dados: z.infer<typeof LoginSchema>) {
    // 1. Buscar Tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: dados.tenantSlug }
    });

    if (!tenant) throw new Error('Tenant não encontrado');
    if (tenant.status !== 'ATIVO') throw new Error('Tenant inativo');

    // 2. Buscar Usuário
    const usuario = await prisma.usuario.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: dados.email
        }
      }
    });

    if (!usuario) throw new Error('Credenciais inválidas');
    if (!usuario.estaAtivo) throw new Error('Usuário inativo');

    // 3. Verificar Senha
    const senhaValida = await compararSenha(dados.senha, usuario.senha);
    if (!senhaValida) throw new Error('Credenciais inválidas');

    // 4. Gerar Token
    const token = gerarToken({
      id: usuario.id,
      email: usuario.email,
      tenantId: tenant.id,
      papel: usuario.papel
    });

    // 5. Atualizar último login
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLoginEm: new Date() }
    });

    return {
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel
      },
      tenant: {
        id: tenant.id,
        nome: tenant.nome,
        slug: tenant.slug
      }
    };
  }

  async registrar(dados: z.infer<typeof RegistroSchema>) {
    // Nota: Em produção, registro geralmente é feito via convite ou admin
    // Aqui permitimos para facilitar testes/MVP se necessário
    
    const tenant = await prisma.tenant.findUnique({
      where: { slug: dados.tenantSlug }
    });

    if (!tenant) throw new Error('Tenant não encontrado');

    const existeUsuario = await prisma.usuario.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: dados.email
        }
      }
    });

    if (existeUsuario) throw new Error('Usuário já existe neste tenant');

    const senhaHash = await hashSenha(dados.senha);

    const usuario = await prisma.usuario.create({
      data: {
        tenantId: tenant.id,
        nome: dados.nome,
        email: dados.email,
        senha: senhaHash,
        papel: 'CORRETOR' // Default
      }
    });

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email
    };
  }
}
