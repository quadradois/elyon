import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Deletar o lead que foi criado
const leadId = '7ec684a5-6240-465f-893c-18b3aaef200e';

// Primeiro deletar mensagens do lead
await prisma.mensagem.deleteMany({
  where: { leadId }
});

// Depois deletar o lead
await prisma.lead.delete({
  where: { id: leadId }
}).catch(e => console.log('Lead ja foi deletado ou nao existe'));

console.log('Lead e mensagens deletados!');

// Verificar contagem
const leads = await prisma.lead.count();
const contatos = await prisma.contato.count({
  where: { campanhaId: 'bcac5ba9-3389-425c-a193-45ab5daebce9' }
});

console.log('Total leads no sistema:', leads);
console.log('Total contatos na campanha:', contatos);

await prisma.$disconnect();
