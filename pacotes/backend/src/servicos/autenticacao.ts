import { prisma } from '../lib/db';
import { hashSenha, compararSenha } from '../utilitarios/senha';
import { gerarToken, gerarRefreshToken } from '../utilitarios/token';
import { z } from 'zod';

// Schemas de Validação
const LoginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6),
  tenantSlug: z.string().optional()
});

const RegistroSchema = z.object({
  nome: z.string().min(3),
  email: z.string().email(),
  senha: z.string().min(6),
  tenantSlug: z.string()
});

export class ServicoAutenticacao {

  async login(dados: z.infer<typeof LoginSchema>) {
    let usuario;
    let tenant;

    if (dados.tenantSlug) {
      // 1. Buscar Tenant pelo Slug
      tenant = await prisma.tenant.findUnique({
        where: { slug: dados.tenantSlug }
      });

      if (!tenant) throw new Error('Imobiliária não encontrada');
      if (tenant.status !== 'ATIVO') throw new Error('Imobiliária inativa');

      // 2. Buscar Usuário no Tenant específico
      usuario = await prisma.usuario.findUnique({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email: dados.email
          }
        }
      });
    } else {
      // 1. Buscar Usuário Globalmente (Inferência de Tenant)
      const usuarios = await prisma.usuario.findMany({
        where: { email: dados.email },
        include: { tenant: true }
      });

      if (usuarios.length === 0) throw new Error('Credenciais inválidas');
      
      // Se houver mais de um, por enquanto pegamos o primeiro ou poderíamos retornar erro pedindo slug
      // Mas baseados na análise, hoje todos são únicos.
      if (usuarios.length > 1) {
        throw new Error('Múltiplas contas encontradas. Por favor, informe o slug da imobiliária.');
      }

      usuario = usuarios[0];
      tenant = usuario.tenant;

      if (!tenant) throw new Error('Imobiliária não vinculada ao usuário');
      if (tenant.status !== 'ATIVO') throw new Error('Imobiliária inativa');
    }

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

    const refreshToken = await gerarRefreshToken(usuario.id);

    // 5. Atualizar último login
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLoginEm: new Date() }
    });

    return {
      token,
      refreshToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel
      },
      tenant: {
        id: tenant.id,
        nome: tenant.nome,
        slug: tenant.slug,
        plano: tenant.plano,
        planoTipo: tenant.planoTipo
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
