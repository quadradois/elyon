
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Carregar .env do diretório pai (backend)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const apiUrl = process.env.EVOLUTION_API_URL;
const apiKey = process.env.EVOLUTION_GLOBAL_API_KEY;

if (!apiUrl || !apiKey) {
  console.error('ERRO: Variáveis EVOLUTION_API_URL ou EVOLUTION_GLOBAL_API_KEY não encontradas no .env');
  process.exit(1);
}

async function debugFetchInstances() {
  try {
    console.log('Buscando instâncias no Evolution Go');
    
    const response = await axios.get(
      `${apiUrl}/instance/fetchInstances`,
      { 
        headers: { 
          'apikey': apiKey,
          'Content-Type': 'application/json'
        } 
      }
    );

    if (Array.isArray(response.data)) {
      console.log(`Encontradas ${response.data.length} instâncias.`);
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
