const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== CHECKING TENANT TEXTS ===');
  const tenants = await prisma.tenant.findMany();
  for (const t of tenants) {
    if (JSON.stringify(t).includes('180') || JSON.stringify(t).includes('Simples')) {
      console.log('Found in Tenant:', t.nome);
      console.log('Configuracoes:', t.diferenciais, t.observacoesGerais);
    }
  }

  console.log('=== CHECKING CAMPANHA TEXTS ===');
  const campanhas = await prisma.campanha.findMany();
  for (const c of campanhas) {
    if (JSON.stringify(c).includes('180') || JSON.stringify(c).includes('Simples')) {
      console.log('Found in Campanha:', c.nome);
      console.log('Mensagem Modelo / Briefing:', c.mensagemModelo, c.empreendimentoId);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
