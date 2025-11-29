import { prisma } from '../src/servidor';
import { ragEmpreendimentos } from '../src/servicos/rag-empreendimentos';

async function testeRAGGlobal() {
  console.log('🚀 Iniciando Teste de RAG Global...\n');

  try {
    // 1. Limpar dados de teste anteriores
    console.log('🧹 Limpando dados de teste...');
    await prisma.empreendimentoConhecimento.deleteMany({
      where: { nome: 'Edifício Teste Global' }
    });

    // 2. Criar Tenants de Teste
    console.log('🏢 Criando/Buscando Tenants de Teste...');
    const tenantA = await prisma.tenant.upsert({
      where: { slug: 'imobiliaria-a' },
      update: {},
      create: { nome: 'Imobiliária A', slug: 'imobiliaria-a' }
    });
    
    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'imobiliaria-b' },
      update: {},
      create: { nome: 'Imobiliária B', slug: 'imobiliaria-b' }
    });

    console.log(`   Tenant A: ${tenantA.id}`);
    console.log(`   Tenant B: ${tenantB.id}\n`);

    // 3. Tenant A cria conhecimento (Simulando pesquisa)
    console.log('📝 Tenant A pesquisando "Edifício Teste Global"...');
    
    const briefingSimulado = {
      resumo_sdr: "Edifício de alto padrão com vista para o mar.",
      caracteristicas: ["Piscina", "Academia", "3 Quartos"],
      confiabilidade: 0.95
    };

    const conhecimento = await ragEmpreendimentos.salvar({
      nome: 'Edifício Teste Global',
      localizacao: 'Av. Atlântica, 1000',
      tipo: 'Apartamento',
      briefing: briefingSimulado,
      tenantId: tenantA.id // Tenant A contribuiu
    });

    console.log('✅ Conhecimento salvo pelo Tenant A!');
    console.log(`   ID: ${conhecimento.id}`);
    console.log(`   Tenant Owner: ${conhecimento.tenantId}\n`);

    // 4. Tenant B busca o mesmo empreendimento
    console.log('🔍 Tenant B buscando "Edifício Teste Global"...');
    
    // Busca por nome exato (deve achar mesmo sendo outro tenant)
    const encontradoPorNome = await ragEmpreendimentos.buscarPorNome(
      'Edifício Teste Global',
      'Av. Atlântica'
    );

    if (encontradoPorNome) {
      console.log('✅ SUCESSO: Tenant B encontrou o dado cadastrado pelo Tenant A (Busca Exata)!');
    } else {
      console.error('❌ FALHA: Tenant B não encontrou o dado (Busca Exata).');
    }

    // 5. Tenant B faz busca semântica
    console.log('\n🧠 Tenant B fazendo busca semântica ("prédio luxo mar")...');
    const encontradoSemantico = await ragEmpreendimentos.buscarSemantico(
      "prédio de luxo de frente para o mar",
      5
    );

    console.log(`   Encontrados: ${encontradoSemantico.length}`);
    encontradoSemantico.forEach(e => {
        console.log(`   - ${e.nome}: ${e.similaridade.toFixed(4)}`);
    });

    const achou = encontradoSemantico.find(e => e.id === conhecimento.id);

    if (achou) {
      console.log(`✅ SUCESSO: Tenant B encontrou via busca semântica!`);
    } else {
      console.error('❌ FALHA: Tenant B não encontrou via busca semântica (verifique o threshold).');
    }

    console.log('\n🎉 Teste RAG Global Finalizado!');

  } catch (error) {
    console.error('\n❌ Erro fatal no teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testeRAGGlobal();
