// Script para criar ou verificar usuário SUPER_ADMIN
// Executar: npx tsx scripts/criar-super-admin.ts

import { PrismaClient } from '@prisma/client';
import { hashSenha } from '../src/utilitarios/senha';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando usuários SUPER_ADMIN...\n');
  
  // Listar todos os usuários SUPER_ADMIN
  const superAdmins = await prisma.usuario.findMany({
    where: { papel: 'SUPER_ADMIN' },
    include: { tenant: { select: { nome: true, slug: true } } }
  });
  
  if (superAdmins.length > 0) {
    console.log('✅ Usuários SUPER_ADMIN encontrados:\n');
    superAdmins.forEach(u => {
      console.log(`  📧 ${u.email}`);
      console.log(`     Nome: ${u.nome}`);
      console.log(`     Tenant: ${u.tenant.nome} (${u.tenant.slug})`);
      console.log(`     Ativo: ${u.estaAtivo ? 'Sim' : 'Não'}`);
      console.log('');
    });
  } else {
    console.log('⚠️ Nenhum usuário SUPER_ADMIN encontrado!\n');
  }
  
  // Listar todos os tenants
  console.log('📋 Tenants disponíveis:');
  const tenants = await prisma.tenant.findMany({
    select: { id: true, nome: true, slug: true, status: true }
  });
  
  tenants.forEach(t => {
    console.log(`  - ${t.nome} (slug: ${t.slug}) [${t.status}]`);
  });
  
  // Se não houver SUPER_ADMIN, criar um
  if (superAdmins.length === 0 && tenants.length > 0) {
    console.log('\n🔧 Criando usuário SUPER_ADMIN...\n');
    
    const senhaHash = await hashSenha('admin123');
    
    const novoAdmin = await prisma.usuario.create({
      data: {
        tenantId: tenants[0].id,
        nome: 'Super Admin',
        email: 'admin@elyon.ia.br',
        senha: senhaHash,
        papel: 'SUPER_ADMIN',
        estaAtivo: true
      }
    });
    
    console.log('✅ Usuário SUPER_ADMIN criado!\n');
    console.log(`  📧 Email: admin@quadradois.com.br`);
    console.log(`  🔑 Senha: admin123`);
    console.log(`  ⚠️ TROQUE A SENHA APÓS O PRIMEIRO LOGIN!\n`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
