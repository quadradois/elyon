const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixUrl() {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { llmProvedor: 'moonshot' }
    });

    if (!tenant) {
      console.log('Tenant não encontrado');
      return;
    }

    console.log(`Atualizando URL para tenant ${tenant.nome}...`);
    console.log(`URL antiga: ${tenant.llmBaseUrl}`);

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        llmBaseUrl: 'https://api.moonshot.ai/v1'
      }
    });

    console.log('URL atualizada para https://api.moonshot.ai/v1');

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUrl();
