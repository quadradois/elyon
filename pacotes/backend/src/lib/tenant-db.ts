import { Prisma } from '@prisma/client';
import { prisma } from './db';

export type TenantTransaction = Prisma.TransactionClient;

export interface TenantAdminContext {
  tenantId: string;
  actor: string;
  reason: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validarTenantId(tenantId: string): void {
  if (!UUID_PATTERN.test(tenantId)) {
    throw new Error('tenantId invalido para contexto RLS');
  }
}

function validarContextoAdmin(contexto: TenantAdminContext): void {
  validarTenantId(contexto.tenantId);
  if (!contexto.actor.trim() || contexto.actor.length > 120) {
    throw new Error('actor obrigatorio para acesso administrativo');
  }
  if (contexto.reason.trim().length < 8 || contexto.reason.length > 500) {
    throw new Error('reason administrativo deve ter entre 8 e 500 caracteres');
  }
}

/**
 * Executa o callback sob a role RLS do piloto. O tenant e a role usam SET LOCAL,
 * portanto ambos sao descartados pelo PostgreSQL no commit/rollback antes de a
 * conexao retornar ao pool.
 */
export async function withTenantDb<T>(
  tenantId: string,
  callback: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  validarTenantId(tenantId);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    await tx.$executeRawUnsafe('SET LOCAL ROLE elyon_tenant_access');
    return callback(tx as TenantTransaction);
  });
}

/**
 * Escape hatch explicito para operacoes administrativas. O pedido de acesso e
 * persistido antes da operacao para que tentativas que falhem tambem sejam
 * auditaveis. O callback continua limitado a uma transacao.
 */
export async function withTenantAdminDb<T>(
  contexto: TenantAdminContext,
  callback: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  validarContextoAdmin(contexto);

  await prisma.logAuditoria.create({
    data: {
      tenantId: contexto.tenantId,
      acao: 'RLS_ADMIN_ACCESS',
      entidade: 'TenantData',
      detalhes: {
        actor: contexto.actor,
        reason: contexto.reason,
      },
    },
  });

  return prisma.$transaction(async (tx) => callback(tx as TenantTransaction));
}
