
import { prisma } from '../lib/db';

async function main() {
    console.log('🔎 Buscando clientes SEM origemLeadId...');

    const clientesSemLead = await prisma.cliente.findMany({
        where: { origemLeadId: null },
        select: { id: true, nome: true, origemLeadId: true }
    });

    if (clientesSemLead.length === 0) {
        console.log('✅ Todos os clientes possuem origemLeadId.');
    } else {
        console.log(`⚠️ Encontrados ${clientesSemLead.length} clientes sem Lead:`);
        clientesSemLead.forEach(c => console.log(`- ${c.nome} (ID: ${c.id})`));
    }

    console.log('\n🔎 Verificando TUDO:');
    const todos = await prisma.cliente.findMany({
        select: { id: true, nome: true, origemLeadId: true }
    });
    todos.forEach(c => {
        console.log(`- ${c.nome}: ${c.origemLeadId ? '✅ Tem Lead' : '❌ NULL'}`);
    });
}

main().finally(() => prisma.$disconnect());
