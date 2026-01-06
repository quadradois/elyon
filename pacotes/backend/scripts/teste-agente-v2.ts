import { agenteV2 } from '../src/agentes/agente-v2';

async function main() {
    console.log('=== TESTE AGENTE V2 (FUNCTION CALLING) ===');

    // Caso 1: Pergunta quem é um lead (Buscar Lead)
    console.log('\n--- CASO 1: Busca de Lead ---');
    const pergunta1 = "Quem é o cliente com telefone 62999999999?";
    console.log(`User: ${pergunta1}`);

    try {
        const resposta1 = await agenteV2.processarMensagem([], pergunta1);
        console.log(`Elyon: ${resposta1}`);
    } catch (err) {
        console.error('Erro Caso 1:', err);
    }

    // Caso 2: Verificar Agenda (Consultar Agenda)
    console.log('\n--- CASO 2: Verificar Agenda ---');
    const pergunta2 = "Minha agenda está livre amanhã (19/12/2025) às 14h?";
    console.log(`User: ${pergunta2}`);

    try {
        // Simulando um histórico onde já falamos sobre agendamento
        const resposta = await agenteV2.processarMensagem([], pergunta2);
        console.log(`Elyon: ${resposta}`);
    } catch (err) {
        console.error('Erro Caso 2:', err);
    }
}

main();
