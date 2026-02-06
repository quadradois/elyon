
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTenant() {
    const tenantId = '7de90821-c5b9-4d68-ba9a-bcf57e0035e7';
    console.log(`Checking tenant: ${tenantId}`);

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
    });

    console.log('Tenant:', tenant);

    if (tenant) {
        const users = await prisma.usuario.findMany({
            where: { tenantId: tenant.id }
        });
        console.log('Users:', users.map(u => ({ id: u.id, email: u.email, papel: u.papel })));
    }
}

checkTenant()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
