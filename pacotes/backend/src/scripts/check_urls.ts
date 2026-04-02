
import { prisma } from '../lib/db';

async function main() {
    console.log('🔎 Verificando URLs de contrato nos Leads...');
    const leads = await prisma.lead.findMany({
        where: {
            status: 'CAPTADO',
            contratoUrl: { not: null }
        },
        take: 5,
        select: {
            id: true,
            nome: true,
            contratoUrl: true
        }
    });

    for (const l of leads) {
        console.log(`Lead: ${l.nome}`);
        console.log(`URL: ${l.contratoUrl}`);
        console.log('---');
    }
}

main().finally(() => prisma.$disconnect());
