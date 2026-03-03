import { PrismaClient } from '@prisma/client';
import { descriptografar } from './src/lib/crypto';
import OpenAI from 'openai';

const prisma = new PrismaClient();

async function testarMoonshot() {
  try {
    console.log('Buscando tenant...');
    // Pega o primeiro tenant que usa moonshot
    const tenant = await prisma.tenant.findFirst({
      where: { llmProvedor: 'moonshot' } as any
    }) as any;

    if (!tenant) {
      console.log('Nenhum tenant configurado com Moonshot encontrado.');
      return;
    }

    console.log(`Tenant encontrado: ${tenant.nome} (${tenant.id})`);
    
    if (!tenant.llmApiKeyCriptografada) {
      console.log('Tenant sem API Key configurada.');
      return;
    }

    const apiKey = descriptografar(tenant.llmApiKeyCriptografada);
    console.log('API Key descriptografada:', apiKey.substring(0, 10) + '...');

    const baseUrl = tenant.llmBaseUrl || 'https://api.moonshot.ai/v1';
    console.log('Usando Base URL:', baseUrl);

    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseUrl
    });

    console.log('Listando modelos...');
    const models = await client.models.list();
    console.log('Modelos disponíveis:', models.data.map(m => m.id));

    console.log('Testando chat completion...');
    const completion = await client.chat.completions.create({
      model: 'moonshot-v1-8k',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Olá, quem é você?' }
      ]
    });

    console.log('Resposta:', completion.choices[0].message.content);

  } catch (error) {
    console.error('Erro no teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testarMoonshot();
