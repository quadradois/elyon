import { prisma } from '../lib/db';

/**
 * Cascade delete de leads e todas as dependências
 *
 * Ordem de exclusão:
 * 1. Contratos
 * 2. Mensagens (via conversas)
 * 3. Conversas
 * 4. Ledger e milestones de agenda
 * 5. Atividades
 * 6. Desvincular clientes (origemLeadId → null)
 * 7. Desvincular imóveis (leadId → null)
 * 8. Leads
 */
export async function cascadeDeleteLeads(leadIds: string[]): Promise<void> {
  if (leadIds.length === 0) return;

  // 1. Deletar contratos
  await prisma.contrato.deleteMany({
    where: { leadId: { in: leadIds } },
  });

  // 2. Buscar conversas para deletar mensagens
  const conversas = await prisma.conversa.findMany({
    where: { leadId: { in: leadIds } },
    select: { id: true },
  });
  const conversaIds = conversas.map((c: { id: string }) => c.id);

  if (conversaIds.length > 0) {
    await prisma.mensagem.deleteMany({
      where: { conversaId: { in: conversaIds } },
    });
  }

  // 3. Deletar conversas
  await prisma.conversa.deleteMany({
    where: { leadId: { in: leadIds } },
  });

  // 4. Preservados durante a vida do tenant; removidos apenas na exclusão explícita do Lead.
  await prisma.comandoAgendaLedger.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.milestoneAgenda.deleteMany({ where: { leadId: { in: leadIds } } });

  // 5. Deletar atividades
  await prisma.atividade.deleteMany({
    where: { leadId: { in: leadIds } },
  });

  // 6. Desvincular clientes
  await prisma.cliente.updateMany({
    where: { origemLeadId: { in: leadIds } },
    data: { origemLeadId: null },
  });

  // 7. Desvincular imóveis
  await prisma.imovel.updateMany({
    where: { leadId: { in: leadIds } },
    data: { leadId: null },
  });

  // 8. Deletar leads
  await prisma.lead.deleteMany({
    where: { id: { in: leadIds } },
  });
}
