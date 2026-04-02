import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const c = await prisma.contato.findFirst({ where: { telefone: { contains: '993715693' } } });
console.log(JSON.stringify(c, null, 2));
await prisma.$disconnect();
