const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Conectando ao banco...');
    const tenant = await prisma.tenant.findFirst();
    console.log('Tenant encontrado:', tenant);
    
    if (!tenant) {
      console.log('Criando tenant demo...');
      await prisma.tenant.create({
        data: {
          nome: 'Imobiliária Demo',
          slug: 'demo',
          status: 'ATIVO'
        }
      });
      console.log('Tenant criado com sucesso!');
    }
  } catch (e) {
    console.error('Erro:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
