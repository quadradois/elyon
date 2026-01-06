
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrar() {
    console.log('🚀 Iniciando migração total de Leads -> Contatos...');

    try {
        // 1. Verificar campanha padrão para leads sem campanha
        let campanhaPadrao = await prisma.campanha.findFirst({
            where: { nome: 'Migração Legada' }
        });

        if (!campanhaPadrao) {
            console.log('📦 Criando campanha padrão de migração...');
            const tenant = await prisma.tenant.findFirst();
            if (!tenant) throw new Error('Nenhum Tenant encontrado!');

            campanhaPadrao = await prisma.campanha.create({
                data: {
                    nome: 'Migração Legada',
                    descricao: 'Contatos migrados da tabela antiga de Leads',
                    tenantId: tenant.id,
                    tipo: 'MIGRACAO'
                }
            });
        }

        // 2. Buscar todos os Leads
        const leads = await prisma.lead.findMany();
        console.log(`📋 Encontrados ${leads.length} leads para migrar.`);

        let migrados = 0;
        let erros = 0;

        for (const lead of leads) {
            try {
                // Mapear dados do Lead para Contato
                await prisma.contato.create({
                    data: {
                        // Vínculos
                        campanhaId: lead.campanhaOrigemId || campanhaPadrao.id,

                        // Dados Básicos
                        nome: lead.nome,
                        cpf: lead.cpf,
                        telefone: lead.telefone,
                        email: lead.email,

                        // Dados do Lead (preservar histórico)
                        enderecoImovel: lead.enderecoImovel,
                        bairroImovel: lead.enderecoPrincipal, // Fallback
                        tipoImovel: lead.tipoImovel,

                        // Metadata
                        observacoes: `Migrado de Lead ID: ${lead.id}. Obs originais: ${lead.observacoesSpin || ''}`,
                        criadoEm: lead.criadoEm,
                        atualizadoEm: lead.atualizadoEm,

                        // Status (Resetar para inicio do funil SDR)
                        statusProspeccao: 'AGUARDANDO',
                        fonteEnriquecimento: lead.origem
                    }
                });
                migrados++;
                if (migrados % 100 === 0) console.log(`✅ ${migrados} migrados...`);
            } catch (e) {
                console.error(`❌ Erro ao migrar Lead ID ${lead.id}:`, (e as Error).message);
                erros++;
            }
        }

        console.log(`\n🎉 Migração Concluída!`);
        console.log(`✅ Sucesso: ${migrados}`);
        console.log(`❌ Erros: ${erros}`);

        if (migrados > 0 && erros === 0) {
            console.log('🧹 Limpando tabela de Leads antiga...');
            await prisma.lead.deleteMany({});
            console.log('✨ Tabela Leads zerada com sucesso!');
        } else {
            console.warn('⚠️ A tabela Leads NÃO foi limpa devido a erros ou falta de dados.');
        }

    } catch (erro) {
        console.error('Erro crítico:', erro);
    } finally {
        await prisma.$disconnect();
    }
}

migrar();
