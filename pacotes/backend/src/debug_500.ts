
import { prisma } from './lib/db';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log('--- DIAGNOSTIC SCRIPT (TS) ---');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('EVOLUTION_API_URL:', process.env.EVOLUTION_API_URL ? 'DEFINED' : 'MISSING');
    console.log('EVOLUTION_API_KEY:', process.env.EVOLUTION_API_KEY ? 'DEFINED' : 'MISSING');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'DEFINED' : 'MISSING');

    try {
        console.log('Testing DB connection (count)...');
        const count = await prisma.tenant.count();
        console.log('DB Connection OK. Tenant count:', count);
    } catch (err: any) {
        console.error('DB Connection FAILED:', err.message);
    }

    try {
        console.log('Testing specific query (findFirst tenant)...');
        const tenant = await prisma.tenant.findFirst();
        if (tenant) {
            console.log('Found tenant:', tenant.id);

            console.log('Testing Billing Query (findUnique)...');
            const billing = await prisma.tenant.findUnique({
                where: { id: tenant.id },
                select: { creditosMensais: true }
            });
            console.log('Billing Query OK:', billing);

        } else {
            console.log('No tenants found.');
        }
    } catch (err: any) {
        console.error('Query FAILED:', err.message);
    }

    console.log('--- END DIAGNOSTIC ---');
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
