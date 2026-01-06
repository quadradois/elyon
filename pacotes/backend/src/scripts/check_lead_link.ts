
import { prisma } from '../lib/db';

async function main() {
    console.log('🔎 Verificando link Cliente -> Lead...');

    // Buscar Ivonet
    const cliente = await prisma.cliente.findFirst({
        where: { nome: { contains: 'Ivonet' } }
    });

    if (!cliente) {
        console.error('❌ Cliente Ivonet não encontrado.');
        return;
    }

    console.log(`Cliente: ${cliente.nome} (ID: ${cliente.id})`);
    console.log(`Origem Lead ID: ${cliente.origemLeadId}`);

    if (!cliente.origemLeadId) {
        console.error('❌ origemLeadId está NULO!');
        return;
    }

    // Verificar se lead existe
    const lead = await prisma.lead.findUnique({
        where: { id: cliente.origemLeadId }
    });

    if (lead) {
        console.log(`✅ Lead encontrado: ${lead.nome} (Status: ${lead.status})`);
        console.log(`Tenant ID do Lead: ${lead.tenantId}`);
        console.log(`Tenant ID do Cliente: ${cliente.tenantId}`);

        if (lead.tenantId !== cliente.tenantId) {
            console.error('⚠️ ALERTA: Tenant IDs diferentes!');
        }
    } else {
        console.error('❌ Lead NÃO encontrado no banco (provavelmente deletado?)');
    }
}

main().finally(() => prisma.$disconnect());
