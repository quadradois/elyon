import type { Prisma } from '@prisma/client';
import { executarComPrismaContextual, prisma } from '../lib/db';

export interface FenceComando {
  loteId: string;
  owner: string;
  fencingToken: number;
}

export async function executarComandoFenced<T>(fence: FenceComando, comando: () => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const [lote] = await tx.$queryRaw<Array<{ valido: boolean }>>`
      SELECT (status = 'PROCESSANDO'
        AND "leaseOwner" = ${fence.owner}
        AND "fencingToken" = ${fence.fencingToken}
        AND "leaseAte" > clock_timestamp()) AS valido
      FROM lotes_mensagens_inbound
      WHERE id = ${fence.loteId}
      FOR UPDATE
    `;
    if (!lote?.valido) throw new Error('LOTE_LEASE_PERDIDO');

    const resultado = await executarComPrismaContextual(tx as unknown as Prisma.TransactionClient, comando);
    const [final] = await tx.$queryRaw<Array<{ valido: boolean }>>`
      SELECT (status = 'PROCESSANDO'
        AND "leaseOwner" = ${fence.owner}
        AND "fencingToken" = ${fence.fencingToken}
        AND "leaseAte" > clock_timestamp()) AS valido
      FROM lotes_mensagens_inbound
      WHERE id = ${fence.loteId}
    `;
    if (!final?.valido) throw new Error('LOTE_LEASE_PERDIDO');
    return resultado;
  }, { isolationLevel: 'Serializable', timeout: 30_000, maxWait: 10_000 });
}

export type PrismaFencedTransaction = Prisma.TransactionClient;
