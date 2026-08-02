import crypto from 'crypto';
import { prisma } from '../lib/db';
import { ServicoAuditoria } from './servico-auditoria';
import { resolverEspecialistaCampanha } from './resolucao-especialista-campanha';
import { AGENDA_COMMERCIAL_POLICY_VERSION, executarComandoAgenda } from './coerencia-agenda-estado';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost';

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
    || !['PENDENTE', 'SOLICITADO', 'PROPOSTO'].includes(atividade.statusAgendamento || '')
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
  if (!especialista.usuarioId) return { sucesso: false, motivo: 'SEM_SUBSTITUTO' };
  const link = `${FRONTEND_URL}/confirmar-corretor/${atividade.id}/${novoToken}`;
  const command = await executarComandoAgenda({
    operacao: 'SOLICITAR', tenantId: atividade.lead.tenantId, leadId: atividade.lead.id, atividadeId: atividade.id,
    requestIdentity: { source: 'WORKER', id: `reatribuicao:${atividade.id}:${atividade.versao}:${especialista.usuarioId}` },
    ator: 'agenda-assignment-worker', origem: `REMANEJAMENTO_${params.origem}`,
    motivo: 'Solicitação de substituição do especialista', policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION,
    ocorridoEm: agora, expectedVersion: atividade.versao, manifestacaoLead: 'HORARIO_ACEITO',
    responsavelId: especialista.usuarioId, tokenConfirmacaoCorretor: novoToken,
    notificacoes: [
      {
        tipo: 'SUBSTITUICAO', destinatarioTipo: 'USUARIO', usuarioDestinoId: especialista.usuarioId,
        mensagem: [
          'Elyon | Solicitação de substituição',
          `Lead: ${atividade.lead.nome}`,
          `Atendimento: ${new Date(atividade.agendadoPara).toLocaleString('pt-BR')}`,
          `Confirme sua disponibilidade: ${link}`,
        ].join('\n'),
      },
      {
        tipo: 'SUBSTITUICAO', destinatarioTipo: 'LEAD',
        mensagem: `Precisamos substituir o especialista do seu atendimento. ${especialista.nome} recebeu a solicitação para o mesmo horário; avisaremos por aqui assim que houver confirmação.`,
      },
    ],
  });
  if (!command.success) return { sucesso: false, motivo: 'CONCORRENCIA' };

  const notificacaoEspecialistaEnviada = false;
  const notificacaoLeadEnviada = false;

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
      notificacaoEspecialistaEnfileirada: true,
      notificacaoLeadEnfileirada: true,
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
