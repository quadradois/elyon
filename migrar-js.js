
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrar() {
    console.log('🚀 Iniciando migração total de Leads -> Contatos...');

    try {
        // 1. Verificar campanha padrão
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

        // 2. Buscar Leads
        const leads = await prisma.lead.findMany();
        console.log(`📋 Encontrados ${leads.length} leads para migrar.`);

        if (leads.length === 0) {
            console.log('⚠️ Nenhum lead para migrar.');
            return;
        }

        let migrados = 0;
        let erros = 0;

        for (const lead of leads) {
            try {
                await prisma.contato.create({
                    data: {
                        // Campanha segura
                        campanhaId: lead.campanhaOrigemId || campanhaPadrao.id,

                        // Dados
                        nome: lead.nome,
                        cpf: lead.cpf,
                        telefone: lead.telefone,
                        email: lead.email,

                        // Imóvel
                        enderecoImovel: lead.enderecoImovel,
                        bairroImovel: lead.enderecoPrincipal,
                        tipoImovel: lead.tipoImovel,

                        // Meta
                        observacoes: `Migrado de Lead ID: ${lead.id}. Obs originais: ${lead.observacoesSpin || ''}`,
                        criadoEm: lead.criadoEm,
                        atualizadoEm: lead.atualizadoEm,

                        statusProspeccao: 'AGUARDANDO',
                        fonteEnriquecimento: lead.origem
                    }
                });
                migrados++;
                if (migrados % 50 === 0) console.log(`✅ ${migrados} processados...`);
            } catch (e) {
                console.error(`❌ Falha no Lead ${lead.nome}: ${e.message}`);
                erros++;
            }
        }

        console.log(`\n🎉 Fim. Sucesso: ${migrados} | Erros: ${erros}`);

        if (migrados > 0 && erros === 0) {
            console.log('🧹 Limpando tabela de Leads antiga...');
            await prisma.lead.deleteMany({});
            console.log('✨ Tabela Leads zerada!');
        } else if (erros > 0) {
            console.warn('⚠️ NÃO limpei a tabela Leads pois houve erros. Verifique os logs.');
        }

    } catch (erro) {
        console.error('Erro crítico:', erro);
    } finally {
        await prisma.$disconnect();
    }
}

migrar();
