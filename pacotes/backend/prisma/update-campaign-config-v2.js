
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const campanhaId = "d0b0ea84-732c-445a-9eef-785f46de35f8"; // Target ID

    // Texto novo alinhado com o Playbook "Quebra de Gelo"
    // Mantendo variáveis {nome} e {agente} para o parser do backend
    const novoTemplate = "Olá {nome}! Me chamo {agente}, sou corretor de imóveis.\n\nEstou divulgando lançamento de chácaras a 54km de Goiânia, na beira do Rio dos Bois. Parcelas de R$ 799 fixas, sem consulta SPC.\n\nVocê tem interesse ou conhece alguém que possa se interessar? 😊";

    console.log(`Atualizando configDisparo da Campanha ID: ${campanhaId}...`);

    try {
        // 1. Buscar campanha atual para preservar config existente
        const campanha = await prisma.campanha.findUnique({
            where: { id: campanhaId }
        });

        if (!campanha) {
            console.error("Campanha não encontrada!");
            return;
        }

        console.log("Config Atual:", JSON.stringify(campanha.configDisparo, null, 2));

        // 2. Mesclar config
        const novaConfig = {
            ...(campanha.configDisparo || {}),
            templatePrimeiraMensagem: novoTemplate
        };

        // 3. Update
        const atualizada = await prisma.campanha.update({
            where: { id: campanhaId },
            data: {
                configDisparo: novaConfig
            }
        });

        console.log("✅ Campanha atualizada com sucesso!");
        console.log("Nova Config:", JSON.stringify(atualizada.configDisparo, null, 2));

    } catch (e) {
        console.error("Erro ao atualizar campanha:", e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
