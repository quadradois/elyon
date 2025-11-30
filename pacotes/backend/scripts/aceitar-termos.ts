import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const agenteId = process.argv[2] || 'dcda190a-b6fd-424a-9f7f-fe13233bb264';
  
  const agente = await prisma.configuracaoAgente.update({
    where: { id: agenteId },
    data: { 
      termosAceitos: true, 
      termosAceitosEm: new Date(),
      termosVersao: '1.0'
    }
  });
  
  console.log('✅ Termos aceitos para o agente:', agente.nome);
  console.log('   ID:', agente.id);
  console.log('   termosAceitos:', agente.termosAceitos);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
