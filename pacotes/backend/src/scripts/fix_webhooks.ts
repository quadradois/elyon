import { WhatsAppService } from '../servicos/whatsapp';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function fixWebhooks() {
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const backendUrl = process.env.BACKEND_URL || 'https://api.elyon.ia.br';

    if (!apiUrl || !apiKey) {
        console.error('ERRO: Variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY são obrigatórias.');
        process.exit(1);
    }

    console.log('Iniciando correção de webhooks...');
    console.log(`Evolution API: ${apiUrl}`);
    console.log(`Backend URL: ${backendUrl}`);

    try {
        // 1. Buscar todas as instâncias
        console.log('Buscando instâncias...');
        const response = await axios.get(`${apiUrl}/instance/fetchInstances`, {
            headers: { apikey: apiKey }
        });

        const instances = Array.isArray(response.data) ? response.data : [];
        console.log(`Encontradas ${instances.length} instâncias.`);

        // 2. Iterar e corrigir
        for (const inst of instances) {
            const name = inst.name || inst.instance?.instanceName;
            if (!name) continue;

            console.log(`\nCorrigindo instância: ${name}...`);
            const service = new WhatsAppService(name);

            const webhookUrl = `${backendUrl}/api/webhooks/whatsapp`;

            try {
                await service.configurarWebhook(webhookUrl, true);
                console.log(`✅ Webhook configurado com sucesso para ${name}`);
            } catch (err: any) {
                console.error(`❌ Erro ao configurar ${name}:`, err.message);
            }
        }

        console.log('\n✅ Processo concluído!');

    } catch (error: any) {
        console.error('Erro geral ao buscar instâncias:', error.message);
    }
}

fixWebhooks();
