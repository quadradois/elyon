import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.configuracaoAgente.deleteMany({});
  console.log('✅ Agentes deletados:', result.count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
