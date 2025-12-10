import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Buscar campanha específica do Buriti com briefing e tenant
  console.log('=== CAMPANHA RESERVA BURITI ===');
  const campanha = await prisma.campanha.findUnique({
    where: { id: 'c02c7518-a067-46f8-b4f1-d89adae6d99f' },
    include: {
      tenant: true,
      empreendimento: true
    }
  });
  
  console.log('Nome:', campanha?.nome);
  console.log('Empreendimento:', campanha?.nomeEmpreendimento);
  console.log('empreendimentoId:', campanha?.empreendimentoId);
  console.log('empreendimento (relação):', campanha?.empreendimento);
  console.log('\n=== TENANT ===');
  console.log('tenantId:', campanha?.tenantId);
  console.log('tenant.nome:', campanha?.tenant?.nome);
  console.log('\n=== BRIEFING ===');
  console.log('briefingCompleto existe?', !!campanha?.briefingCompleto);
  console.log('Tamanho:', campanha?.briefingCompleto?.length || 0, 'chars');
  console.log('Preview:', campanha?.briefingCompleto?.substring(0, 300) || 'VAZIO');

  // 2. Buscar contatos dessa campanha
  console.log('\n=== CONTATOS DA CAMPANHA ===');
  const contatos = await prisma.contato.findMany({
    where: { campanhaId: 'c02c7518-a067-46f8-b4f1-d89adae6d99f' },
    select: {
      id: true,
      nome: true,
      telefone: true,
      statusProspeccao: true
    }
  });
  console.log(JSON.stringify(contatos, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
