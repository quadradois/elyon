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
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
