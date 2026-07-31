import { prisma } from '../lib/db';

export interface EspecialistaResolvido {
  tipo: 'USUARIO_EQUIPE' | 'EXTERNO_TENANT';
  origem: 'RESPONSAVEL_CAMPANHA' | 'FALLBACK_CAMPANHA' | 'POOL_TENANT' | 'PERFIL_TENANT';
  usuarioId?: string;
  nome: string;
  telefone: string;
  cargo: string;
  email?: string;
}

function normalizarTelefone(telefone?: string | null): string {
  return (telefone || '').replace(/\D/g, '');
}

function telefoneValido(telefone?: string | null): boolean {
  const digits = normalizarTelefone(telefone);
  return digits.length >= 10;
}

function cargoPorPapel(papel?: string | null): string {
  if (papel === 'ADMIN') return 'Especialista Comercial';
  return 'Corretor Especialista';
}

function elegivelUsuario(usuario: any): boolean {
  if (!usuario) return false;
  if (!usuario.estaAtivo) return false;
  if (!telefoneValido(usuario.telefone)) return false;
  return true;
}

export async function resolverEspecialistaCampanha(params: {
  tenantId: string;
  campanhaId: string;
}): Promise<EspecialistaResolvido | null> {
  const campanha = await (prisma.campanha as any).findUnique({
    where: { id: params.campanhaId },
    select: {
      id: true,
      tenantId: true,
      responsavelCorretor: {
        select: { id: true, nome: true, telefone: true, email: true, papel: true, estaAtivo: true }
      },
      fallbackCorretor: {
        select: { id: true, nome: true, telefone: true, email: true, papel: true, estaAtivo: true }
      },
    }
  });

  if (!campanha || campanha.tenantId !== params.tenantId) return null;

  if (elegivelUsuario(campanha.responsavelCorretor)) {
    return {
      tipo: 'USUARIO_EQUIPE',
      origem: 'RESPONSAVEL_CAMPANHA',
      usuarioId: campanha.responsavelCorretor.id,
      nome: campanha.responsavelCorretor.nome,
      telefone: campanha.responsavelCorretor.telefone,
      cargo: cargoPorPapel(campanha.responsavelCorretor.papel),
      email: campanha.responsavelCorretor.email || undefined,
    };
  }

  if (elegivelUsuario(campanha.fallbackCorretor)) {
    return {
      tipo: 'USUARIO_EQUIPE',
      origem: 'FALLBACK_CAMPANHA',
      usuarioId: campanha.fallbackCorretor.id,
      nome: campanha.fallbackCorretor.nome,
      telefone: campanha.fallbackCorretor.telefone,
      cargo: cargoPorPapel(campanha.fallbackCorretor.papel),
      email: campanha.fallbackCorretor.email || undefined,
    };
  }

  // Prioriza corretores. Em tenants que ainda operam apenas com perfis ADMIN,
  // permite um especialista comercial ativo como fallback, evitando agenda órfã.
  const poolCorretor = await prisma.usuario.findFirst({
    where: {
      tenantId: params.tenantId,
      estaAtivo: true,
      papel: 'CORRETOR',
      telefone: { not: null },
    },
    orderBy: { atualizadoEm: 'desc' },
    select: { id: true, nome: true, telefone: true, email: true, papel: true }
  });
  const pool = poolCorretor || await prisma.usuario.findFirst({
    where: {
      tenantId: params.tenantId,
      estaAtivo: true,
      papel: 'ADMIN',
      telefone: { not: null },
    },
    orderBy: { atualizadoEm: 'desc' },
    select: { id: true, nome: true, telefone: true, email: true, papel: true }
  });

  if (pool && elegivelUsuario(pool)) {
    return {
      tipo: 'USUARIO_EQUIPE',
      origem: 'POOL_TENANT',
      usuarioId: pool.id,
      nome: pool.nome,
      telefone: pool.telefone!,
      cargo: cargoPorPapel(pool.papel),
      email: pool.email || undefined,
    };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: {
      nome: true,
      perfilVenda: true,
    }
  });

  const especialista = (tenant?.perfilVenda as any)?.especialistaHandoff;
  if (especialista?.ativo && especialista?.nome && telefoneValido(especialista?.telefone)) {
    return {
      tipo: 'EXTERNO_TENANT',
      origem: 'PERFIL_TENANT',
      nome: String(especialista.nome || '').trim(),
      telefone: String(especialista.telefone || '').trim(),
      cargo: String(especialista.cargo || 'Especialista').trim(),
      email: especialista.email ? String(especialista.email).trim() : undefined,
    };
  }

  return null;
}
