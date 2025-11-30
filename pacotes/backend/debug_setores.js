const axios = require('axios');

const BASE_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer';

async function investigarSetores() {
  console.log('🔍 Investigando Layer 6 - SETOR CADASTRAL...\n');

  try {
    // Layer 6 = Setor Cadastral
    const response = await axios.get(`${BASE_URL}/6/query`, {
      params: {
        where: '1=1',
        outFields: '*',
        returnDistinctValues: true,
        returnGeometry: false,
        resultRecordCount: 100,
        f: 'json'
      },
      timeout: 30000
    });

    if (response.data.features && response.data.features.length > 0) {
      const campos = Object.keys(response.data.features[0].attributes);
      console.log('📋 Campos do Setor Cadastral:', campos.join(', '));
      
      console.log('\n📊 Setores encontrados:');
      console.log('========================');
      
      response.data.features.forEach((f, i) => {
        const attrs = f.attributes;
        console.log(`${i + 1}. ${JSON.stringify(attrs)}`);
      });
      
      console.log(`\nTotal: ${response.data.features.length} setores`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

async function investigarBairros() {
  console.log('\n\n🔍 Investigando Layer 2 - DIVISAS DE BAIRRO...\n');

  try {
    // Layer 2 = Divisas de Bairro
    const response = await axios.get(`${BASE_URL}/2/query`, {
      params: {
        where: '1=1',
        outFields: '*',
        returnGeometry: false,
        resultRecordCount: 300,
        f: 'json'
      },
      timeout: 30000
    });

    if (response.data.features && response.data.features.length > 0) {
      const campos = Object.keys(response.data.features[0].attributes);
      console.log('📋 Campos de Divisas de Bairro:', campos.join(', '));
      
      // Verificar se tem campo de região
      const camposRegiao = campos.filter(c => 
        c.toLowerCase().includes('regi') ||
        c.toLowerCase().includes('zona') ||
        c.toLowerCase().includes('macro')
      );
      
      if (camposRegiao.length > 0) {
        console.log('\n🎯 Campos de REGIÃO encontrados:', camposRegiao.join(', '));
        
        // Agrupar por região
        const porRegiao = {};
        response.data.features.forEach(f => {
          const regiao = f.attributes[camposRegiao[0]] || 'Sem região';
          if (!porRegiao[regiao]) porRegiao[regiao] = [];
          porRegiao[regiao].push(f.attributes.nmbairro || f.attributes.nome);
        });
        
        console.log('\n📊 Bairros agrupados por região:');
        Object.entries(porRegiao).forEach(([regiao, bairros]) => {
          console.log(`\n${regiao}: ${bairros.length} bairros`);
          console.log(`  ${bairros.slice(0, 5).join(', ')}${bairros.length > 5 ? '...' : ''}`);
        });
      }
      
      // Mostrar alguns exemplos
      console.log('\n📝 Exemplos de registros:');
      response.data.features.slice(0, 5).forEach((f, i) => {
        console.log(`${i + 1}. ${JSON.stringify(f.attributes)}`);
      });
      
      console.log(`\nTotal: ${response.data.features.length} bairros`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Também verificar no cadastro imobiliário os campos de setor
async function verificarCamposSetor() {
  console.log('\n\n🔍 Verificando campos de SETOR no Cadastro Imobiliário (Layer 3)...\n');

  try {
    const response = await axios.get(`${BASE_URL}/3/query`, {
      params: {
        where: "nmbairro = 'SETOR MARISTA'", // Buscar no Setor Marista
        outFields: 'nrinscr,nmbairro,nmedificio,cdsetor,nmsetor,setor,cdregiao,regiao',
        returnGeometry: false,
        resultRecordCount: 5,
        f: 'json'
      },
      timeout: 30000
    });

    if (response.data.features && response.data.features.length > 0) {
      console.log('📋 Registros do Setor Marista:');
      response.data.features.forEach((f, i) => {
        console.log(`${i + 1}. ${JSON.stringify(f.attributes)}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Executar
investigarSetores()
  .then(() => investigarBairros())
  .then(() => verificarCamposSetor())
  .then(() => console.log('\n✅ Investigação concluída!'));
