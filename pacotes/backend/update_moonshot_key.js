const { PrismaClient } = require('@prisma/client');
const { criptografar } = require('./dist/lib/crypto');
const prisma = new PrismaClient();

const NOVA_CHAVE = 'sk-Kp8nQQwMrnyBBnwaDhU4pYxLJ9oZ6TM6Of2OmypzLunJ1oPH';

async function updateKey() {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { llmProvedor: 'moonshot' }
    });

    if (!tenant) {
      console.log('Tenant não encontrado');
      return;
    }

    console.log(`Atualizando chave para tenant ${tenant.nome}...`);
    const chaveCriptografada = criptografar(NOVA_CHAVE);

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        llmApiKeyCriptografada: chaveCriptografada
      }
    });

    console.log('Chave atualizada com sucesso.');

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

updateKey();
