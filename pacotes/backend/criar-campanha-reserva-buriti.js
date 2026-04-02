const { PrismaClient } = require('@prisma/client');

async function criarCampanhaReservaBuriti() {
  const prisma = new PrismaClient();
  
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  🏢 CRIAR CAMPANHA - RESERVA BURITI                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // 1. Buscar imóveis do Reserva Buriti
    console.log('============================================================');
    console.log('ETAPA 1: BUSCAR IMÓVEIS DO RESERVA BURITI');
    console.log('============================================================');
    
    const imoveis = await prisma.imovel.findMany({
      where: {
        nomeEdificio: {
          contains: 'RESERVA BURITI',
          mode: 'insensitive'
        }
      },
      include: {
        lead: true
      }
    });
    
    console.log(`📊 Total de imóveis encontrados: ${imoveis.length}`);
    
    if (imoveis.length === 0) {
      // Tentar buscar com nome similar
      const similares = await prisma.imovel.findMany({
        where: {
          nomeEdificio: {
            contains: 'BURITI',
            mode: 'insensitive'
          }
        },
        take: 20
      });
      
      console.log('\n⚠️  Nenhum imóvel com "RESERVA BURITI" encontrado.');
      console.log('   Edifícios similares com "BURITI":');
      
      const edificios = [...new Set(similares.map(i => i.nomeEdificio))];
      for (const ed of edificios) {
        const count = similares.filter(i => i.nomeEdificio === ed).length;
        console.log(`   - ${ed}: ${count} unidades`);
      }
      
      if (edificios.length > 0) {
        console.log(`\n   Usando: ${edificios[0]}`);
        const imoveisEdificio = await prisma.imovel.findMany({
          where: { nomeEdificio: edificios[0] },
          include: { lead: true }
        });
        await processarImoveis(prisma, imoveisEdificio, edificios[0]);
      }
      return;
    }
    
    await processarImoveis(prisma, imoveis, 'RESERVA BURITI');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

async function processarImoveis(prisma, imoveis, nomeEdificio) {
  console.log(`\n   📋 Imóveis de ${nomeEdificio}:`);
  
  // Mostrar alguns exemplos
  for (const imovel of imoveis.slice(0, 5)) {
    console.log(`   - IPTU: ${imovel.inscricaoIptu}`);
    console.log(`     Bairro: ${imovel.bairro}`);
    console.log(`     Lead: ${imovel.lead ? imovel.lead.nome : 'Não vinculado'}`);
    console.log('');
  }
  
  // 2. Buscar leads vinculados
  console.log('============================================================');
  console.log('ETAPA 2: BUSCAR LEADS DO EDIFÍCIO');
  console.log('============================================================');
  
  const leadsVinculados = imoveis.filter(i => i.lead).map(i => i.lead);
  console.log(`📊 Leads já vinculados: ${leadsVinculados.length}`);
  
  // Buscar leads por nome do edifício também
  const leadsDoEdificio = await prisma.lead.findMany({
    where: {
      OR: [
        { imoveis: { some: { nomeEdificio: { contains: nomeEdificio, mode: 'insensitive' } } } },
        { nome: { contains: nomeEdificio, mode: 'insensitive' } }
      ]
    },
    include: {
      imoveis: true
    }
  });
  
  console.log(`📊 Total de leads do edifício: ${leadsDoEdificio.length}`);
  
  if (leadsDoEdificio.length > 0) {
    console.log('\n   📋 Leads encontrados:');
    for (const lead of leadsDoEdificio.slice(0, 10)) {
      console.log(`   - ${lead.nome}`);
      console.log(`     CPF: ${lead.cpf || 'N/A'}`);
      console.log(`     Telefone: ${lead.telefone || 'N/A'}`);
      console.log(`     Email: ${lead.email || 'N/A'}`);
      console.log(`     Imóveis: ${lead.imoveis?.length || 0}`);
      console.log('');
    }
  }
  
  // 3. Verificar tenant padrão
  console.log('============================================================');
  console.log('ETAPA 3: VERIFICAR TENANT');
  console.log('============================================================');
  
  let tenant = await prisma.tenant.findFirst({
    where: { status: 'ATIVO' }
  });
  
  if (!tenant) {
    console.log('⚠️  Nenhum tenant ativo encontrado. Criando tenant padrão...');
    tenant = await prisma.tenant.create({
      data: {
        nome: 'Imobiliária Padrão',
        slug: 'imobiliaria-padrao',
        status: 'ATIVO'
      }
    });
  }
  
  console.log(`✅ Tenant: ${tenant.nome} (${tenant.id})`);
  
  // 4. Criar campanha
  console.log('\n============================================================');
  console.log('ETAPA 4: CRIAR CAMPANHA');
  console.log('============================================================');
  
  const nomeCampanha = `Captação ${nomeEdificio} - ${new Date().toLocaleDateString('pt-BR')}`;
  
  // Verificar se já existe
  const campanhaExistente = await prisma.campanha.findFirst({
    where: { nome: { contains: nomeEdificio, mode: 'insensitive' } }
  });
  
  if (campanhaExistente) {
    console.log(`⚠️  Campanha já existe: ${campanhaExistente.nome}`);
    console.log(`   ID: ${campanhaExistente.id}`);
    console.log(`   Status: ${campanhaExistente.status}`);
    console.log(`   Leads: ${campanhaExistente.totalLeads || 0}`);
    return campanhaExistente;
  }
  
  // Criar nova campanha
  const campanha = await prisma.campanha.create({
    data: {
      tenantId: tenant.id,
      nome: nomeCampanha,
      tipo: 'CAPTACAO_PROPRIETARIOS',
      status: 'RASCUNHO',
      canal: 'WHATSAPP',
      mensagemModelo: `Olá {nome}! 👋

Sou da *Elyon Imóveis* e estou entrando em contato pois identificamos que você é proprietário de um imóvel no *${nomeEdificio}*.

Temos compradores interessados nessa região e gostaríamos de saber se você tem interesse em vender ou alugar seu imóvel.

Podemos conversar? 🏠`,
      totalLeads: leadsDoEdificio.length
    }
  });
  
  console.log(`✅ Campanha criada: ${campanha.nome}`);
  console.log(`   ID: ${campanha.id}`);
  console.log(`   Status: ${campanha.status}`);
  console.log(`   Canal: ${campanha.canal}`);
  console.log(`   Total leads: ${campanha.totalLeads}`);
  
  // 5. Vincular leads à campanha
  console.log('\n============================================================');
  console.log('ETAPA 5: VINCULAR LEADS À CAMPANHA');
  console.log('============================================================');
  
  // Atualizar leads para vincular à campanha
  const leadsAtualizados = await prisma.lead.updateMany({
    where: {
      id: { in: leadsDoEdificio.map(l => l.id) }
    },
    data: {
      campanhaOrigemId: campanha.id
    }
  });
  
  console.log(`✅ ${leadsAtualizados.count} leads vinculados à campanha`);
  
  // Resumo final
  console.log('\n============================================================');
  console.log('📊 RESUMO DA CAMPANHA');
  console.log('============================================================');
  console.log(`   🏢 Edifício: ${nomeEdificio}`);
  console.log(`   📋 Campanha: ${campanha.nome}`);
  console.log(`   🎯 Leads: ${leadsDoEdificio.length}`);
  console.log(`   📱 Canal: WhatsApp`);
  console.log(`   📝 Status: ${campanha.status}`);
  console.log('\n   📞 Contatos para disparo:');
  
  for (const lead of leadsDoEdificio.filter(l => l.telefone).slice(0, 10)) {
    console.log(`   - ${lead.nome}: ${lead.telefone}`);
  }
  
  console.log('\n✅ Campanha pronta para ativação!');
  console.log('   Próximo passo: Ativar campanha e iniciar disparos');
  
  return campanha;
}

criarCampanhaReservaBuriti();
