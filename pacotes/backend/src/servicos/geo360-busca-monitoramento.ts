import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';

interface ResultadoLegadoMonitorado {
  codigo: number;
  nome: string;
  logradouro: string;
  totalUnidades?: number;
}

export function normalizarTermoMonitoramento(termo: string): string | null {
  const normalizado = termo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^\p{L}\p{N}\s&'()./-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  const quantidadeLetras = (normalizado.match(/\p{L}/gu) || []).length;
  if (quantidadeLetras < 2 || /\d{6,}/.test(normalizado)) {
    return null;
  }

  return normalizado;
}

export async function registrarBuscaFallbackLegado(
  termo: string,
  resultados: ResultadoLegadoMonitorado[]
): Promise<void> {
  const termoNormalizado = normalizarTermoMonitoramento(termo);
  if (!termoNormalizado || resultados.length === 0) return;

  const termoHash = createHash('sha256').update(termoNormalizado).digest('hex');
  const resultadosLegado = resultados.slice(0, 20).map((resultado) => ({
    codigo: resultado.codigo,
    nome: resultado.nome,
    logradouro: resultado.logradouro,
    totalUnidades: resultado.totalUnidades || null
  })) as Prisma.InputJsonValue;

  try {
    await prisma.geo360BuscaFallback.upsert({
      where: { termoHash },
      create: {
        termoHash,
        termoNormalizado,
        resultadosLegado
      },
      update: {
        resultadosLegado,
        ocorrencias: { increment: 1 },
        ultimoEm: new Date(),
        status: 'PENDENTE',
        resolvidoEm: null
      }
    });
  } catch (error) {
    // Observabilidade nunca pode impedir a busca principal.
    console.error('[GEO360] Falha ao registrar busca atendida pelo legado:', error);
  }
}
