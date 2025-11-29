
import axios from 'axios';

async function simulateWebhook() {
  const payload = {
    type: 'MESSAGES_UPSERT',
    instance: 'elyon_instance',
    data: {
      key: {
        remoteJid: '5511999998888@s.whatsapp.net',
        fromMe: false,
        id: 'ABC123456'
      },
      pushName: 'Teste Simulado',
      message: {
        conversation: 'Olá, esta é uma mensagem de teste simulada via script.'
      },
      messageTimestamp: Math.floor(Date.now() / 1000)
    },
    sender: '5511999998888@s.whatsapp.net'
  };

  // Ajuste a estrutura para bater com o que o webhook espera
  // O webhook espera: { type, instance, data: { data: message } } ou algo assim?
  // Vamos olhar o webhook.ts: const { type, instance, data, sender } = req.body;
  // const message = data.data;
  
  // Então o payload correto deve ser:
  const correctPayload = {
    type: 'MESSAGES_UPSERT',
    instance: 'elyon_instance',
    data: {
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: 'ABC123456'
        },
        pushName: 'Teste Simulado',
        message: {
          conversation: 'Olá, esta é uma mensagem de teste simulada via script.'
        },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }
    },
    sender: '5511999998888@s.whatsapp.net'
  };

  try {
    console.log('Enviando webhook simulado...');
    const response = await axios.post('http://localhost:3000/webhooks', correctPayload);
    console.log('Status:', response.status);
    console.log('Response:', response.data);
  } catch (error: any) {
    console.error('Erro ao enviar webhook:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

simulateWebhook();
