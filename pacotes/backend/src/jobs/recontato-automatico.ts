/**
 * Compatibilidade operacional: o cron legado delega ao mesmo claimer duravel
 * usado pelo worker. PostgreSQL e a unica fonte de verdade; nenhum Lead e
 * consultado diretamente por dataRecontato para envio.
 */
import { prisma } from '../lib/db';
import { executarProximoFollowupOutbound } from '../servicos/processador-followups-outbound';

export async function processarRecontatos(): Promise<{ processados: number }> {
  let processados = 0;
  while (await executarProximoFollowupOutbound(`legacy-cron:${process.pid}`)) processados += 1;
  return { processados };
}

if (require.main === module) {
  void processarRecontatos()
    .then(async (result) => { console.log(JSON.stringify(result)); await prisma.$disconnect(); })
    .catch(async () => { process.exitCode = 1; await prisma.$disconnect(); });
}
