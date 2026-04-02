const axios = require('axios');

async function checkServer() {
  try {
    console.log('Checking backend health...');
    const response = await axios.get('http://localhost:3000/api/saude');
    console.log('Server is UP:', response.data);
  } catch (error) {
    console.error('Server is DOWN or Unreachable:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('Connection refused. Is the server running?');
    }
  }
}

checkServer();
