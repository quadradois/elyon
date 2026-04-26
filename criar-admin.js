const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function criarAdmin() {
    const prisma = new PrismaClient();

    try {
        // Criar tenant se não existir
        let tenant = await prisma.tenant.findFirst({ where: { slug: 'elyon' } });

        if (!tenant) {
            tenant = await prisma.tenant.create({
                data: {
                    nome: 'Elyon',
                    slug: 'elyon',
                    status: 'ATIVO',
                }
            });
            console.log('Tenant criado:', tenant.id);
        } else {
            console.log('Tenant existente:', tenant.id);
        }

        // Criar usuário admin
        const existeAdmin = await prisma.usuario.findFirst({
            where: { tenantId: tenant.id, email: 'admin@elyon.ia.br' }
        });

        if (!existeAdmin) {
            const senhaHash = await bcrypt.hash('@Epbaa090384!@#$', 10);
            const admin = await prisma.usuario.create({
                data: {
                    tenantId: tenant.id,
                    email: 'admin@elyon.ia.br',
                    nome: 'Elyon Admin',
                    senha: senhaHash,
                    papel: 'SUPER_ADMIN',
                    estaAtivo: true
                }
            });
            console.log('Super Admin criado:', admin.email);
        } else {
            console.log('Admin já existe:', existeAdmin.email);
        }

        await prisma.$disconnect();
    } catch (error) {
        console.error('Erro:', error.message);
        process.exit(1);
    }
}

criarAdmin();
