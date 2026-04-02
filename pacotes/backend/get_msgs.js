const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const msgs = await prisma.mensagemProspeccao.findMany({
    where: { telefone: { contains: '93715693' } },
    orderBy: { criadoEm: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(msgs, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
