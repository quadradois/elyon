import 'dotenv/config';
import { sincronizarGeo360, type CidadeGeo360 } from '../servicos/geo360-sync';
import { prisma } from '../lib/db';

function valor(nome: string) {
  const arg = process.argv.slice(2).find((item) => item.startsWith(`--${nome}=`));
  return arg?.slice(nome.length + 3);
}

async function main() {
  const cidade = (valor('cidade') || 'goiania') as CidadeGeo360;
  if (!['goiania', 'aparecidadegoiania'].includes(cidade)) {
    throw new Error('Use --cidade=goiania ou --cidade=aparecidadegoiania');
  }
  const prefixo = valor('prefixo');
  const deadlineMinutos = Number(valor('deadline-minutos') || 0);
  const resultado = await sincronizarGeo360({
    cidade,
    prefixos: prefixo ? prefixo.split(',').map((item) => item.trim()) : undefined,
    promover: process.argv.includes('--promover'),
    concorrencia: Number(valor('concorrencia') || 10),
    pausaMs: Number(valor('pausa-ms') || 150),
    limiteDetalhes: Number(valor('limite-detalhes') || 0) || undefined,
    deadlineMs: deadlineMinutos ? Date.now() + deadlineMinutos * 60_000 : undefined,
    reutilizarStage: process.argv.includes('--retomar'),
  });
  console.log(JSON.stringify(resultado));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
