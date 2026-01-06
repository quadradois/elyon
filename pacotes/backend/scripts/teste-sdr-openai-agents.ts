/**
 * Teste do SDR Agent com @openai/agents SDK
 * 
 * Execução: npx tsx scripts/teste-sdr-openai-agents.ts
 */

// Carregar variáveis de ambiente
import 'dotenv/config';

import { processarMensagemSDR, ConfiguracaoSdrAgent } from '../src/agentes/sdr-agent';

async function testarAgente() {
    console.log('='.repeat(60));
    console.log('🧪 TESTE DO SDR AGENT - @openai/agents SDK');
    console.log('='.repeat(60));

    // Verificar API Key
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY não configurada no .env');
        process.exit(1);
    }
    console.log('✅ OPENAI_API_KEY encontrada');

    // Configuração de teste
    const config: ConfiguracaoSdrAgent = {
        nome: 'Sofia',
        imobiliaria: 'Imobiliária Teste',
        empreendimento: 'Edifício Aurora',
        tom: 'amigavel',
        usarEmojis: true,
        briefingEmpreendimento: `
O Edifício Aurora é um empreendimento residencial de alto padrão.
- Localização: Barra da Tijuca, Rio de Janeiro
- Torres: 2 torres com 20 andares cada
- Apartamentos: 2 a 4 quartos (80 a 200m²)
- Preços: R$ 800.000 a R$ 2.500.000
- Diferenciais: Piscina aquecida, academia, salão de festas
`
    };

    // Teste 1: Resposta inicial positiva
    console.log('\n📋 TESTE 1: Resposta positiva do proprietário');
    console.log('-'.repeat(40));

    try {
        const resultado1 = await processarMensagemSDR(
            'Sim, eu quero vender o meu apartamento aqui',
            'contato-teste-123',
            config
        );

        console.log('📤 Resposta do agente:');
        console.log(resultado1.resposta);
        console.log(`\n✅ Sucesso: ${resultado1.sucesso}`);

    } catch (error) {
        console.error('❌ Erro no teste 1:', error);
    }

    // Teste 2: Objeção comum
    console.log('\n📋 TESTE 2: Objeção sobre comissão');
    console.log('-'.repeat(40));

    try {
        const resultado2 = await processarMensagemSDR(
            'Quanto vocês cobram de comissão? 6% é muito caro',
            'contato-teste-456',
            config,
            [
                { role: 'assistant', content: 'Olá! Tenho uma família interessada no Aurora. Você conhece alguém vendendo?' },
                { role: 'user', content: 'Eu tenho um apartamento pra vender aqui sim' }
            ]
        );

        console.log('📤 Resposta do agente:');
        console.log(resultado2.resposta);
        console.log(`\n✅ Sucesso: ${resultado2.sucesso}`);

    } catch (error) {
        console.error('❌ Erro no teste 2:', error);
    }

    // Teste 3: Opt-out
    console.log('\n📋 TESTE 3: Pedido de opt-out');
    console.log('-'.repeat(40));

    try {
        const resultado3 = await processarMensagemSDR(
            'Para de me mandar mensagem, não quero receber mais nada',
            'contato-teste-789',
            config
        );

        console.log('📤 Resposta do agente:');
        console.log(resultado3.resposta);
        console.log(`\n✅ Sucesso: ${resultado3.sucesso}`);

    } catch (error) {
        console.error('❌ Erro no teste 3:', error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 TESTES FINALIZADOS');
    console.log('='.repeat(60));
}

// Executar
testarAgente()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Erro fatal:', err);
        process.exit(1);
    });
