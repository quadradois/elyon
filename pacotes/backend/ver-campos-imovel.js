const { PrismaClient } = require('@prisma/client');

async function verCamposImovel() {
  const prisma = new PrismaClient();
  
  const imovel = await prisma.imovel.findFirst({
    where: { inscricaoIptu: '32313702960151' }
  });
  
  console.log('Imóvel completo:');
  console.log(JSON.stringify(imovel, null, 2));
  
  // Mostrar alguns outros para ver padrão do complemento
  console.log('\n\nOutros imóveis do Reserva Buriti:');
  const outros = await prisma.imovel.findMany({
    where: { nomeEdificio: { contains: 'RESERVA BURITI', mode: 'insensitive' } },
    take: 5
  });
  
  for (const i of outros) {
    console.log(`IPTU: ${i.inscricaoIptu} | Complemento: "${i.complemento}"`);
  }
  
  await prisma.$disconnect();
}

verCamposImovel();
