import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  try {
    const telefone = '5511999998888';
    console.log(`Buscando lead com telefone ${telefone}...`);
    
    const lead = await prisma.lead.findFirst({
      where: { telefone: telefone },
      include: {
        conversas: {
          include: {
            mensagens: true
          }
        }
      }
    });

    if (!lead) {
      console.log('❌ Lead não encontrado.');
      return;
    }

    console.log('✅ Lead encontrado:', lead.nome, lead.id);
    
    if (lead.conversas.length === 0) {
      console.log('❌ Nenhuma conversa encontrada para o lead.');
    } else {
      console.log(`✅ ${lead.conversas.length} conversa(s) encontrada(s).`);
      
      lead.conversas.forEach((c, i) => {
        console.log(`  Conversa ${i + 1} (${c.status}): ${c.mensagens.length} mensagens.`);
        c.mensagens.forEach(m => {
          console.log(`    - [${m.papel}] ${m.conteudo}`);
        });
      });
    }

  } catch (error) {
    console.error('Erro na verificação:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
