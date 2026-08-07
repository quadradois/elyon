
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Carregar .env do diretório pai (backend)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const apiUrl = process.env.EVOLUTION_API_URL;
const apiKey = process.env.EVOLUTION_TENANT_API_KEY;
const tenantId = process.env.EVOLUTION_TENANT_ID;

if (!apiUrl || !apiKey || !tenantId) {
  console.error('ERRO: configuração tenant da Evolution Go ausente');
  process.exit(1);
}

async function debugFetchInstances() {
  try {
    console.log('Buscando instâncias no Evolution Go');
    
    const response = await axios.get(
      `${apiUrl}/instance/all`,
      { 
        headers: { 
          'apikey': apiKey,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        } 
      }
    );

    const instances = response.data?.data || response.data;
    if (Array.isArray(instances)) {
      console.log(`Encontradas ${instances.length} instâncias.`);
    } else {
      console.log('A resposta não é um array.');
    }

  } catch (error: any) {
    console.error('ERRO ao buscar instâncias');
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

debugFetchInstances();
