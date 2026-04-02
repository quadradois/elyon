const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    try {
        // Buscar sessão e agente
        const sessao = await prisma.sessaoWhatsapp.findFirst({
            where: { instanceName: 'elyon_3b5f4a6a_teste' }
        });

        const agente = await prisma.configuracaoAgente.findFirst({
            where: { tenantId: '3b5f4a6a-6f10-472c-8774-6406b106dcb4' }
        });

        if (!sessao) {
            console.log('Sessão não encontrada!');
            return;
        }

        console.log('Sessão ID:', sessao.id);
        console.log('Agente ID:', agente?.id);

        // 1. Atualizar sessão com webhook URL
        const updatedSessao = await prisma.sessaoWhatsapp.update({
            where: { id: sessao.id },
            data: {
                webhookUrl: 'http://elyon_backend:3000/webhooks'
            }
        });

        console.log('\n✅ Sessão atualizada!');
        console.log('Webhook URL:', updatedSessao.webhookUrl);

        // 2. Vincular agente à sessão (via ConfiguracaoAgente.sessaoWhatsappId)
        if (agente) {
            const updatedAgente = await prisma.configuracaoAgente.update({
                where: { id: agente.id },
                data: {
                    sessaoWhatsappId: sessao.id,
                    nome: agente.nome || 'Assistente Elyon',
                    status: 'ATIVO',
                    estaAtivo: true
                }
            });

            console.log('\n✅ Agente atualizado!');
            console.log('Nome:', updatedAgente.nome);
            console.log('Status:', updatedAgente.status);
            console.log('Ativo:', updatedAgente.estaAtivo);
            console.log('Vinculado à Sessão:', updatedAgente.sessaoWhatsappId);
        }

    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

fix();
