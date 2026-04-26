import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando semeadura...');

  // 1. Criar Tenant Elyon (Admin)
  const tenantElyon = await prisma.tenant.upsert({
    where: { slug: 'elyon' },
    update: {},
    create: {
      nome: 'ELYON Imóveis',
      slug: 'elyon',
      status: 'ATIVO',
      plano: 'ENTERPRISE',
      precoConsultaCpf: 2.00,
      quotaMensal: 1000
    }
  });

  console.log(`✅ Tenant criado: ${tenantElyon.nome}`);

  // 2. Criar Usuário Admin
  const senhaHash = await bcrypt.hash('admin123', 10); // Senha temporária dev

  const admin = await prisma.usuario.upsert({
    where: {
        tenantId_email: {
        tenantId: tenantElyon.id,
        email: 'admin@elyon.ia.br'
      }
    },
    update: {
      senha: senhaHash // Atualiza senha se já existir
    },
    create: {
      tenantId: tenantElyon.id,
      nome: 'Admin Elyon',
      email: 'admin@elyon.ia.br',
      senha: senhaHash,
      papel: 'SUPER_ADMIN',
      estaAtivo: true
    }
  });

  console.log(`✅ Usuário Admin criado: ${admin.email}`);

  // 3. Criar Tenant Demo
  const tenantDemo = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      nome: 'Imobiliária Demo',
      slug: 'demo',
      status: 'ATIVO',
      plano: 'SMALL_BUSINESS'
    }
  });

  console.log(`✅ Tenant Demo criado: ${tenantDemo.nome}`);
  
  console.log('🌱 Semeadura concluída!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
