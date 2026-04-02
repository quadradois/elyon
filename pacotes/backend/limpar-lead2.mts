import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const leadId = '7ec684a5-6240-465f-893c-18b3aaef200e';

// Buscar conversas do lead primeiro
const lead = await prisma.lead.findUnique({
  where: { id: leadId },
  include: { conversa: true }
});

if (lead) {
  console.log('Lead encontrado:', lead.nome);
  
  // Deletar conversa e mensagens
  if (lead.conversa) {
    await prisma.mensagem.deleteMany({ where: { conversaId: lead.conversa.id } });
    await prisma.conversa.delete({ where: { id: lead.conversa.id } });
  }
  
  // Deletar o lead
  await prisma.lead.delete({ where: { id: leadId } });
  console.log('Lead deletado!');
} else {
  console.log('Lead nao encontrado');
}

await prisma.$disconnect();
