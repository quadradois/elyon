const axios = require('axios');

async function buscarCondominioHorizontal() {
  try {
    // Buscar casas do JD MADRI para ver todos os campos disponíveis
    console.log('=== CAMPOS DISPONÍVEIS EM CASAS DE CONDOMÍNIO ===\n');
    
    const response = await axios.get(
      'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query',
      {
        params: {
          where: "nmbairro = 'JD MADRI'",
          outFields: '*',  // Todos os campos
          returnGeometry: false,
          resultRecordCount: 3,
          f: 'json'
        },
        timeout: 30000
      }
    );
    
    if (response.data.features && response.data.features.length > 0) {
      console.log('Exemplo de casa com TODOS os campos:\n');
      const attr = response.data.features[0].attributes;
      
      // Mostrar campos relevantes para quadra/lote
      console.log('=== CAMPOS DE LOCALIZAÇÃO ===');
      console.log('nrquadra (quadra):', attr.nrquadra);
      console.log('nrlote (lote):', attr.nrlote);
      console.log('nrimovel (número):', attr.nrimovel);
      console.log('nmlogradou:', attr.nmlogradou);
      console.log('incompl:', attr.incompl);
      
      console.log('\n=== CAMPOS DE ÁREA ===');
      console.log('areaterr (área terreno):', attr.areaterr);
      console.log('areaedif (área edificada):', attr.areaedif);
      
      console.log('\n=== TODOS OS CAMPOS ===');
      Object.keys(attr).sort().forEach(key => {
        if (attr[key] !== null && attr[key] !== '') {
          console.log(`${key}: ${attr[key]}`);
        }
      });
    }

  } catch (error) {
    console.error('Erro:', error.message);
  }
}

buscarCondominioHorizontal();
