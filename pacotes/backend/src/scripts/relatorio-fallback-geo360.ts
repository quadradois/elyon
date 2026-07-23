import { prisma } from '../lib/db';

function obterLimite(): number {
  const valor = Number(process.argv[2] || 100);
  if (!Number.isInteger(valor)) return 100;
  return Math.min(Math.max(valor, 1), 1000);
}

async function main(): Promise<void> {
  const limite = obterLimite();
  const [totalTermosPendentes, agregado, itens] = await Promise.all([
    prisma.geo360BuscaFallback.count({
      where: { status: 'PENDENTE' }
    }),
    prisma.geo360BuscaFallback.aggregate({
      where: { status: 'PENDENTE' },
      _sum: { ocorrencias: true }
    }),
    prisma.geo360BuscaFallback.findMany({
      where: { status: 'PENDENTE' },
      orderBy: [
        { ocorrencias: 'desc' },
        { ultimoEm: 'desc' }
      ],
      take: limite,
      select: {
        id: true,
        termoNormalizado: true,
        resultadosLegado: true,
        ocorrencias: true,
        primeiroEm: true,
        ultimoEm: true,
        status: true
      }
    })
  ]);

  console.log(JSON.stringify({
    geradoEm: new Date().toISOString(),
    totalTermosPendentes,
    totalOcorrenciasPendentes: agregado._sum.ocorrencias || 0,
    limite,
    itens
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[GEO360] Falha ao gerar relatório de fallback:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
