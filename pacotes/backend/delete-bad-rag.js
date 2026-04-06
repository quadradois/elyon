const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
      console.log('=== LIMPANDO RAG DE EXCLUSIVIDADE LEGADA ===');
      
      const badChunks = await prisma.conversaEmbedding.findMany({
        where: {
          OR: [
            { textoOriginal: { contains: 'dois modelos', mode: 'insensitive' } },
            { textoOriginal: { contains: '180 dias', mode: 'insensitive' } },
            { textoOriginal: { contains: 'Exclusiva (180', mode: 'insensitive' } }
          ]
        }
      });
    
      console.log(`🔍 Encontrados ${badChunks.length} chunks contaminados.`);
      
      if (badChunks.length > 0) {
        badChunks.forEach(c => console.log('  -> Deletando:', c.textoOriginal.substring(0, 80)));
        
        const ids = badChunks.map(c => c.id);
        const result = await prisma.conversaEmbedding.deleteMany({
          where: {
            id: { in: ids }
          }
        });
        console.log(`✅ Deletados ${result.count} chunks com sucesso do Vector DB.`);
      } else {
        console.log('Nenhum chunk legado encontrado. O RAG já está limpo!');
      }
  } catch(e) {
      console.error('Erro na limpeza:', e.message);
  }
}
main().finally(() => prisma.$disconnect());
