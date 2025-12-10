import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n📋 VERIFICANDO LISTAS NO BANCO\n');
  
  // Verificar tenant
  const tenants = await prisma.tenant.findMany({ select: { id: true, nome: true } });
  console.log('Tenants no sistema:', tenants);
  
  // Verificar tenant das listas
  const listasComTenant = await prisma.lista.findMany({ 
    select: { id: true, nome: true, tenantId: true } 
  });
  console.log('\nListas com tenantId:', listasComTenant);
  
  // Contar listas
  const totalListas = await prisma.lista.count();
  console.log(`Total de listas: ${totalListas}`);
  
  // Listar todas
  const listas = await prisma.lista.findMany({
    orderBy: { criadoEm: 'desc' },
    select: {
      id: true,
      nome: true,
      nomeEdificio: true,
      totalContatos: true,
      totalUsados: true,
      criadoEm: true,
    }
  });
  
  if (listas.length > 0) {
    console.log('\nListas encontradas:');
    listas.forEach(l => {
      console.log(`  - ${l.nome} (${l.nomeEdificio}): ${l.totalContatos} contatos, ${l.totalUsados} usados`);
    });
  }
  
  // Verificar campanhas com "buriti"
  console.log('\n📊 CAMPANHAS COM "BURITI":');
  const campanhas = await prisma.campanha.findMany({
    where: {
      OR: [
        { nome: { contains: 'buriti', mode: 'insensitive' } },
        { nomeEmpreendimento: { contains: 'buriti', mode: 'insensitive' } },
      ]
    },
    select: {
      id: true,
      nome: true,
      nomeEmpreendimento: true,
      totalContatos: true,
    }
  });
  
  if (campanhas.length > 0) {
    campanhas.forEach(c => {
      console.log(`  - ${c.nome}: ${c.totalContatos} contatos`);
    });
  } else {
    console.log('  Nenhuma campanha com "buriti" encontrada');
  }
  
  // Verificar contatos de campanha com "buriti"
  console.log('\n👥 CONTATOS EM CAMPANHAS (amostra):');
  const contatos = await prisma.contato.findMany({
    take: 5,
    where: {
      campanha: {
        OR: [
          { nome: { contains: 'buriti', mode: 'insensitive' } },
          { nomeEmpreendimento: { contains: 'buriti', mode: 'insensitive' } },
        ]
      }
    },
    select: {
      nome: true,
      unidade: true,
      campanha: { select: { nome: true } }
    }
  });
  
  contatos.forEach(c => {
    console.log(`  - ${c.nome} (${c.unidade || 'sem unidade'}) - Campanha: ${c.campanha?.nome}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
