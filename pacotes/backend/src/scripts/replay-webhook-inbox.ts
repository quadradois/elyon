import 'dotenv/config';
import os from 'os';
import { prisma } from '../lib/db';

function argumento(nome: string): string | undefined {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1]?.trim() : undefined;
}

async function executar(): Promise<void> {
  const id = argumento('--id');
  const motivo = argumento('--reason');
  const ator = argumento('--actor') || `${os.userInfo().username}@${os.hostname()}`;
  if (!id || !motivo || motivo.length < 8) {
    throw new Error('Uso: node dist/scripts/replay-webhook-inbox.js --id <uuid> --reason "motivo auditavel" [--actor <identidade>]');
  }

  const evento = await prisma.webhookEvento.findUnique({
    where: { id },
    select: { status: true, payload: true },
  });
  if (!evento || evento.status !== 'MORTO' || evento.payload === null) {
    throw new Error('Evento nao encontrado, nao esta MORTO ou nao possui payload; nenhuma alteracao realizada.');
  }

  const resultado = await prisma.webhookEvento.updateMany({
    where: { id, status: 'MORTO' },
    data: {
      status: 'PENDENTE',
      tentativas: 0,
      proximaTentativaEm: new Date(),
      leaseAte: null,
      leaseOwner: null,
      ultimoErro: null,
      replayCount: { increment: 1 },
      ultimoReplayEm: new Date(),
      ultimoReplayPor: ator.slice(0, 255),
      ultimoReplayMotivo: motivo.slice(0, 2_000),
    },
  });

  if (resultado.count !== 1) {
    throw new Error('Evento nao encontrado, nao esta MORTO ou nao possui payload; nenhuma alteracao realizada.');
  }
  console.log(JSON.stringify({ sucesso: true, id, ator }));
}

executar()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
