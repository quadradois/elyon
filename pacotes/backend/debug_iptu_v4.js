const axios = require('axios');

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';
const iptu = '32313702960010';

async function test() {
  console.log(`Testing IPTU: ${iptu} (Pagination YES, Extra WHERE NO)`);
  try {
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: `nrinscr = '${iptu}'`,
        outFields: 'nrinscr,nmedificio,nmbairro,nmlogradou',
        f: 'json',
        returnGeometry: false,
        resultRecordCount: 1000,
        resultOffset: 0
      }
    });
    console.log('Status:', response.status);
    if (response.data.error) {
        console.error('API Error:', JSON.stringify(response.data.error, null, 2));
    } else {
        console.log('Data found:', response.data.features.length);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
