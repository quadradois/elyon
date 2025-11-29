const axios = require('axios');

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';

async function test() {
  console.log(`Testing Building Search`);
  try {
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: "nmedificio LIKE '%RESERVA BURITI%'",
        outFields: 'nrinscr,nmedificio,nmbairro,nmlogradou',
        f: 'json',
        returnGeometry: false
      }
    });
    console.log('Status:', response.status);
    if (response.data.error) {
        console.error('API Error:', JSON.stringify(response.data.error, null, 2));
    } else {
        console.log('Data found:', response.data.features ? response.data.features.length : 0);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
