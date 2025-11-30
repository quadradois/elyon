const axios = require('axios');

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';

async function descobrirRegioes() {
  console.log('🔍 Buscando campos relacionados a REGIÃO na API...\n');

  try {
    // Primeiro, vamos buscar um registro para ver todos os campos disponíveis
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: '1=1',
        outFields: '*', // Todos os campos
        returnGeometry: false,
        resultRecordCount: 1, // Só 1 registro
        f: 'json'
      },
      timeout: 15000
    });

    if (response.data.features && response.data.features.length > 0) {
      const campos = Object.keys(response.data.features[0].attributes);
      
      console.log('📋 Todos os campos disponíveis:');
      console.log('================================');
      
      // Filtrar campos que podem ser relacionados a região
      const camposRegiao = campos.filter(c => 
        c.toLowerCase().includes('regi') ||
        c.toLowerCase().includes('zona') ||
        c.toLowerCase().includes('setor') ||
        c.toLowerCase().includes('macro') ||
        c.toLowerCase().includes('distrito') ||
        c.toLowerCase().includes('area') ||
        c.toLowerCase().includes('cd') // códigos geralmente
      );
      
      console.log('\n🎯 Campos potencialmente relacionados a REGIÃO/ZONA/SETOR:');
      console.log('==========================================================');
      camposRegiao.forEach(c => {
        const valor = response.data.features[0].attributes[c];
        console.log(`  ${c}: ${valor}`);
      });

      // Agora vamos buscar valores distintos de campos de região
      console.log('\n\n📊 Buscando valores distintos de campos importantes...\n');
      
      // Campos para verificar valores distintos
      const camposParaVerificar = ['cdregiao', 'nmregiao', 'cdsetor', 'nmsetor', 'cdzona', 'zona'];
      
      for (const campo of camposParaVerificar) {
        if (campos.includes(campo)) {
          await buscarValoresDistintos(campo);
        }
      }
      
      // Se não encontrou, buscar por padrão cd* e nm* que podem indicar agrupamentos
      console.log('\n🔎 Verificando campos de código (cd*) que podem ser agrupadores...');
      const camposCodigo = campos.filter(c => c.startsWith('cd'));
      console.log('Campos de código:', camposCodigo.join(', '));

    } else {
      console.log('❌ Nenhum registro encontrado');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

async function buscarValoresDistintos(campo) {
  try {
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: '1=1',
        outFields: campo,
        returnDistinctValues: true,
        orderByFields: `${campo} ASC`,
        returnGeometry: false,
        f: 'json'
      },
      timeout: 15000
    });

    const valores = response.data.features?.map(f => f.attributes[campo]).filter(v => v !== null);
    console.log(`\n${campo}: ${valores?.length || 0} valores distintos`);
    if (valores && valores.length <= 30) {
      console.log(`  Valores: ${valores.join(', ')}`);
    }
  } catch (e) {
    console.log(`${campo}: Erro ao buscar - ${e.message}`);
  }
}

// Também vamos verificar se existe algum serviço de regiões
async function verificarOutrosServicos() {
  console.log('\n\n🌐 Verificando outros Feature Layers disponíveis...');
  
  try {
    // Tentar acessar o serviço pai para ver todos os layers
    const baseUrl = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer';
    const response = await axios.get(baseUrl, {
      params: { f: 'json' },
      timeout: 10000
    });
    
    if (response.data.layers) {
      console.log('\n📂 Layers disponíveis no FeatureServer:');
      response.data.layers.forEach(layer => {
        console.log(`  [${layer.id}] ${layer.name}`);
      });
    }
  } catch (e) {
    console.log('Não foi possível listar outros layers:', e.message);
  }
}

// Executar
descobrirRegioes()
  .then(() => verificarOutrosServicos())
  .then(() => console.log('\n✅ Análise concluída!'));
