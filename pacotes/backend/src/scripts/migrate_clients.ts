
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Iniciando migração de Leads CAPTADO para tabela Cliente...');

    try {
        // 1. Buscar leads CAPTADO
        const leadsCaptados = await prisma.lead.findMany({
            where: {
                status: 'CAPTADO'
            }
        });

        console.log(`📊 Encontrados ${leadsCaptados.length} leads com status CAPTADO.`);

        let criados = 0;
        let ignorados = 0;
        let erros = 0;

        for (const lead of leadsCaptados) {
            try {
                // Verificar se já existe cliente vinculado
                const clienteExistente = await prisma.cliente.findUnique({
                    where: { origemLeadId: lead.id }
                });

                if (clienteExistente) {
                    console.log(`⚠️ Cliente já existe para lead ${lead.nome} (${lead.id}). Ignorando.`);
                    ignorados++;
                    continue;
                }

                // Criar cliente
                await prisma.cliente.create({
                    data: {
                        tenantId: lead.tenantId,
                        nome: lead.nome,
                        cpf: lead.cpf,
                        email: lead.email,
                        telefone: lead.telefone,
                        endereco: lead.enderecoPrincipal,
                        origemLeadId: lead.id,
                        status: 'ATIVO',
                        criadoEm: lead.dataAssinatura || new Date()
                    }
                });

                console.log(`✅ Cliente criado para ${lead.nome}`);
                criados++;

            } catch (err) {
                console.error(`❌ Erro ao processar lead ${lead.id}:`, err);
                erros++;
            }
        }

        console.log('\n🏁 Migração concluída!');
        console.log(`✨ Criados: ${criados}`);
        console.log(`⏭️ Ignorados (já existiam): ${ignorados}`);
        console.log(`❌ Erros: ${erros}`);

    } catch (error) {
        console.error('Falha fatal na migração:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
