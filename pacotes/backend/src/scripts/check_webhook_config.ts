
import axios from 'axios';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente do .env do backend
dotenv.config({ path: './.env' });

async function checkWebhook() {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

  if (!apiUrl || !apiKey || !instanceName) {
    console.error('Erro: Variáveis de ambiente não encontradas.');
    return;
  }

  console.log(`Verificando webhook para instância: ${instanceName}`);
  console.log(`URL da API: ${apiUrl}`);

  try {
    const response = await axios.get(
      `${apiUrl}/webhook/find/${instanceName}`,
      {
        headers: {
          'apikey': apiKey
        }
      }
    );

    console.log('--- Configuração Atual do Webhook ---');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.enabled) {
        console.log(`\n✅ Webhook ATIVADO na URL: ${response.data.url}`);
    } else {
        console.log('\n❌ Webhook DESATIVADO.');
    }

  } catch (error: any) {
    console.error('Erro ao buscar webhook:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

checkWebhook();
