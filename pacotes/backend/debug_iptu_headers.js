const axios = require('axios');

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';
const iptu = '32313702960010';

async function test() {
  console.log(`Testing IPTU: ${iptu} (With Headers)`);
  try {
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: `nrinscr = '${iptu}'`,
        outFields: 'nrinscr,nmedificio,nmbairro,nmlogradou',
        f: 'json',
        returnGeometry: false
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://portalmapa.goiania.go.gov.br/',
        'Origin': 'https://portalmapa.goiania.go.gov.br'
      }
    });
    console.log('Status:', response.status);
    if (response.data.error) {
        console.error('API Error:', JSON.stringify(response.data.error, null, 2));
    } else {
        console.log('Data found:', response.data.features ? response.data.features.length : 0);
        console.log(JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
