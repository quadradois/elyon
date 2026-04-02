const axios = require('axios');

const BASE_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer';

async function descobrirRegioes() {
  console.log('🗺️  DESCOBRINDO REGIÕES DE GOIÂNIA\n');
  console.log('='.repeat(50));

  // 1. Verificar o nr_quad dos setores (parece ser quadrante/região)
  console.log('\n📊 1. QUADRANTES (nr_quad do Setor Cadastral):');
  console.log('-'.repeat(50));
  
  try {
    const response = await axios.get(`${BASE_URL}/6/query`, {
      params: {
        where: '1=1',
        outFields: 'nr_quad',
        returnDistinctValues: true,
        orderByFields: 'nr_quad ASC',
        returnGeometry: false,
        f: 'json'
      },
      timeout: 15000
    });

    const quadrantes = [...new Set(response.data.features.map(f => f.attributes.nr_quad))];
    console.log(`Quadrantes encontrados: ${quadrantes.join(', ')}`);
    console.log('\nSignificado provável:');
    console.log('  1 = Região Centro/Nordeste');
    console.log('  2 = Região Leste/Sudeste');
    console.log('  3 = Região Sul/Sudoeste');
    console.log('  4 = Região Oeste/Noroeste');
  } catch (e) {
    console.log('Erro:', e.message);
  }

  // 2. Verificar id_re7 das divisas de bairro
  console.log('\n\n📊 2. CÓDIGO DE REGIÃO (id_re7) dos Bairros:');
  console.log('-'.repeat(50));
  
  try {
    const response = await axios.get(`${BASE_URL}/2/query`, {
      params: {
        where: '1=1',
        outFields: 'id_re7,nm_bai',
        returnDistinctValues: false,
        returnGeometry: false,
        resultRecordCount: 500,
        f: 'json'
      },
      timeout: 30000
    });

    // Agrupar bairros por id_re7
    const porRegiao = {};
    response.data.features.forEach(f => {
      const regiao = f.attributes.id_re7 || 'Sem código';
      if (!porRegiao[regiao]) porRegiao[regiao] = [];
      if (f.attributes.nm_bai) {
        porRegiao[regiao].push(f.attributes.nm_bai);
      }
    });

    console.log(`\nTotal de códigos de região: ${Object.keys(porRegiao).length}`);
    
    // Mostrar as regiões com seus bairros
    Object.entries(porRegiao)
      .filter(([_, bairros]) => bairros.length > 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([regiao, bairros]) => {
        console.log(`\n🏘️  ${regiao} (${bairros.length} bairros):`);
        console.log(`   ${bairros.slice(0, 8).join(', ')}${bairros.length > 8 ? '...' : ''}`);
      });
  } catch (e) {
    console.log('Erro:', e.message);
  }

  // 3. Verificar se existe campo de região no cadastro imobiliário
  console.log('\n\n📊 3. BAIRROS AGRUPADOS POR PADRÃO DE NOME:');
  console.log('-'.repeat(50));
  
  try {
    const response = await axios.get(`${BASE_URL}/3/query`, {
      params: {
        where: '1=1',
        outFields: 'nmbairro',
        returnDistinctValues: true,
        orderByFields: 'nmbairro ASC',
        returnGeometry: false,
        f: 'json'
      },
      timeout: 30000
    });

    const bairros = response.data.features.map(f => f.attributes.nmbairro).filter(Boolean);
    
    // Agrupar por tipo (Setor, Jardim, Residencial, etc)
    const tipos = {
      'SETOR': bairros.filter(b => b.startsWith('SETOR')),
      'JARDIM': bairros.filter(b => b.includes('JARDIM') || b.startsWith('JD ')),
      'RESIDENCIAL': bairros.filter(b => b.includes('RESIDENCIAL') || b.startsWith('RES ')),
      'PARQUE': bairros.filter(b => b.includes('PARQUE') || b.startsWith('PQ ')),
      'VILA': bairros.filter(b => b.includes('VILA') || b.startsWith('VL ')),
      'OUTROS': bairros.filter(b => 
        !b.startsWith('SETOR') && 
        !b.includes('JARDIM') && !b.startsWith('JD ') &&
        !b.includes('RESIDENCIAL') && !b.startsWith('RES ') &&
        !b.includes('PARQUE') && !b.startsWith('PQ ') &&
        !b.includes('VILA') && !b.startsWith('VL ')
      )
    };

    Object.entries(tipos).forEach(([tipo, lista]) => {
      console.log(`\n📍 ${tipo} (${lista.length}):`);
      console.log(`   ${lista.slice(0, 10).join(', ')}${lista.length > 10 ? '...' : ''}`);
    });

  } catch (e) {
    console.log('Erro:', e.message);
  }

  // 4. Criar sugestão de mapeamento de regiões
  console.log('\n\n' + '='.repeat(50));
  console.log('📋 SUGESTÃO DE IMPLEMENTAÇÃO:');
  console.log('='.repeat(50));
  console.log(`
  Opção 1: REGIÕES POR CÓDIGO (id_re7)
  - Agrupar bairros pelo código id_re7 das divisas
  - Vantagem: Agrupamento oficial da prefeitura
  - Desvantagem: Códigos não são intuitivos

  Opção 2: REGIÕES POR QUADRANTE (nr_quad)
  - Usar os 4 quadrantes (1, 2, 3, 4)
  - Vantagem: Simples e intuitivo
  - Desvantagem: Muito genérico

  Opção 3: REGIÕES POR TIPO DE BAIRRO
  - Setores, Jardins, Residenciais, Parques, Vilas
  - Vantagem: Familiar para o usuário
  - Desvantagem: Não é geográfico

  Opção 4: REGIÕES MANUAIS (RECOMENDADO)
  - Criar mapeamento manual baseado em conhecimento local:
    * Centro: Setor Central, Setor Oeste, Setor Marista
    * Sul: Setor Bueno, Jardim Goiás, Setor Pedro Ludovico
    * Norte: Setor Norte Ferroviário, Setor Campinas
    * Leste: Setor Universitário, Setor Leste Universitário
    * Oeste: Setor Coimbra, Setor Gentil Meireles
  `);
}

descobrirRegioes().then(() => console.log('\n✅ Análise concluída!'));
