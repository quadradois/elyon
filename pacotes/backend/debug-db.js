const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const execs = await prisma.atividade.findMany({
    where: { titulo: { startsWith: 'TOOL_EXEC' } },
    orderBy: { criadoEm: 'desc' },
    take: 15
  });
  console.log('=== ÚLTIMAS TOOLS ===');
  execs.forEach(e => console.log(`[${e.criadoEm}] ${e.titulo} => ${e.descricao}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
