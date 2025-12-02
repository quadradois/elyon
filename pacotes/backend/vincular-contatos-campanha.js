const { PrismaClient } = require('@prisma/client');

async function vincularContatosCampanha() {
  const prisma = new PrismaClient();
  
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  🔗 VINCULAR CONTATOS À CAMPANHA RESERVA BURITI            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // 1. Buscar campanha
    const campanha = await prisma.campanha.findFirst({
      where: { nome: { contains: 'Buriti', mode: 'insensitive' } }
    });
    
    if (!campanha) {
      console.log('❌ Campanha não encontrada');
      return;
    }
    
    console.log(`✅ Campanha encontrada: ${campanha.nome}`);
    console.log(`   ID: ${campanha.id}`);
    console.log(`   Contatos atuais: ${campanha.totalContatos}`);
    
    // 2. Verificar contatos existentes
    const contatosExistentes = await prisma.contato.count({
      where: { campanhaId: campanha.id }
    });
    console.log(`   Contatos na tabela: ${contatosExistentes}`);
    
    // 3. Buscar leads do Reserva Buriti com telefone
    console.log('\n============================================================');
    console.log('BUSCANDO LEADS DO RESERVA BURITI...');
    console.log('============================================================');
    
    const leads = await prisma.lead.findMany({
      where: {
        imoveis: {
          some: {
            nomeEdificio: { contains: 'RESERVA BURITI', mode: 'insensitive' }
          }
        },
        telefone: { not: null }
      },
      include: {
        imoveis: true
      }
    });
    
    console.log(`📊 Leads com telefone encontrados: ${leads.length}`);
    
    // 4. Criar contatos a partir dos leads
    console.log('\n============================================================');
    console.log('CRIANDO CONTATOS NA CAMPANHA...');
    console.log('============================================================');
    
    let criados = 0;
    let jaExistem = 0;
    let erros = 0;
    
    for (const lead of leads) {
      try {
        // Verificar se já existe contato com mesmo CPF ou telefone na campanha
        const existe = await prisma.contato.findFirst({
          where: {
            campanhaId: campanha.id,
            OR: [
              { cpf: lead.cpf },
              { telefone: lead.telefone }
            ]
          }
        });
        
        if (existe) {
          jaExistem++;
          continue;
        }
        
        // Criar contato
        await prisma.contato.create({
          data: {
            campanhaId: campanha.id,
            nome: lead.nome,
            cpf: lead.cpf,
            telefone: lead.telefone,
            email: lead.email,
            inscricaoIptu: lead.imoveis?.[0]?.inscricaoIptu,
            enderecoImovel: lead.imoveis?.[0]?.logradouro?.trim(),
            bairroImovel: lead.imoveis?.[0]?.bairro?.trim(),
            statusProspeccao: 'AGUARDANDO',
            fonteEnriquecimento: 'MINERACAO'
          }
        });
        
        criados++;
        console.log(`   ✅ ${lead.nome} - ${lead.telefone}`);
        
      } catch (err) {
        erros++;
        console.log(`   ❌ Erro ao criar contato ${lead.nome}: ${err.message}`);
      }
    }
    
    // 5. Atualizar contador da campanha
    const totalContatos = await prisma.contato.count({
      where: { campanhaId: campanha.id }
    });
    
    await prisma.campanha.update({
      where: { id: campanha.id },
      data: { totalContatos: totalContatos }
    });
    
    // 6. Resumo
    console.log('\n============================================================');
    console.log('📊 RESUMO');
    console.log('============================================================');
    console.log(`   ✅ Contatos criados: ${criados}`);
    console.log(`   ⚠️  Já existiam: ${jaExistem}`);
    console.log(`   ❌ Erros: ${erros}`);
    console.log(`   📊 Total na campanha: ${totalContatos}`);
    
    console.log('\n✅ Campanha atualizada! Atualize a página para ver os contatos.');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

vincularContatosCampanha();
