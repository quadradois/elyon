// Serviço de Créditos - Elyon Billing
// Gerencia consumo e adição de créditos para tenants

import { prisma } from '../lib/db';
import { TipoCredito, PlanoTipo } from '@prisma/client';

// ====================================
// CONFIGURAÇÃO DE PLANOS
// ====================================

export const CREDITOS_POR_PLANO: Record<PlanoTipo, number> = {
  STARTER: 100,
  GROWTH: 200,
  PRO: 500
};

export const VALOR_POR_PLANO: Record<PlanoTipo, number> = {
  STARTER: 199,
  GROWTH: 299,
  PRO: 499
};

// ====================================
// CONSULTAR SALDO
// ====================================

interface SaldoCreditos {
  mensais: number;
  prepagos: number;
  bonus: number;
  total: number;
  plano: PlanoTipo;
  dataRenovacao: Date | null;
}

export async function consultarSaldo(tenantId: string): Promise<SaldoCreditos> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      creditosMensais: true,
      creditosPrepagos: true,
      creditosBonus: true,
      planoTipo: true,
      dataRenovacao: true
    }
  });

  if (!tenant) {
    throw new Error('Tenant não encontrado');
  }

  return {
    mensais: tenant.creditosMensais,
    prepagos: tenant.creditosPrepagos,
    bonus: tenant.creditosBonus,
    total: tenant.creditosMensais + tenant.creditosPrepagos + tenant.creditosBonus,
    plano: tenant.planoTipo,
    dataRenovacao: tenant.dataRenovacao
  };
}

// ====================================
// CONSUMIR CRÉDITO
// ====================================

export type TipoCreditoUsado = 'MENSAIS' | 'PREPAGOS' | 'BONUS';

interface ResultadoConsumo {
  sucesso: boolean;
  tipoUsado: TipoCreditoUsado;
  saldoRestante: SaldoCreditos;
}

export async function consumirCredito(tenantId: string): Promise<ResultadoConsumo> {
  // Buscar tenant com lock para evitar race condition
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant) {
    throw new Error('Tenant não encontrado');
  }

  // Verificar saldo total
  const saldoTotal = 
    tenant.creditosMensais + 
    tenant.creditosPrepagos + 
    tenant.creditosBonus;

  if (saldoTotal <= 0) {
    throw new Error('Sem créditos disponíveis! Faça uma recarga para continuar.');
  }

  // Ordem de prioridade: Mensais → Bônus → Pré-pagos
  let tipoUsado: TipoCreditoUsado;
  let updateData: Record<string, { decrement: number }>;

  if (tenant.creditosMensais > 0) {
    tipoUsado = 'MENSAIS';
    updateData = { creditosMensais: { decrement: 1 } };
  } else if (tenant.creditosBonus > 0) {
    tipoUsado = 'BONUS';
    updateData = { creditosBonus: { decrement: 1 } };
  } else {
    tipoUsado = 'PREPAGOS';
    updateData = { creditosPrepagos: { decrement: 1 } };
  }

  // Atualizar saldo
  const tenantAtualizado = await prisma.tenant.update({
    where: { id: tenantId },
    data: updateData,
    select: {
      creditosMensais: true,
      creditosPrepagos: true,
      creditosBonus: true,
      planoTipo: true,
      dataRenovacao: true
    }
  });

  return {
    sucesso: true,
    tipoUsado,
    saldoRestante: {
      mensais: tenantAtualizado.creditosMensais,
      prepagos: tenantAtualizado.creditosPrepagos,
      bonus: tenantAtualizado.creditosBonus,
      total: tenantAtualizado.creditosMensais + tenantAtualizado.creditosPrepagos + tenantAtualizado.creditosBonus,
      plano: tenantAtualizado.planoTipo,
      dataRenovacao: tenantAtualizado.dataRenovacao
    }
  };
}

// ====================================
// ADICIONAR CRÉDITOS
// ====================================

interface OpcoesAdicao {
  quantidade: number;
  tipo: TipoCredito;
  descricao?: string;
  promocao?: string;
}

export async function adicionarCreditos(
  tenantId: string, 
  opcoes: OpcoesAdicao
): Promise<SaldoCreditos> {
  const { quantidade, tipo, descricao } = opcoes;

  let updateData: Record<string, { increment: number }>;

  switch (tipo) {
    case 'MENSAIS':
      updateData = { creditosMensais: { increment: quantidade } };
      break;
    case 'PREPAGOS':
      updateData = { creditosPrepagos: { increment: quantidade } };
      break;
    case 'BONUS':
      updateData = { creditosBonus: { increment: quantidade } };
      break;
    default:
      throw new Error('Tipo de crédito inválido');
  }

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: updateData,
    select: {
      creditosMensais: true,
      creditosPrepagos: true,
      creditosBonus: true,
      planoTipo: true,
      dataRenovacao: true
    }
  });

  return {
    mensais: tenant.creditosMensais,
    prepagos: tenant.creditosPrepagos,
    bonus: tenant.creditosBonus,
    total: tenant.creditosMensais + tenant.creditosPrepagos + tenant.creditosBonus,
    plano: tenant.planoTipo,
    dataRenovacao: tenant.dataRenovacao
  };
}

// ====================================
// RENOVAR PLANO (Reset Mensal)
// ====================================

export async function renovarPlano(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant) {
    throw new Error('Tenant não encontrado');
  }

  const creditosAnteriores = tenant.creditosMensais;
  const creditosNovos = CREDITOS_POR_PLANO[tenant.planoTipo];

  // Usar transação para garantir integridade
  await prisma.$transaction([
    // Registrar log de renovação
    prisma.renovacaoLog.create({
      data: {
        tenantId,
        planoAnterior: tenant.planoTipo,
        planoNovo: tenant.planoTipo,
        creditosExpirados: creditosAnteriores,
        creditosNovos
      }
    }),
    // Resetar créditos mensais
    prisma.tenant.update({
      where: { id: tenantId },
      data: {
        creditosMensais: creditosNovos,
        dataRenovacao: calcularProximaRenovacao(),
        statusPagamento: 'PAGO'
      }
    })
  ]);
}

// ====================================
// VERIFICAR SE TEM CRÉDITOS
// ====================================

export async function temCreditos(tenantId: string): Promise<boolean> {
  const saldo = await consultarSaldo(tenantId);
  return saldo.total > 0;
}

// ====================================
// PROMOÇÃO DIA 15
// ====================================

interface ResultadoPromocao {
  creditosBase: number;
  creditosBonus: number;
  total: number;
  promocaoAplicada: string | null;
}

export function calcularCreditosRecarga(
  creditosBase: number,
  data: Date = new Date()
): ResultadoPromocao {
  const isDia15 = data.getDate() === 15;

  if (isDia15) {
    return {
      creditosBase,
      creditosBonus: creditosBase, // DOBRO
      total: creditosBase * 2,
      promocaoAplicada: 'dia15'
    };
  }

  return {
    creditosBase,
    creditosBonus: 0,
    total: creditosBase,
    promocaoAplicada: null
  };
}

// ====================================
// HELPERS
// ====================================

function calcularProximaRenovacao(): Date {
  const hoje = new Date();
  const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  return proximoMes;
}

// ====================================
// EXPORTS
// ====================================

export const servicoCreditos = {
  consultarSaldo,
  consumirCredito,
  adicionarCreditos,
  renovarPlano,
  temCreditos,
  calcularCreditosRecarga,
  CREDITOS_POR_PLANO,
  VALOR_POR_PLANO
};
