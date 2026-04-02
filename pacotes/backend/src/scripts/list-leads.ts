
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Listing last 5 leads...');
    const leads = await prisma.lead.findMany({
        take: 5,
        orderBy: { criadoEm: 'desc' },
        select: { id: true, nome: true, status: true, contratoUrl: true, telefone: true }
    });

    console.log(JSON.stringify(leads, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
