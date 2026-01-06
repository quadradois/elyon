
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const prisma = new PrismaClient();

async function main() {
    console.log('🔎 Verificando tabela Cliente...');
    const clientes = await prisma.cliente.findMany();
    console.log(`Total de clientes: ${clientes.length}`);

    for (const c of clientes) {
        console.log(`- ${c.nome} (CPF: ${c.cpf}) - Origem Lead: ${c.origemLeadId}`);
    }
}

main().finally(() => prisma.$disconnect());
