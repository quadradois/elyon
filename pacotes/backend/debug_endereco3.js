const axios = require('axios');

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';

async function testarEnderecoSimples() {
  console.log('🔍 TESTE SIMPLES DE BUSCA POR ENDEREÇO\n');

  // Usar a mesma query que já funciona no sistema
  try {
    console.log('1. Buscando imóveis no Setor Bueno...');
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: "nmbairro = 'SET BUENO'",
        outFields: 'nrinscr,nmedificio,incompl,nmlogradou,nrimovel,nmbairro',
        returnGeometry: false,
        resultRecordCount: 3,
        f: 'json'
      },
      timeout: 60000
    });

    if (response.data.features?.length > 0) {
      console.log(`✅ Encontrados ${response.data.features.length} imóveis\n`);
      
      response.data.features.forEach((f, i) => {
        const a = f.attributes;
        console.log(`${i+1}. ${a.nmlogradou || 'Sem logradouro'}, Nº ${a.nrimovel || 'S/N'}`);
        console.log(`   Edifício: ${a.nmedificio || 'Casa'}`);
        console.log(`   Bairro: ${a.nmbairro}`);
        console.log(`   IPTU: ${a.nrinscr}`);
        console.log('');
      });

      // Agora testar busca pelo logradouro encontrado
      const logradouro = response.data.features[0].attributes.nmlogradou;
      if (logradouro) {
        console.log(`\n2. Buscando por logradouro "${logradouro}"...`);
        
        const response2 = await axios.get(MAPA_API_URL, {
          params: {
            where: `nmlogradou = '${logradouro}'`,
            outFields: 'nrinscr,nmedificio,incompl,nmlogradou,nrimovel,nmbairro',
            returnGeometry: false,
            resultRecordCount: 5,
            f: 'json'
          },
          timeout: 60000
        });
        
        console.log(`✅ Encontrados ${response2.data.features?.length || 0} imóveis neste logradouro`);
      }
    }
  } catch (e) {
    console.log('❌ Erro:', e.message);
  }
}

testarEnderecoSimples();
