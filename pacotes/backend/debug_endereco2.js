const axios = require('axios');

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';

async function verificarDados() {
  console.log('🔍 VERIFICANDO ESTRUTURA DOS DADOS DE ENDEREÇO\n');

  // Primeiro, pegar alguns registros para ver como os dados estão
  console.log('📋 Amostra de 5 registros com campos de endereço:');
  console.log('-'.repeat(60));
  
  try {
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: "nmbairro = 'SET MARISTA'",
        outFields: 'nrinscr,nmedificio,incompl,nmlogradou,nrimovel,nmbairro,tplogradou',
        returnGeometry: false,
        resultRecordCount: 5,
        f: 'json'
      },
      timeout: 30000
    });

    console.log(`Encontrados: ${response.data.features?.length || 0} imóveis\n`);
    response.data.features?.forEach((f, i) => {
      const a = f.attributes;
      console.log(`${i+1}. Logradouro: "${a.nmlogradou}"`);
      console.log(`   Tipo: "${a.tplogradou}" | Número: "${a.nrimovel}"`);
      console.log(`   Edifício: "${a.nmedificio}" | Compl: "${a.incompl}"`);
      console.log('');
    });

    // Agora testar com o nome exato
    if (response.data.features?.length > 0) {
      const primeiroLogradouro = response.data.features[0].attributes.nmlogradou;
      console.log('\n📍 Testando busca com nome exato encontrado:');
      console.log(`   Termo: "${primeiroLogradouro}"`);
      
      const response2 = await axios.get(MAPA_API_URL, {
        params: {
          where: `nmlogradou = '${primeiroLogradouro}'`,
          outFields: 'nrinscr,nmedificio,incompl,nmlogradou,nrimovel',
          returnGeometry: false,
          resultRecordCount: 5,
          f: 'json'
        },
        timeout: 30000
      });
      
      console.log(`   Resultado: ${response2.data.features?.length || 0} imóveis encontrados`);
    }

  } catch (e) {
    console.log('Erro:', e.message);
  }

  // Verificar layer de Logradouros (Layer 8)
  console.log('\n\n🛣️  VERIFICANDO LAYER DE LOGRADOUROS (Layer 8):');
  console.log('-'.repeat(60));
  
  try {
    const response = await axios.get('https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/8/query', {
      params: {
        where: '1=1',
        outFields: '*',
        returnGeometry: false,
        resultRecordCount: 5,
        f: 'json'
      },
      timeout: 30000
    });

    console.log(`Encontrados: ${response.data.features?.length || 0} logradouros\n`);
    if (response.data.features?.length > 0) {
      const campos = Object.keys(response.data.features[0].attributes);
      console.log('Campos disponíveis:', campos.join(', '));
      console.log('\nExemplos:');
      response.data.features?.forEach((f, i) => {
        console.log(`${i+1}. ${JSON.stringify(f.attributes)}`);
      });
    }
  } catch (e) {
    console.log('Erro:', e.message);
  }

  // Testar busca direta por LIKE com % correto
  console.log('\n\n🔍 TESTANDO BUSCA LIKE COM UPPER():');
  console.log('-'.repeat(60));
  
  try {
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: "UPPER(nmlogradou) LIKE '%MARISTA%'",
        outFields: 'nrinscr,nmedificio,nmlogradou,nrimovel,nmbairro',
        returnGeometry: false,
        resultRecordCount: 5,
        f: 'json'
      },
      timeout: 30000
    });

    console.log(`Encontrados: ${response.data.features?.length || 0} imóveis`);
    response.data.features?.forEach((f, i) => {
      console.log(`${i+1}. ${f.attributes.nmlogradou} - ${f.attributes.nmbairro}`);
    });
  } catch (e) {
    console.log('Erro:', e.message);
  }
}

verificarDados();
