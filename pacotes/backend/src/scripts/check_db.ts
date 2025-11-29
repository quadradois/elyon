
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.mensagemConversa.count();
    console.log(`Total de mensagens no banco: ${count}`);

    const leads = await prisma.lead.findMany({
      include: {
        conversas: {
          include: {
            mensagens: true
          }
        }
      }
    });

    console.log('Leads com mensagens:');
    leads.forEach(lead => {
      const msgCount = lead.conversas.reduce((acc, conv) => acc + conv.mensagens.length, 0);
      if (msgCount > 0) {
        console.log(`- ${lead.nome} (${lead.telefone}): ${msgCount} mensagens`);
      }
    });

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
