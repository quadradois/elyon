
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnostico() {
    try {
        const total = await prisma.lead.count();

        const leadsNovos = await prisma.lead.count({
            where: { status: 'NOVO' }
        });

        // Leads frios (sem interação) - Aproximação
        const leadsFrios = await prisma.lead.count({
            where: {
                status: 'NOVO',
                atividades: { none: {} },
                conversas: { none: {} }
            }
        });

        console.log('--- DIAGNÓSTICO DA BASE DE LEADS ---');
        console.log(`Total de Leads: ${total}`);
        console.log(`Leads 'NOVO': ${leadsNovos}`);
        console.log(`Leads FRIOS (Candidatos a virar Contato): ${leadsFrios}`);
        console.log(`Leads QUENTES (Ficam no CRM): ${total - leadsFrios}`);
        console.log('------------------------------------');

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

diagnostico();
