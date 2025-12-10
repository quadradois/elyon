// Semeadura de Pacotes de Recarga
// Execute: npx tsx prisma/semeadura-pacotes.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function semearPacotes() {
  console.log('🌱 Semeando pacotes de recarga...');

  const pacotes = [
    {
      nome: 'Recarga 50',
      slug: 'recarga-50',
      creditos: 50,
      valor: 120.00,
      descricao: '50 créditos para consultas CPF'
    },
    {
      nome: 'Recarga 100',
      slug: 'recarga-100',
      creditos: 100,
      valor: 220.00,
      descricao: '100 créditos para consultas CPF - Mais popular!'
    },
    {
      nome: 'Recarga 250',
      slug: 'recarga-250',
      creditos: 250,
      valor: 500.00,
      descricao: '250 créditos para consultas CPF - Melhor custo-benefício!'
    }
  ];

  for (const pacote of pacotes) {
    await prisma.pacote.upsert({
      where: { slug: pacote.slug },
      update: pacote,
      create: pacote
    });
    console.log(`  ✅ Pacote "${pacote.nome}" criado/atualizado`);
  }

  console.log('\n🎉 Semeadura de pacotes concluída!');
}

semearPacotes()
  .catch(error => {
    console.error('❌ Erro na semeadura:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
