import axios from 'axios';

async function testWebhook() {
  const url = 'http://localhost:3000/webhooks';
  
  const payload = {
    event: 'messages.upsert',
    instance: 'elyon_main',
    data: {
      messages: [
        {
          key: {
            remoteJid: '5511999998888@s.whatsapp.net',
            fromMe: false,
            id: 'TEST_MSG_ID_1'
          },
          pushName: 'Teste User',
          message: {
            conversation: 'Olá, isso é um teste de webhook!'
          },
          messageTimestamp: Math.floor(Date.now() / 1000)
        }
      ]
    }
  };

  try {
    console.log('Enviando payload de teste...');
    const response = await axios.post(url, payload);
    console.log('Resposta:', response.status, response.data);
  } catch (error: any) {
    console.error('Erro ao enviar webhook:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testWebhook();
