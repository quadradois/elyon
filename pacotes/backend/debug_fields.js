const axios = require('axios');

const MAPA_METADATA_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3';

async function test() {
  console.log(`Testing Metadata Fields`);
  try {
    const response = await axios.get(MAPA_METADATA_URL, {
      params: {
        f: 'json'
      }
    });
    if (response.data.fields) {
        const allFields = response.data.fields.map(f => f.name);
        console.log('All Fields:', allFields.join(', '));
        const complFields = allFields.filter(f => f.toLowerCase().includes('compl') || f.toLowerCase().includes('unid'));
        console.log('Complemento/Unidade Fields:', complFields.join(', '));
    } else {
        console.log('No fields found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
