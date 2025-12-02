const { PrismaClient } = require('@prisma/client');

async function buscarProprietario() {
  const prisma = new PrismaClient();
  
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  🔍 BUSCAR PROPRIETÁRIO - EDIVALDO YUKISHIQUE HASHIMOTO    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // 1. Buscar o Lead
    const lead = await prisma.lead.findFirst({
      where: {
        nome: { contains: 'EDIVALDO', mode: 'insensitive' }
      },
      include: {
        imoveis: true
      }
    });
    
    if (lead) {
      console.log('📋 DADOS DO LEAD:');
      console.log('============================================================');
      console.log(`   Nome: ${lead.nome}`);
      console.log(`   CPF: ${lead.cpf}`);
      console.log(`   Telefone: ${lead.telefone}`);
      console.log(`   Email: ${lead.email}`);
      console.log(`   Status: ${lead.status}`);
      console.log('');
      
      console.log('🏠 IMÓVEIS VINCULADOS:');
      console.log('============================================================');
      for (const imovel of lead.imoveis) {
        console.log(`   📍 IPTU: ${imovel.inscricaoIptu}`);
        console.log(`      Edifício: ${imovel.nomeEdificio?.trim()}`);
        console.log(`      Logradouro: ${imovel.logradouro?.trim()}`);
        console.log(`      Complemento: ${imovel.complemento?.trim() || 'N/A'}`);
        console.log(`      Bairro: ${imovel.bairro?.trim()}`);
        console.log(`      Quadra/Lote: ${imovel.quadra || 'N/A'} / ${imovel.lote || 'N/A'}`);
        console.log('');
      }
    }
    
    // 2. Buscar diretamente nos imóveis
    console.log('🔎 BUSCA DIRETA NA TABELA IMÓVEIS:');
    console.log('============================================================');
    
    const imoveis = await prisma.imovel.findMany({
      where: {
        lead: {
          nome: { contains: 'EDIVALDO', mode: 'insensitive' }
        }
      }
    });
    
    if (imoveis.length > 0) {
      for (const imovel of imoveis) {
        console.log(`   📍 IPTU: ${imovel.inscricaoIptu}`);
        console.log(`      Edifício: ${imovel.nomeEdificio?.trim()}`);
        console.log(`      Complemento: ${imovel.complemento?.trim() || 'N/A'}`);
        console.log('');
      }
    }
    
    // 3. Buscar o contato na campanha
    console.log('📞 DADOS DO CONTATO NA CAMPANHA:');
    console.log('============================================================');
    
    const contato = await prisma.contato.findFirst({
      where: {
        nome: { contains: 'EDIVALDO', mode: 'insensitive' }
      },
      include: {
        campanha: true
      }
    });
    
    if (contato) {
      console.log(`   Nome: ${contato.nome}`);
      console.log(`   CPF: ${contato.cpf}`);
      console.log(`   Telefone: ${contato.telefone}`);
      console.log(`   Email: ${contato.email}`);
      console.log(`   IPTU: ${contato.inscricaoIptu}`);
      console.log(`   Endereço Imóvel: ${contato.enderecoImovel?.trim()}`);
      console.log(`   Bairro Imóvel: ${contato.bairroImovel?.trim()}`);
      console.log(`   Campanha: ${contato.campanha?.nome}`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

buscarProprietario();
