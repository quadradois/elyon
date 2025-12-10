// Script para atualizar usuário SUPER_ADMIN
// Executar uma única vez

import { PrismaClient } from '@prisma/client';
import { hashSenha } from '../src/utilitarios/senha';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Atualizando usuário SUPER_ADMIN...\n');
  
  const novoEmail = 'quadradoisgo@gmail.com';
  const novaSenha = '@Epbaa090384!@#$';
  
  // Buscar o admin atual
  const adminAtual = await prisma.usuario.findFirst({
    where: { papel: 'SUPER_ADMIN' }
  });
  
  if (!adminAtual) {
    console.log('❌ Nenhum usuário SUPER_ADMIN encontrado!');
    return;
  }
  
  console.log(`📧 Email atual: ${adminAtual.email}`);
  console.log(`📧 Novo email: ${novoEmail}\n`);
  
  // Hash da nova senha
  const senhaHash = await hashSenha(novaSenha);
  
  // Atualizar usuário
  await prisma.usuario.update({
    where: { id: adminAtual.id },
    data: {
      email: novoEmail,
      senha: senhaHash
    }
  });
  
  console.log('✅ Usuário SUPER_ADMIN atualizado com sucesso!\n');
  console.log(`  📧 Email: ${novoEmail}`);
  console.log(`  🔑 Senha: (a que você definiu)`);
  console.log(`\n🔐 Use essas credenciais no Admin Dashboard!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
