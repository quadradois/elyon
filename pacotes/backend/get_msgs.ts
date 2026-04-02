import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const msgs = await prisma.mensagemProspeccao.findMany({
    where: { telefone: '556293715693' },
    orderBy: { criadoEm: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(msgs, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
