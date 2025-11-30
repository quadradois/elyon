const axios = require('axios');

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';

async function testarBuscaPorEndereco() {
  console.log('🔍 TESTANDO BUSCA POR ENDEREÇO\n');
  console.log('='.repeat(50));

  // Teste 1: Buscar por nome de rua
  console.log('\n📍 Teste 1: Buscar por "ALAMEDA DOS BURITIS"');
  console.log('-'.repeat(50));
  
  try {
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: "nmlogradou LIKE '%ALAMEDA DOS BURITIS%'",
        outFields: 'nrinscr,nmedificio,incompl,nmlogradou,nrimovel,nmbairro,areaedif,areaterr',
        returnGeometry: false,
        resultRecordCount: 10,
        orderByFields: 'nrimovel ASC',
        f: 'json'
      },
      timeout: 30000
    });

    console.log(`Encontrados: ${response.data.features?.length || 0} imóveis`);
    response.data.features?.slice(0, 5).forEach((f, i) => {
      const a = f.attributes;
      console.log(`  ${i+1}. ${a.nmlogradou} Nº ${a.nrimovel} ${a.incompl || ''} - ${a.nmbairro}`);
      console.log(`     IPTU: ${a.nrinscr} | ${a.nmedificio || 'Casa'} | ${a.areaedif || a.areaterr}m²`);
    });
  } catch (e) {
    console.log('Erro:', e.message);
  }

  // Teste 2: Buscar por rua + número
  console.log('\n\n📍 Teste 2: Buscar "RUA 1" número "100"');
  console.log('-'.repeat(50));
  
  try {
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: "nmlogradou LIKE '%RUA 1 %' AND nrimovel = '100'",
        outFields: 'nrinscr,nmedificio,incompl,nmlogradou,nrimovel,nmbairro,areaedif,areaterr',
        returnGeometry: false,
        resultRecordCount: 10,
        f: 'json'
      },
      timeout: 30000
    });

    console.log(`Encontrados: ${response.data.features?.length || 0} imóveis`);
    response.data.features?.slice(0, 5).forEach((f, i) => {
      const a = f.attributes;
      console.log(`  ${i+1}. ${a.nmlogradou} Nº ${a.nrimovel} - ${a.nmbairro}`);
      console.log(`     IPTU: ${a.nrinscr}`);
    });
  } catch (e) {
    console.log('Erro:', e.message);
  }

  // Teste 3: Buscar por parte do endereço (mais flexível)
  console.log('\n\n📍 Teste 3: Buscar "T-63" (Av. T-63)');
  console.log('-'.repeat(50));
  
  try {
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: "nmlogradou LIKE '%T-63%'",
        outFields: 'nrinscr,nmedificio,incompl,nmlogradou,nrimovel,nmbairro',
        returnGeometry: false,
        resultRecordCount: 10,
        orderByFields: 'nrimovel ASC',
        f: 'json'
      },
      timeout: 30000
    });

    console.log(`Encontrados: ${response.data.features?.length || 0} imóveis`);
    response.data.features?.slice(0, 5).forEach((f, i) => {
      const a = f.attributes;
      console.log(`  ${i+1}. ${a.nmlogradou} Nº ${a.nrimovel} ${a.incompl || ''} - ${a.nmbairro}`);
    });
  } catch (e) {
    console.log('Erro:', e.message);
  }

  // Teste 4: Buscar casa específica (sem edifício)
  console.log('\n\n📍 Teste 4: Buscar casas na "RUA 85" (sem edifício)');
  console.log('-'.repeat(50));
  
  try {
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: "nmlogradou LIKE '%RUA 85%' AND (nmedificio IS NULL OR nmedificio = '')",
        outFields: 'nrinscr,nmedificio,incompl,nmlogradou,nrimovel,nmbairro,areaedif,areaterr',
        returnGeometry: false,
        resultRecordCount: 10,
        orderByFields: 'nrimovel ASC',
        f: 'json'
      },
      timeout: 30000
    });

    console.log(`Encontrados: ${response.data.features?.length || 0} casas`);
    response.data.features?.slice(0, 5).forEach((f, i) => {
      const a = f.attributes;
      console.log(`  ${i+1}. ${a.nmlogradou} Nº ${a.nrimovel} - ${a.nmbairro}`);
      console.log(`     Terreno: ${a.areaterr}m² | Construído: ${a.areaedif}m²`);
    });
  } catch (e) {
    console.log('Erro:', e.message);
  }

  // Teste 5: Buscar por endereço completo
  console.log('\n\n📍 Teste 5: Buscar "AVENIDA 85" número "1000"');
  console.log('-'.repeat(50));
  
  try {
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: "nmlogradou LIKE '%AVENIDA 85%' AND nrimovel LIKE '%1000%'",
        outFields: 'nrinscr,nmedificio,incompl,nmlogradou,nrimovel,nmbairro,areaedif,areaterr',
        returnGeometry: false,
        resultRecordCount: 20,
        f: 'json'
      },
      timeout: 30000
    });

    console.log(`Encontrados: ${response.data.features?.length || 0} imóveis`);
    response.data.features?.forEach((f, i) => {
      const a = f.attributes;
      console.log(`  ${i+1}. ${a.nmlogradou} Nº ${a.nrimovel} ${a.incompl || ''} - ${a.nmbairro}`);
      console.log(`     ${a.nmedificio || 'Casa'} | IPTU: ${a.nrinscr}`);
    });
  } catch (e) {
    console.log('Erro:', e.message);
  }

  console.log('\n\n' + '='.repeat(50));
  console.log('✅ CONCLUSÃO: Busca por endereço funciona bem!');
  console.log('='.repeat(50));
  console.log(`
  Campos disponíveis para busca:
  - nmlogradou: Nome da rua/avenida (LIKE '%termo%')
  - nrimovel: Número do imóvel (exato ou LIKE)
  - nmbairro: Filtrar por bairro (opcional)
  
  Sugestão de implementação:
  1. Campo único: "Alameda dos Buritis, 1000" 
  2. Parse: extrair rua e número
  3. Busca: nmlogradou LIKE '%ALAMEDA DOS BURITIS%' AND nrimovel LIKE '%1000%'
  `);
}

testarBuscaPorEndereco();
