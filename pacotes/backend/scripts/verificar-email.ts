import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contato = await prisma.contato.findFirst({
    where: { nome: { contains: 'MARIA DEUSENI' } },
    select: {
      nome: true,
      email: true,
      email2: true,
      email3: true,
      emailsJson: true
    }
  });
  
  console.log('\n📧 EMAILS DO CONTATO:\n');
  console.log(JSON.stringify(contato, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
