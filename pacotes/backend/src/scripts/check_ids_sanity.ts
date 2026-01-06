
import { prisma } from '../lib/db';

async function main() {
    console.log('🔎 Verificando valores de origemLeadId...');

    const clientes = await prisma.cliente.findMany({
        select: {
            id: true,
            nome: true,
            origemLeadId: true,
            lead: {
                select: { origem: true }
            }
        }
    });

    for (const c of clientes) {
        console.log(`Cliente: ${c.nome}`);
        console.log(`  ID: ${c.id}`);
        console.log(`  OrigemLeadId: '${c.origemLeadId}'`);
        console.log(`  Lead Origem: '${c.lead?.origem}'`);

        if (c.origemLeadId === 'prospeccao_ativa') {
            console.error('  ❌ CATASTROFE: origemLeadId tem o valor "prospeccao_ativa"!');
        }
    }
}

main().finally(() => prisma.$disconnect());
