const axios = require('axios');

const MAPA_METADATA_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3';

async function test() {
  console.log(`Testing Metadata`);
  try {
    const response = await axios.get(MAPA_METADATA_URL, {
      params: {
        f: 'json'
      }
    });
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
