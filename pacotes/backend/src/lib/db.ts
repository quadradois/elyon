/**
 * Instância singleton do Prisma Client
 * 
 * Este arquivo existe para evitar dependências circulares.
 * Todos os módulos devem importar o prisma daqui, NÃO do servidor.ts
 */

import { PrismaClient } from '@prisma/client';

// Usar globalThis para evitar múltiplas instâncias em desenvolvimento (hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaLeadGuardConfigured: boolean | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

function validarOrigemLead(valorOrigem: unknown): void {
  if (typeof valorOrigem === 'string' && valorOrigem.toUpperCase() === 'WHATSAPP_INBOUND') {
    throw new Error('Origem WHATSAPP_INBOUND bloqueada: use fluxo de Contatos, não Leads.');
  }
}

if (!globalForPrisma.prismaLeadGuardConfigured) {
  prisma.$use(async (params, next) => {
    const isLeadModel = params.model === 'Lead';

    if (isLeadModel && params.action === 'create') {
      validarOrigemLead(params.args?.data?.origem);
    }

    if (isLeadModel && params.action === 'createMany') {
      const data = params.args?.data;
      if (Array.isArray(data)) {
        for (const item of data) {
          validarOrigemLead(item?.origem);
        }
      } else {
        validarOrigemLead(data?.origem);
      }
    }

    if (isLeadModel && (params.action === 'update' || params.action === 'updateMany')) {
      validarOrigemLead(params.args?.data?.origem);
    }

    if (isLeadModel && params.action === 'upsert') {
      validarOrigemLead(params.args?.create?.origem);
      validarOrigemLead(params.args?.update?.origem);
    }

    return next(params);
  });

  globalForPrisma.prismaLeadGuardConfigured = true;
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
