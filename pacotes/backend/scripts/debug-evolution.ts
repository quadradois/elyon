
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Carregar .env do diretório pai (backend)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const apiUrl = process.env.EVOLUTION_API_URL;
const apiKey = process.env.EVOLUTION_API_KEY;

if (!apiUrl || !apiKey) {
  console.error('ERRO: Variáveis EVOLUTION_API_URL ou EVOLUTION_API_KEY não encontradas no .env');
  process.exit(1);
}

async function debugFetchInstances() {
  try {
    console.log(`Buscando instâncias em: ${apiUrl}/instance/fetchInstances`);
    
    const response = await axios.get(
      `${apiUrl}/instance/fetchInstances`,
      { 
        headers: { 
          'apikey': apiKey,
          'Content-Type': 'application/json'
        } 
      }
    );

    console.log('\n--- RESPOSTA DA API ---');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('-----------------------\n');

    if (Array.isArray(response.data)) {
      console.log(`Encontradas ${response.data.length} instâncias.`);
      response.data.forEach((inst: any, idx: number) => {
        console.log(`\n[${idx}] Instância: ${inst.instance?.instanceName}`);
        console.log(`    Status: ${inst.instance?.status}`);
        console.log(`    Owner: ${inst.instance?.owner}`);
        console.log(`    Profile Name: ${inst.instance?.profileName}`);
      });
    } else {
      console.log('A resposta não é um array.');
    }

  } catch (error: any) {
    console.error('ERRO ao buscar instâncias:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugFetchInstances();
