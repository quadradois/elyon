// Script temporário para limpar campanhas
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function limparCampanhas() {
  try {
    const resultado = await prisma.campanha.deleteMany({});
    
    console.log(`✅ ${resultado.count} campanhas deletadas com sucesso!`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Erro ao deletar campanhas:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

limparCampanhas();
