import { createHash } from 'node:crypto';
import { prisma } from '../lib/db';
import { resolverAgendaPilotConfig } from '../servicos/agenda-pilot-config';
import { formatarDataHoraAgenda } from '../servicos/notificacao-agendamento';

function hash(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export async function executarLembretesProximidadeAgendamento(
  agora = new Date(),
): Promise<{ processados: number; enfileirados: number; erros: number }> {
  const config = await resolverAgendaPilotConfig();
  if (!config.scope || !config.effects.enabled || !config.specialistCopilot?.enabled) {
    return { processados: 0, enfileirados: 0, erros: 0 };
  }
  const antecedencia = Math.max(5, Math.min(24 * 60, Number(process.env.AGENDA_REMINDER_MINUTES || 60)));
  const inicio = new Date(agora.getTime() + (antecedencia - 2) * 60_000);
  const fim = new Date(agora.getTime() + (antecedencia + 2) * 60_000);
  const atividades = await prisma.atividade.findMany({
    where: {
      tipo: 'REUNIAO', statusAgendamento: 'CONFIRMADO', statusConfirmacaoCorretor: 'CONFIRMADO',
      corretorAtualId: { not: null }, agendadoPara: { gte: inicio, lte: fim },
      lead: { tenantId: config.scope.tenantId },
    },
    include: { lead: { select: { id: true, nome: true, tenantId: true } } },
    take: 100,
  });
  let enfileirados = 0;
  let erros = 0;
  for (const atividade of atividades) {
    try {
      if (!atividade.agendadoPara || !atividade.corretorAtualId) continue;
      const dataHora = formatarDataHoraAgenda(atividade.agendadoPara);
      const base = `appointment-reminder:${atividade.id}:v${atividade.versao}:${antecedencia}`;
      const result = await prisma.efeitoAgendaOutbox.createMany({
        data: [
          {
            chaveComando: base, chaveIdempotencia: hash([base, 'LEAD']), tenantId: atividade.lead.tenantId,
            leadId: atividade.lead.id, atividadeId: atividade.id, tipo: 'LEMBRETE_ATENDIMENTO',
            mensagem: `Lembrete: seu atendimento por telefone com o especialista será ${dataHora}. Se precisar alterar, avise por aqui.`,
            destinatarioTipo: 'LEAD', correlationId: base,
          },
          {
            chaveComando: base, chaveIdempotencia: hash([base, 'USUARIO', atividade.corretorAtualId]),
            tenantId: atividade.lead.tenantId, leadId: atividade.lead.id, atividadeId: atividade.id,
            tipo: 'LEMBRETE_ATENDIMENTO', mensagem: `Lembrete: seu atendimento com ${atividade.lead.nome} será ${dataHora}.`,
            destinatarioTipo: 'USUARIO', usuarioDestinoId: atividade.corretorAtualId, correlationId: base,
          },
        ],
        skipDuplicates: true,
      });
      enfileirados += result.count;
    } catch {
      erros += 1;
    }
  }
  return { processados: atividades.length, enfileirados, erros };
}
