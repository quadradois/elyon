
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Manually load .env
try {
    let envPath = path.resolve(__dirname, '../.env');
    // Function to load env
    const loadEnv = (pathStr: string) => {
        if (fs.existsSync(pathStr)) {
            console.log(`Loading .env from ${pathStr}`);
            const envConfig = fs.readFileSync(pathStr, 'utf8');
            for (const line of envConfig.split('\n')) {
                const [key, ...value] = line.split('=');
                if (key && value) {
                    const val = value.join('=').trim().replace(/^["'](.*)["']$/, '$1');
                    process.env[key.trim()] = val;
                }
            }
        } else {
            console.log(`Env file not found at ${pathStr}`);
        }
    };

    loadEnv(envPath);
    if (!process.env.DATABASE_URL) {
        console.log('DATABASE_URL not found in backend .env, trying root .env');
        envPath = path.resolve(__dirname, '../../../.env');
        loadEnv(envPath);
    }

    console.log('Final DATABASE_URL is set:', !!process.env.DATABASE_URL);

} catch (e) {
    console.error('Error loading .env', e);
}

const prisma = new PrismaClient();

async function main() {
    console.log('Searching for lead "Ivonet"...');
    const leads = await prisma.lead.findMany({
        where: {
            nome: {
                contains: 'ivonet',
                mode: 'insensitive'
            }
        },
        include: {
            atividades: {
                orderBy: { criadoEm: 'desc' },
                take: 5
            }
        }
    });

    if (leads.length === 0) {
        console.log('No lead found with name containing "ivonet".');
    } else {
        console.log(`Found ${leads.length} leads.`);
        for (const lead of leads) {
            console.log('------------------------------------------------');
            console.log(`ID: ${lead.id}`);
            console.log(`Name: ${lead.nome}`);
            console.log(`Status: ${lead.status}`);
            console.log(`Stage (Estágio): ${lead.estagio}`);
            console.log(`Temperature: ${lead.temperatura}`);
            console.log(`Contract Info:`);
            console.log(`  - Type: ${lead.tipoAutorizacao}`);
            console.log(`  - Commission: ${lead.comissaoAcordada}`);
            console.log(`  - Term: ${lead.prazoTrabalho}`);
            console.log(`  - URL: ${lead.contratoUrl}`);
            console.log(`Contact Info:`);
            console.log(`  - CPF: ${lead.cpf}`);
            console.log(`  - Email: ${lead.email}`);
            console.log(`  - Address: ${lead.enderecoPrincipal}`);
            console.log(`Last Interaction: ${lead.ultimaInteracao}`);
            console.log(`Recent Activities:`);
            for (const activity of lead.atividades) {
                console.log(`  - [${activity.tipo}] ${activity.titulo} (${activity.criadoEm.toISOString()})`);
            }
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
