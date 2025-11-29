const axios = require('axios');
const qs = require('querystring');

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';
const iptu = '32313702960010';

async function test() {
  console.log(`Testing POST Request`);
  try {
    const response = await axios.post(MAPA_API_URL, qs.stringify({
        where: `nrinscr = '${iptu}'`,
        outFields: 'nrinscr,nmedificio,nmbairro,nmlogradou',
        f: 'json',
        returnGeometry: false
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    console.log('Status:', response.status);
    if (response.data.error) {
        console.error('API Error:', JSON.stringify(response.data.error, null, 2));
    } else {
        console.log('Data found:', response.data.features ? response.data.features.length : 0);
        if (response.data.features && response.data.features.length > 0) {
             console.log(JSON.stringify(response.data.features[0], null, 2));
        }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
