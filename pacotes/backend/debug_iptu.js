const axios = require('axios');

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';
const iptu = '32313702960010';

async function test() {
  console.log(`Testing IPTU: ${iptu}`);
  try {
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: `nrinscr = '${iptu}'`,
        outFields: 'nrinscr,nmedificio,nmbairro,nmlogradou',
        f: 'json',
        returnGeometry: false
      }
    });
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
