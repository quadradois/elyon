import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verificar() {
  console.log('--- Verificando Banco de Dados ---');

  const ultimosLeads = await prisma.lead.findMany({
    take: 5,
    orderBy: { criadoEm: 'desc' }
  });

  console.log(`\nÚltimos 5 Leads criados:`);
  for (const lead of ultimosLeads) {
    console.log(`- [${lead.status}] ${lead.nome} (CPF: ${lead.cpf}) - Origem: ${lead.origem}`);
    
    // Buscar imóveis separadamente
    const imoveis = await prisma.imovel.findMany({
      where: { leadId: lead.id }
    });
    
    console.log(`  Imóveis associados: ${imoveis.length}`);
    imoveis.forEach(imovel => {
      console.log(`    > ${imovel.inscricaoIptu} - ${imovel.nomeEdificio || 'Sem Edifício'}`);
    });
  }

  const imoveisIdentificados = await prisma.imovel.count({
    where: { statusCaptacao: 'IDENTIFICADO' }
  });

  console.log(`\nTotal de Imóveis com status IDENTIFICADO: ${imoveisIdentificados}`);
}

verificar()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
