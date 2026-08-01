import crypto from 'crypto';
import { prisma } from '../lib/db';
import { getWhatsAppService } from './whatsapp';
import { ServicoAuditoria } from './servico-auditoria';
import { resolverEspecialistaCampanha } from './resolucao-especialista-campanha';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost';

function normalizarTelefoneParaWaMe(telefone?: string | null): string {
  const digits = (telefone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export type ResultadoRemanejamentoCorretor = {
  sucesso: boolean;
  motivo: 'REMANEJADO' | 'SEM_SUBSTITUTO' | 'ESTADO_INVALIDO' | 'CONCORRENCIA';
  especialistaNome?: string;
  especialistaId?: string;
  notificacaoEspecialistaEnviada?: boolean;
  notificacaoLeadEnviada?: boolean;
};

export async function remanejarCorretorAtividade(params: {
  atividadeId: string;
  origem: 'RECUSA_EXPLICITA' | 'CUTOFF';
}): Promise<ResultadoRemanejamentoCorretor> {
  const atividade = await (prisma.atividade as any).findUnique({
    where: { id: params.atividadeId },
    include: {
      lead: {
        select: {
          id: true,
          nome: true,
          telefone: true,
          tenantId: true,
          campanhaOrigemId: true,
        }
      }
    }
  });

  if (!atividade
    || atividade.tipo !== 'REUNIAO'
    || !['PENDENTE', 'CONFIRMADO'].includes(atividade.statusAgendamento || '')
    || !['RECUSADO', 'EXPIRADO'].includes(atividade.statusConfirmacaoCorretor || '')
    || !atividade.lead?.campanhaOrigemId) {
    return { sucesso: false, motivo: 'ESTADO_INVALIDO' };
  }

  const excluirUsuarioIds = [...new Set(
    [atividade.corretorOriginalId, atividade.corretorAtualId]
      .filter((id: string | null | undefined): id is string => Boolean(id))
  )];
  const especialista = await resolverEspecialistaCampanha({
    tenantId: atividade.lead.tenantId,
    campanhaId: atividade.lead.campanhaOrigemId,
    excluirUsuarioIds,
  });
  if (!especialista) return { sucesso: false, motivo: 'SEM_SUBSTITUTO' };

  const agora = new Date();
  const novoToken = crypto.randomUUID();
  const atualizado = await (prisma.atividade as any).updateMany({
    where: {
      id: atividade.id,
      versao: atividade.versao,
      statusAgendamento: { in: ['PENDENTE', 'CONFIRMADO'] },
      statusConfirmacaoCorretor: { in: ['RECUSADO', 'EXPIRADO'] },
    },
    data: {
      statusConfirmacaoCorretor: 'PENDENTE',
      tokenConfirmacaoCorretor: novoToken,
      confirmacaoCorretorSolicitadaEm: null,
      lembreteCorretorEnviadoEm: null,
      confirmadoCorretorEm: null,
      expiradoCorretorEm: null,
      remanejadoCorretorEm: agora,
      corretorOriginalId: atividade.corretorOriginalId || atividade.corretorAtualId || null,
      corretorAtualId: especialista.usuarioId || null,
      versao: { increment: 1 },
      estadoAgendaAtualizadoEm: agora,
    }
  });
  if (atualizado.count !== 1) return { sucesso: false, motivo: 'CONCORRENCIA' };

  let notificacaoEspecialistaEnviada = false;
  let notificacaoLeadEnviada = false;
  try {
    const sessao = await prisma.sessaoWhatsapp.findFirst({
      where: { tenantId: atividade.lead.tenantId, status: 'CONECTADO' },
      orderBy: { atualizadoEm: 'desc' },
      select: { instanceName: true }
    });

    if (sessao?.instanceName) {
      const whatsapp = getWhatsAppService(sessao.instanceName);
      const telEspecialista = normalizarTelefoneParaWaMe(especialista.telefone);
      const telLead = normalizarTelefoneParaWaMe(atividade.lead.telefone);
      if (telEspecialista) {
        try {
          const link = `${FRONTEND_URL}/confirmar-corretor/${atividade.id}/${novoToken}`;
          await whatsapp.enviarMensagemTexto(
            telEspecialista,
            [
              'Elyon | Solicitação de substituição',
              `Lead: ${atividade.lead.nome}`,
              `Atendimento: ${new Date(atividade.agendadoPara).toLocaleString('pt-BR')}`,
              `Confirme sua disponibilidade: ${link}`,
            ].join('\n')
          );
          notificacaoEspecialistaEnviada = true;
          await (prisma.atividade as any).update({
            where: { id: atividade.id },
            data: { confirmacaoCorretorSolicitadaEm: agora }
          });
        } catch {
          notificacaoEspecialistaEnviada = false;
        }
      }
      if (telLead) {
        try {
          await whatsapp.enviarMensagemTexto(
            telLead,
            `Precisamos substituir o especialista do seu atendimento. ${especialista.nome} recebeu a solicitação para o mesmo horário; avisaremos por aqui assim que houver confirmação.`
          );
          notificacaoLeadEnviada = true;
        } catch {
          notificacaoLeadEnviada = false;
        }
      }
    }
  } catch {
    // O estado persistido permanece pendente para uma tentativa posterior do job.
  }

  ServicoAuditoria.registrar({
    tenantId: atividade.lead.tenantId,
    acao: 'REMANEJAMENTO_CORRETOR_AUTO',
    entidade: 'Atividade',
    entidadeId: atividade.id,
    ip: '127.0.0.1',
    detalhes: {
      leadId: atividade.lead.id,
      origem: params.origem,
      corretorAnteriorId: atividade.corretorAtualId || null,
      corretorAtualId: especialista.usuarioId || null,
      especialistaOrigem: especialista.origem,
      notificacaoEspecialistaEnviada,
      notificacaoLeadEnviada,
    }
  });

  return {
    sucesso: true,
    motivo: 'REMANEJADO',
    especialistaNome: especialista.nome,
    especialistaId: especialista.usuarioId,
    notificacaoEspecialistaEnviada,
    notificacaoLeadEnviada,
  };
}
