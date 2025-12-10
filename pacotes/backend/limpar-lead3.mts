import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const leadId = '7ec684a5-6240-465f-893c-18b3aaef200e';

// Buscar lead com conversas
const lead = await prisma.lead.findUnique({
  where: { id: leadId },
  include: { conversas: true }
});

if (lead) {
  console.log('Lead encontrado:', lead.nome);
  
  // Deletar mensagens e conversas
  for (const conversa of lead.conversas) {
    await prisma.mensagem.deleteMany({ where: { conversaId: conversa.id } });
    await prisma.conversa.delete({ where: { id: conversa.id } });
  }
  
  // Deletar atividades do lead
  await prisma.atividade.deleteMany({ where: { leadId: leadId } });
  
  // Deletar o lead
  await prisma.lead.delete({ where: { id: leadId } });
  console.log('Lead deletado com sucesso!');
} else {
  console.log('Lead nao encontrado');
}

// Contar leads restantes
const totalLeads = await prisma.lead.count();
console.log('Total de leads no sistema:', totalLeads);

await prisma.$disconnect();
