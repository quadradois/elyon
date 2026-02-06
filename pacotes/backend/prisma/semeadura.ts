import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando semeadura...');

  // 1. Criar Tenant Quadra Dois (Admin)
  const tenantQuadraDois = await prisma.tenant.upsert({
    where: { slug: 'quadradois' },
    update: {},
    create: {
      nome: 'Quadra Dois Imóveis',
      slug: 'quadradois',
      status: 'ATIVO',
      plano: 'ENTERPRISE',
      precoConsultaCpf: 2.00,
      quotaMensal: 1000
    }
  });

  console.log(`✅ Tenant criado: ${tenantQuadraDois.nome}`);

  // 2. Criar Usuário Admin
  const senhaHash = await bcrypt.hash('admin123', 10); // Senha temporária dev

  const admin = await prisma.usuario.upsert({
    where: {
      tenantId_email: {
        tenantId: tenantQuadraDois.id,
        email: 'admin@elyon.ia.br'
      }
    },
    update: {
      senha: senhaHash // Atualiza senha se já existir
    },
    create: {
      tenantId: tenantQuadraDois.id,
      nome: 'Admin Quadra Dois',
      email: 'admin@quadradois.com.br',
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

  // 4. Criar Configurações LLM padrão para tenants
  // Usando chave do sistema (apiKeyCriptografada = null)
  for (const tenant of [tenantQuadraDois, tenantDemo]) {
    const configLLM = await prisma.configuracaoLLM.upsert({
      where: {
        tenantId_tipoProvider: {
          tenantId: tenant.id,
          tipoProvider: 'ANTHROPIC'
        }
      },
      update: {},
      create: {
        tenantId: tenant.id,
        tipoProvider: 'ANTHROPIC',
        modeloPreferido: 'claude-haiku-4-5-20251001',
        ativo: true,
        priorizacao: 1,
        // apiKeyCriptografada = null significa usar chave do sistema
      }
    });

    console.log(`✅ Config LLM criada para ${tenant.nome}: ${configLLM.tipoProvider} (${configLLM.modeloPreferido})`);
  }

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

