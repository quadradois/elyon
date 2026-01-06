
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const leadId = '52cc6a08-35b0-42ea-8e07-d0152f183c99';
    console.log(`Searching for lead: ${leadId}...`);

    const lead = await prisma.lead.findUnique({
        where: { id: leadId }
    });

    if (!lead) {
        console.error('Lead not found!');
        return;
    }

    console.log(`Found lead: ${lead.nome} (${lead.id})`);
    console.log(`Current Status: ${lead.status}`);
    console.log(`Current Contract URL: ${lead.contratoUrl}`);

    // Delete existing contracts
    const deleteContracts = await prisma.contrato.deleteMany({
        where: { leadId: lead.id }
    });
    console.log(`Deleted ${deleteContracts.count} contracts.`);

    // Reset Lead fields
    const updatedLead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
            contratoUrl: null,
            dataAssinatura: null,
            vigenciaInicio: null,
            vigenciaFim: null,
            status: 'DOCUMENTACAO',
            ultimaAcaoIA: 'Reset COMPLETO (termos + link) para nova geração',
            ultimaAcaoIAEm: new Date(),
            // Wiping negotiation terms as requested
            tipoAutorizacao: null,
            prazoTrabalho: null,
            comissaoAcordada: null
        }
    });

    console.log(`Lead reset successfully.`);
    console.log(`New Status: ${updatedLead.status}`);
    console.log(`Contract URL: ${updatedLead.contratoUrl}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
