import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const contato = await prisma.contato.findFirst({
    where: { telefone: { contains: '6293715693' } },
    include: { lead: true }
  });
  console.log(JSON.stringify(contato, null, 2));
}
run().finally(() => prisma.$disconnect());
