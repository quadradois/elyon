const axios = require('axios');
const apiKey = process.env.MANUS_API_KEY;

if (!apiKey) {
    console.log('MANUS_API_KEY não configurada');
    process.exit(1);
}

async function main() {
    const taskId = 'd3HtUqy4aCM2tGftecBMcL'; // Maison Autentique

    try {
        const response = await axios.get(`https://api.manus.ai/v1/tasks/${taskId}`, {
            headers: { 'API_KEY': apiKey }
        });

        console.log('Status:', response.data.status);
        console.log('Credit usage:', response.data.credit_usage);

        // Pegar o último output do assistant
        const outputs = response.data.output || [];
        const lastAssistant = outputs.filter(o => o.role === 'assistant').pop();

        if (lastAssistant && lastAssistant.content) {
            for (const content of lastAssistant.content) {
                console.log('\n=== ÚLTIMO OUTPUT COMPLETO ===');
                console.log('Type:', content.type);
                console.log('Text completo:');
                console.log(content.text || '[sem texto]');
                console.log('\nTamanho do texto:', (content.text || '').length, 'caracteres');
            }
        }

    } catch (e) {
        console.error('Erro:', e.response?.data || e.message);
    }
}

main();
