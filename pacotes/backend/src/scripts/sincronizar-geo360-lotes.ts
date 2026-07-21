import 'dotenv/config';
import { prisma } from '../lib/db';
import { sincronizarLotesGeo360 } from '../servicos/geo360-lotes';
import type { CidadeGeo360 } from '../servicos/geo360-client';

function valor(nome: string) {
  const arg = process.argv.slice(2).find((item) => item.startsWith(`--${nome}=`));
  return arg?.slice(nome.length + 3);
}

async function main() {
  const cidade = (valor('cidade') || 'goiania') as CidadeGeo360;
  if (!['goiania', 'aparecidadegoiania'].includes(cidade)) {
    throw new Error('Use --cidade=goiania ou --cidade=aparecidadegoiania');
  }
  const idLote = valor('id-lote');
  const deadlineMinutos = Number(valor('deadline-minutos') || 0);
  const incluirMidias = process.argv.includes('--com-midias')
    ? true
    : process.argv.includes('--sem-midias')
      ? false
      : cidade === 'goiania';
  const resultado = await sincronizarLotesGeo360({
    cidade,
    idLotes: idLote ? idLote.split(',').map(Number).filter(Number.isSafeInteger) : undefined,
    somenteMultiplasUnidades: !process.argv.includes('--todos-os-lotes'),
    incluirMidias,
    limite: Number(valor('limite') || 1000),
    concorrencia: Number(valor('concorrencia') || 3),
    pausaMs: Number(valor('pausa-ms') || 250),
    deadlineMs: deadlineMinutos ? Date.now() + deadlineMinutos * 60_000 : undefined,
  });
  console.log(JSON.stringify(resultado));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
