const { PrismaClient } = require('@prisma/client');

async function verificarCache() {
  const prisma = new PrismaClient();
  
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     📦 VERIFICAÇÃO DE CACHE - MINERAÇÃO ELYON              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // 1. Cache de CPF
    console.log('============================================================');
    console.log('1️⃣  CACHE DE CPF (Pesquisas Assertiva)');
    console.log('============================================================');
    
    const totalCacheCpf = await prisma.cacheCpf.count();
    console.log(`📊 Total de registros: ${totalCacheCpf}`);
    
    if (totalCacheCpf > 0) {
      const cachesCpf = await prisma.cacheCpf.findMany({ 
        take: 5,
        orderBy: { buscadoEm: 'desc' }
      });
      
      console.log('\n   Últimas pesquisas:');
      for (const cache of cachesCpf) {
        const dados = cache.dados || {};
        console.log(`   - CPF: ${cache.cpf}`);
        console.log(`     Nome: ${dados.nome || 'N/A'}`);
        console.log(`     Telefones: ${dados.telefones?.length || 0}`);
        console.log(`     Emails: ${dados.emails?.length || 0}`);
        console.log(`     Fonte: ${cache.fonte}`);
        console.log(`     Consultas: ${cache.contagemConsultas}`);
        console.log(`     Buscado em: ${cache.buscadoEm}`);
        console.log('');
      }
      
      // Estatísticas do cache
      const totalConsultas = await prisma.consultaCpf.count();
      const consultasCache = await prisma.consultaCpf.count({ where: { veioDoCache: true } });
      const consultasNovas = totalConsultas - consultasCache;
      
      console.log('   📈 Estatísticas de Consultas:');
      console.log(`   - Total de consultas: ${totalConsultas}`);
      console.log(`   - Vindas do cache (economia): ${consultasCache}`);
      console.log(`   - Consultas novas (API): ${consultasNovas}`);
      if (totalConsultas > 0) {
        console.log(`   - Taxa de cache hit: ${((consultasCache/totalConsultas)*100).toFixed(1)}%`);
      }
    } else {
      console.log('   ⚠️  Nenhum CPF em cache ainda');
    }
    
    // 2. Cache de Imóveis
    console.log('\n============================================================');
    console.log('2️⃣  CACHE DE IMÓVEIS');
    console.log('============================================================');
    
    const totalImoveis = await prisma.imovel.count();
    console.log(`📊 Total de imóveis: ${totalImoveis}`);
    
    if (totalImoveis > 0) {
      const imoveis = await prisma.imovel.findMany({ 
        take: 5,
        orderBy: { criadoEm: 'desc' }
      });
      
      console.log('\n   Últimos imóveis cadastrados:');
      for (const imovel of imoveis) {
        console.log(`   - IPTU: ${imovel.inscricaoIptu}`);
        console.log(`     Edifício: ${imovel.nomeEdificio || 'N/A'}`);
        console.log(`     Bairro: ${imovel.bairro || 'N/A'}`);
        console.log(`     Status: ${imovel.statusCaptacao}`);
        console.log(`     Lead vinculado: ${imovel.leadId ? 'Sim' : 'Não'}`);
        console.log('');
      }
      
      // Estatísticas
      const comLead = await prisma.imovel.count({ where: { leadId: { not: null } } });
      const porStatus = await prisma.imovel.groupBy({
        by: ['statusCaptacao'],
        _count: { id: true }
      });
      
      console.log('   📈 Estatísticas:');
      console.log(`   - Com lead vinculado: ${comLead} (${((comLead/totalImoveis)*100).toFixed(1)}%)`);
      console.log('   - Por status:');
      for (const s of porStatus) {
        console.log(`     • ${s.statusCaptacao}: ${s._count.id}`);
      };
    } else {
      console.log('   ⚠️  Nenhum imóvel em cache ainda');
    }
    
    // 3. Contatos
    console.log('\n============================================================');
    console.log('3️⃣  CONTATOS MINERADOS');
    console.log('============================================================');
    
    const totalContatos = await prisma.contato.count();
    console.log(`📊 Total de contatos: ${totalContatos}`);
    
    if (totalContatos > 0) {
      const contatos = await prisma.contato.findMany({ 
        take: 5,
        orderBy: { criadoEm: 'desc' }
      });
      
      console.log('\n   Últimos contatos:');
      for (const contato of contatos) {
        console.log(`   - Nome: ${contato.nome}`);
        console.log(`     CPF: ${contato.cpf || 'N/A'}`);
        console.log(`     Telefone: ${contato.telefone || 'N/A'}`);
        console.log(`     Email: ${contato.email || 'N/A'}`);
        console.log('');
      }
    } else {
      console.log('   ⚠️  Nenhum contato minerado ainda');
    }
    
    // 4. Leads
    console.log('\n============================================================');
    console.log('4️⃣  LEADS GERADOS');
    console.log('============================================================');
    
    const totalLeads = await prisma.lead.count();
    console.log(`📊 Total de leads: ${totalLeads}`);
    
    if (totalLeads > 0) {
      const leads = await prisma.lead.findMany({ 
        take: 5,
        orderBy: { criadoEm: 'desc' },
        include: { contatoOrigem: true, imoveis: true }
      });
      
      console.log('\n   Últimos leads:');
      for (const lead of leads) {
        console.log(`   - Nome: ${lead.nome}`);
        console.log(`     CPF: ${lead.cpf || 'N/A'}`);
        console.log(`     Telefone: ${lead.telefone || 'N/A'}`);
        console.log(`     Email: ${lead.email || 'N/A'}`);
        console.log(`     Status: ${lead.status}`);
        console.log(`     Imóveis: ${lead.imoveis?.length || 0}`);
        console.log('');
      }
      
      // Por status
      const porStatus = await prisma.lead.groupBy({
        by: ['status'],
        _count: { id: true }
      });
      
      console.log('   📈 Por status:');
      for (const s of porStatus) {
        console.log(`   - ${s.status}: ${s._count.id}`);
      }
    } else {
      console.log('   ⚠️  Nenhum lead gerado ainda');
    }
    
    // Resumo
    console.log('\n============================================================');
    console.log('📊 RESUMO GERAL');
    console.log('============================================================');
    console.log(`   📦 Cache CPF: ${totalCacheCpf} registros`);
    console.log(`   🏠 Imóveis: ${totalImoveis} registros`);
    console.log(`   👤 Contatos: ${totalContatos} registros`);
    console.log(`   🎯 Leads: ${totalLeads} registros`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verificarCache();
