
import { prisma } from '../lib/db';

async function main() {
    console.log('🧪 Testando lógica da API /api/clientes...');

    // Simulando o que a rota faz
    const tenantId = (await prisma.tenant.findFirst())?.id;
    if (!tenantId) throw new Error('Nenhum tenant encontrado');
    console.log(`Tenant ID usado para teste: ${tenantId}`);

    // Listar TODOS os clientes para verificar tenantId
    const allClientes = await prisma.cliente.findMany();
    console.log(`Total geral de clientes no banco: ${allClientes.length}`);
    for (const c of allClientes) {
        console.log(`- ${c.nome} (Tenant: ${c.tenantId}, Status: ${c.status})`);
    }

    const clientes = await prisma.cliente.findMany({
        where: {
            tenantId,
            status: 'ATIVO'
        },
        orderBy: { nome: 'asc' },
        include: {
            lead: {
                select: {
                    contratoUrl: true,
                    dataAssinatura: true,
                    origem: true
                }
            }
        }
    });

    console.log(`Encontrados ${clientes.length} clientes ativos para o tenant ${tenantId}.`);
}

main().finally(() => prisma.$disconnect());
