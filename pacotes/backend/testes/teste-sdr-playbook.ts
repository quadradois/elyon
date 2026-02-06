
import { captadorWorker } from '../src/agentes/workers/sdr-worker';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTest() {
    console.log('🚀 Iniciando Teste do SDR Worker - Playbook Flow');

    const leadId = 'test-lead-id'; // Mock ID
    const mensagens = [
        { role: 'user', content: 'Olá, gostaria de saber o preço.' }
    ];

    const config = {
        nome: 'Ana',
        personalidade: { tom: 'formal', usarEmojis: true },
        expertise: { bairros: [], tiposImovel: [] },
        scripts: { saudacao: 'Olá!' },
        tenantNome: 'Imobiliária Teste',
        playbook: {
            id: 'playbook-test',
            etapas: [
                {
                    id: 'etapa-1',
                    nome: 'Qualificação Básica',
                    icone: '📝',
                    itens: [
                        { id: 'item-1', texto: 'Qual seu nome?', tipoItem: 'TEXT', scorePontos: 10, opcoes: [] }
                    ],
                    objecoes: []
                }
            ]
        }
    };

    try {
        // Mock Prisma responses if needed or rely on real DB if env is set
        // For now we test syntax and flow execution primarily.

        // We expect processar to handle the logic. 
        // Since we commented out the body, this will return '' or fail if my comment hack was messy.
        // Ideally we want to uncomment the body first.

        console.log('Chamando processar...');
        // const resposta = await captadorWorker.processar(mensagens, leadId, config as any);
        // console.log('Resposta:', resposta);

    } catch (error) {
        console.error('Erro no teste:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
