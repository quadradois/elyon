/**
 * Instância singleton do Prisma Client
 * 
 * Este arquivo existe para evitar dependências circulares.
 * Todos os módulos devem importar o prisma daqui, NÃO do servidor.ts
 */

import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

// Usar globalThis para evitar múltiplas instâncias em desenvolvimento (hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function validarOrigemLead(valorOrigem: unknown): void {
  if (typeof valorOrigem === 'string' && valorOrigem.toUpperCase() === 'WHATSAPP_INBOUND') {
    throw new Error('Origem WHATSAPP_INBOUND bloqueada: use fluxo de Contatos, não Leads.');
  }
}

// ✅ TASK-11: Migrar $use (depreciado) para Prisma Extensions ($extends)
function createPrismaClient() {
  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return baseClient.$extends({
    query: {
      lead: {
        async create({ args, query }) {
          validarOrigemLead(args.data?.origem);
          return query(args);
        },
        async createMany({ args, query }) {
          const data = args.data;
          if (Array.isArray(data)) {
            for (const item of data) {
              validarOrigemLead((item as any)?.origem);
            }
          } else {
            validarOrigemLead((data as any)?.origem);
          }
          return query(args);
        },
        async update({ args, query }) {
          validarOrigemLead((args.data as any)?.origem);
          return query(args);
        },
        async updateMany({ args, query }) {
          validarOrigemLead((args.data as any)?.origem);
          return query(args);
        },
        async upsert({ args, query }) {
          validarOrigemLead((args.create as any)?.origem);
          validarOrigemLead((args.update as any)?.origem);
          return query(args);
        }
      }
    }
  });
}

const prismaBase = globalForPrisma.prisma ?? createPrismaClient();
const prismaContext = new AsyncLocalStorage<Prisma.TransactionClient>();

/** Faz imports existentes de `prisma` participarem da transação fenced. */
export function executarComPrismaContextual<T>(tx: Prisma.TransactionClient, callback: () => Promise<T>): Promise<T> {
  return prismaContext.run(tx, callback);
}

export const prisma = new Proxy(prismaBase, {
  get(target, property, receiver) {
    const contextual = prismaContext.getStore() as any;
    if (contextual && property === '$transaction') {
      return async (arg: unknown) => {
        if (typeof arg !== 'function') throw new Error('FENCED_NESTED_BATCH_TRANSACTION_UNSUPPORTED');
        return (arg as (tx: Prisma.TransactionClient) => Promise<unknown>)(contextual);
      };
    }
    const source = contextual || target;
    const value = Reflect.get(source as object, property, contextual ? source : receiver);
    return typeof value === 'function' ? value.bind(source) : value;
  },
}) as typeof prismaBase;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaBase;
}

export default prisma;
