const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    console.log("=== CHECK CONHECIMENTO ===");
    // Verifica se "Conhecimento" model existe
    if (prisma.conhecimento) {
        const rag = await prisma.conhecimento.findMany({ 
            where: { 
                conteudo: { contains: '180', mode: 'insensitive' } 
            }
        });
        console.log('Conhecimento entries:', rag);
    } else {
        console.log("Model 'conhecimento' not found in prisma.");
    }
  } catch (e) {
    console.log("Error querying conhecimento", e.message);
  }

  try {
      console.log("\n=== CHECK MENSAGENS ===");
      if (prisma.mensagem) {
        const msgs = await prisma.mensagem.findMany({ 
            where: { 
                texto: { contains: '180', mode: 'insensitive' } 
            },
            take: 5
        });
        console.log('Mensagens:', msgs.map(m => m.texto));
      }
  } catch(e) {
      console.log("Error querying mensagem", e.message);
  }
}
main().catch(console.error).finally(()=>prisma.$disconnect());
