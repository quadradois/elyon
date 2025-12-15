// Serviço de Gestão de Clientes
// Gerencia criação, edição e operações de clientes (tenants)

import { prisma as prismaClient } from '../lib/db';
import { hashSenha } from '../utilitarios/senha';
import * as servicoAsaas from './servico-asaas';

// Cast para evitar erros até regenerar Prisma
const prisma = prismaClient as any;

// ====================================
// TIPOS
// ====================================

interface CriarClienteDTO {
  // Dados do Tenant
  nomeEmpresa: string;
  slug?: string;
  cnpj?: string;
  email: string;
  telefone?: string;
  cidade?: string;

  // Plano
  planoTipo: 'STARTER' | 'GROWTH' | 'PRO';

  // Dados do Usuário Admin
  nomeAdmin: string;
  emailAdmin: string;
  senhaAdmin?: string;

  // Opções
  integrarAsaas?: boolean;
}

interface EditarClienteDTO {
  nome?: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  cnpj?: string;
  planoTipo?: 'STARTER' | 'GROWTH' | 'PRO';
  status?: 'ATIVO' | 'SUSPENSO' | 'CANCELADO';
}

interface ConsumoCliente {
  tenantId: string;
  nomeEmpresa: string;
  plano: string;
  creditos: {
    mensais: number;
    prepagos: number;
    bonus: number;
    total: number;
  };
  consumoMes: {
    creditosUsados: number;
    transacoes: number;
  };
  historico: Array<{
    data: Date;
    tipo: string;
    creditos: number;
    descricao: string;
  }>;
}

// ====================================
// CONFIGURAÇÕES DE PLANOS
// ====================================

export const CONFIGURACOES_PLANOS = {
  STARTER: {
    valorMensal: 199.00,
    creditosMensais: 0,
    custoPorCreditoExtra: 2.00,
    taxaSetup: 899.00
  },
  GROWTH: {
    valorMensal: 299.00,
    creditosMensais: 100,
    custoPorCreditoExtra: 1.50,
    taxaSetup: 899.00
  },
  PRO: {
    valorMensal: 499.00,
    creditosMensais: 250,
    custoPorCreditoExtra: 1.00,
    taxaSetup: 899.00
  }
};

// ====================================
// FUNÇÕES
// ====================================

/**
 * Gera um slug a partir do nome
 */
function gerarSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * Gera uma senha aleatória
 */
function gerarSenhaAleatoria(tamanho: number = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  let senha = '';
  for (let i = 0; i < tamanho; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return senha;
}

/**
 * Criar novo cliente (tenant + usuário admin)
 */
export async function criarCliente(dados: CriarClienteDTO) {
  console.log('[GestaoClientes] Criando novo cliente:', dados.nomeEmpresa);

  // Gerar slug único
  let slug = dados.slug || gerarSlug(dados.nomeEmpresa);
  let slugOriginal = slug;
  let tentativa = 0;

  while (true) {
    const existente = await prisma.tenant.findUnique({ where: { slug } });
    if (!existente) break;
    tentativa++;
    slug = `${slugOriginal}-${tentativa}`;
  }

  // Gerar senha se não fornecida
  const senhaAdmin = dados.senhaAdmin || gerarSenhaAleatoria();
  const senhaHash = await hashSenha(senhaAdmin);

  // Configurações do plano
  const configPlano = CONFIGURACOES_PLANOS[dados.planoTipo];

  // Data de renovação (30 dias)
  const dataRenovacao = new Date();
  dataRenovacao.setDate(dataRenovacao.getDate() + 30);

  // Criar tenant
  const tenant = await prisma.tenant.create({
    data: {
      nome: dados.nomeEmpresa,
      slug,
      status: 'ATIVO',
      cnpj: dados.cnpj,
      email: dados.email,
      telefone: dados.telefone,
      cidade: dados.cidade,
      plano: dados.planoTipo,
      planoTipo: dados.planoTipo as any,
      valorPlano: configPlano.valorMensal,
      creditosMensais: configPlano.creditosMensais,
      creditosPrepagos: 0,
      creditosBonus: 0,
      dataRenovacao,
      statusPagamento: 'PENDENTE'
    }
  });

  console.log('[GestaoClientes] ✅ Tenant criado:', tenant.id);

  // Criar usuário admin
  const usuario = await prisma.usuario.create({
    data: {
      tenantId: tenant.id,
      nome: dados.nomeAdmin,
      email: dados.emailAdmin,
      senha: senhaHash,
      papel: 'ADMIN',
      estaAtivo: true
    }
  });

  console.log('[GestaoClientes] ✅ Usuário admin criado:', usuario.id);

  // Integrar com Asaas (opcional)
  let asaasClienteId = null;
  if (dados.integrarAsaas) {
    try {
      const clienteAsaas = await servicoAsaas.criarCliente({
        nome: dados.nomeEmpresa,
        email: dados.email,
        telefone: dados.telefone,
        cpfCnpj: dados.cnpj
      });

      asaasClienteId = clienteAsaas.id;

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { asaasClienteId }
      });

      console.log('[GestaoClientes] ✅ Cliente Asaas criado:', asaasClienteId);
    } catch (erro) {
      console.error('[GestaoClientes] ⚠️ Erro ao criar no Asaas:', erro);
      // Não interrompe o fluxo
    }
  }

  return {
    tenant: {
      id: tenant.id,
      nome: tenant.nome,
      slug: tenant.slug,
      plano: tenant.planoTipo,
      creditosIniciais: configPlano.creditosMensais
    },
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email
    },
    credenciais: {
      email: dados.emailAdmin,
      senha: senhaAdmin,
      tenantSlug: slug
    },
    asaasClienteId
  };
}

