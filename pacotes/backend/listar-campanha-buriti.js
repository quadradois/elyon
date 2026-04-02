const { PrismaClient } = require('@prisma/client');

async function listarCampanhaReservaBuriti() {
  const prisma = new PrismaClient();
  
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  📊 CAMPANHA RESERVA BURITI - DETALHES                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // 1. Buscar campanha existente
    const campanha = await prisma.campanha.findFirst({
      where: { 
        nome: { contains: 'Buriti', mode: 'insensitive' } 
      },
      include: {
        leads: true,
        tenant: true
      }
    });
    
    if (!campanha) {
      console.log('❌ Campanha não encontrada');
      return;
    }
    
    console.log('============================================================');
    console.log('📋 DADOS DA CAMPANHA');
    console.log('============================================================');
    console.log(`   Nome: ${campanha.nome}`);
    console.log(`   ID: ${campanha.id}`);
    console.log(`   Status: ${campanha.status}`);
    console.log(`   Canal: ${campanha.canal || 'N/A'}`);
    console.log(`   Tipo: ${campanha.tipo || 'N/A'}`);
    console.log(`   Tenant: ${campanha.tenant?.nome || 'N/A'}`);
    console.log(`   Leads vinculados: ${campanha.leads?.length || 0}`);
    console.log(`   Criada em: ${campanha.criadoEm}`);
    
    // 2. Listar leads do edifício com contatos
    console.log('\n============================================================');
    console.log('📞 LEADS DO RESERVA BURITI COM TELEFONE');
    console.log('============================================================');
    
    const leadsComTelefone = await prisma.lead.findMany({
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
      },
      take: 50
    });
    
    console.log(`\n📊 Total com telefone: ${leadsComTelefone.length}\n`);
    
    for (const lead of leadsComTelefone) {
      const telefoneFormatado = lead.telefone?.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      console.log(`   👤 ${lead.nome}`);
      console.log(`      📱 ${telefoneFormatado || lead.telefone}`);
      console.log(`      📧 ${lead.email || 'N/A'}`);
      console.log(`      🏠 ${lead.imoveis?.[0]?.inscricaoIptu || 'N/A'}`);
      console.log('');
    }
    
    // 3. Resumo para WhatsApp
    console.log('============================================================');
    console.log('📱 LISTA PARA CAMPANHA WHATSAPP');
    console.log('============================================================');
    console.log('\nTelefones prontos para disparo:\n');
    
    for (const lead of leadsComTelefone) {
      // Formatar para WhatsApp (55 + DDD + número)
      let tel = lead.telefone?.replace(/\D/g, '');
      if (tel && tel.length === 10) tel = '55' + tel;
      else if (tel && tel.length === 11) tel = '55' + tel;
      
      console.log(`${tel} - ${lead.nome}`);
    }
    
    // 4. Estatísticas
    console.log('\n============================================================');
    console.log('📈 ESTATÍSTICAS');
    console.log('============================================================');
    
    const totalLeadsEdificio = await prisma.lead.count({
      where: {
        imoveis: {
          some: {
            nomeEdificio: { contains: 'RESERVA BURITI', mode: 'insensitive' }
          }
        }
      }
    });
    
    const comTelefone = leadsComTelefone.length;
    const comEmail = await prisma.lead.count({
      where: {
        imoveis: {
          some: {
            nomeEdificio: { contains: 'RESERVA BURITI', mode: 'insensitive' }
          }
        },
        email: { not: null }
      }
    });
    
    console.log(`   📊 Total de leads: ${totalLeadsEdificio}`);
    console.log(`   📱 Com telefone: ${comTelefone} (${((comTelefone/totalLeadsEdificio)*100).toFixed(1)}%)`);
    console.log(`   📧 Com email: ${comEmail} (${((comEmail/totalLeadsEdificio)*100).toFixed(1)}%)`);
    console.log(`\n   ✅ Prontos para campanha WhatsApp: ${comTelefone} contatos`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

listarCampanhaReservaBuriti();
