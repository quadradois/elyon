const axios = require('axios');

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';

async function test() {
  console.log(`Testing Basic Query 1=1`);
  try {
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: "1=1",
        outFields: 'nrinscr',
        f: 'json',
        returnGeometry: false,
        resultRecordCount: 1
      }
    });
    console.log('Status:', response.status);
    if (response.data.error) {
        console.error('API Error:', JSON.stringify(response.data.error, null, 2));
    } else {
        console.log('Data found:', response.data.features ? response.data.features.length : 0);
        if (response.data.features && response.data.features.length > 0) {
            console.log('Sample:', JSON.stringify(response.data.features[0], null, 2));
        }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