/**
 * Editar dados do cliente
 */
export async function editarCliente(tenantId: string, dados: EditarClienteDTO) {
  console.log('[GestaoClientes] Editando cliente:', tenantId);

  const updateData: any = {};

  if (dados.nome) updateData.nome = dados.nome;
  if (dados.email) updateData.email = dados.email;
  if (dados.telefone) updateData.telefone = dados.telefone;
  if (dados.cidade) updateData.cidade = dados.cidade;
  if (dados.cnpj) updateData.cnpj = dados.cnpj;
  if (dados.status) updateData.status = dados.status;

  // Atualizar plano
  if (dados.planoTipo) {
    const configPlano = CONFIGURACOES_PLANOS[dados.planoTipo];
    updateData.planoTipo = dados.planoTipo;
    updateData.plano = dados.planoTipo;
    updateData.valorPlano = configPlano.valorMensal;
    // Não altera créditos mensais imediatamente (só na renovação)
  }

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: updateData
  });

  console.log('[GestaoClientes] ✅ Cliente atualizado');

  return tenant;
}

/**
 * Desativar cliente (suspender ou cancelar)
 */
export async function desativarCliente(tenantId: string, motivo?: string) {
  console.log('[GestaoClientes] Desativando cliente:', tenantId);

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: 'SUSPENSO'
    }
  });

  // TODO: Cancelar assinatura no Asaas se existir

  console.log('[GestaoClientes] ✅ Cliente suspenso');

  return tenant;
}

/**
 * Reativar cliente
 */
export async function reativarCliente(tenantId: string) {
  console.log('[GestaoClientes] Reativando cliente:', tenantId);

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: 'ATIVO' }
  });

  console.log('[GestaoClientes] ✅ Cliente reativado');

  return tenant;
}

/**
 * Resetar senha do admin do tenant
 */
export async function resetarSenha(tenantId: string, novaSenha?: string) {
  console.log('[GestaoClientes] Resetando senha do admin:', tenantId);

  // Buscar usuário admin do tenant
  const usuario = await prisma.usuario.findFirst({
    where: {
      tenantId,
      papel: 'ADMIN'
    }
  });

  if (!usuario) {
    throw new Error('Usuário admin não encontrado para este tenant');
  }

  // Gerar nova senha se não fornecida
  const senha = novaSenha || gerarSenhaAleatoria();
  const senhaHash = await hashSenha(senha);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senha: senhaHash }
  });

  console.log('[GestaoClientes] ✅ Senha resetada para:', usuario.email);

  return {
    usuarioId: usuario.id,
    email: usuario.email,
    novaSenha: senha
  };
}

/**
 * Buscar dados de consumo do cliente
 */
export async function buscarConsumo(tenantId: string): Promise<ConsumoCliente> {
  console.log('[GestaoClientes] Buscando consumo:', tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant) {
    throw new Error('Tenant não encontrado');
  }

  // Buscar transações do mês atual
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const transacoesMes = await (prisma as any).transacao.findMany({
    where: {
      tenantId,
      criadoEm: { gte: inicioMes }
    }
  });

  // Buscar histórico recente
  const historicoRecente = await (prisma as any).transacao.findMany({
    where: { tenantId },
    orderBy: { criadoEm: 'desc' },
    take: 20
  });

  // Calcular consumo do mês
  const creditosUsados = transacoesMes.reduce((acc: number, t: any) => {
    if (t.tipo === 'ESTORNO') return acc;
    return acc + (t.creditos || 0);
  }, 0);

  return {
    tenantId,
    nomeEmpresa: tenant.nome,
    plano: tenant.planoTipo || 'STARTER',
    creditos: {
      mensais: tenant.creditosMensais,
      prepagos: tenant.creditosPrepagos,
      bonus: tenant.creditosBonus,
      total: tenant.creditosMensais + tenant.creditosPrepagos + tenant.creditosBonus
    },
    consumoMes: {
      creditosUsados,
      transacoes: transacoesMes.length
    },
    historico: historicoRecente.map((t: any) => ({
      data: t.criadoEm,
      tipo: t.tipo,
      creditos: t.creditos,
      descricao: t.descricao || '-'
    }))
  };
}

/**
 * Listar todos os clientes com resumo
 */
export async function listarClientes() {
  const clientes = await prisma.tenant.findMany({
    orderBy: { criadoEm: 'desc' },
    select: {
      id: true,
      nome: true,
      slug: true,
      status: true,
      plano: true,
      planoTipo: true,
      valorPlano: true,
      creditosMensais: true,
      creditosPrepagos: true,
      creditosBonus: true,
      dataRenovacao: true,
      statusPagamento: true,
      email: true,
      cidade: true,
      criadoEm: true
    }
  });

  return clientes.map((c: any) => ({
    ...c,
    creditosTotal: c.creditosMensais + c.creditosPrepagos + c.creditosBonus,
    valorPlano: Number(c.valorPlano)
  }));
}
