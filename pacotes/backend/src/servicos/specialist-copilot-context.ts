import { createHash } from 'node:crypto';
import { prisma } from '../lib/db';
import { normalizarTelefone } from '../utils/telefone';

export type SpecialistIdentity = { id: string; tenantId: string; nome: string; telefone: string };
export type SpecialistInviteContext = {
  conviteId: string;
  atividadeId: string;
  usuarioId: string;
  tenantId: string;
  tentativa: number;
  prazoEm: Date;
  leadId: string;
  leadNome: string;
  agendadoPara: Date;
  versaoAtividade: number;
};

export type SpecialistFeedbackContext = {
  feedbackId: string;
  atividadeId: string;
  usuarioId: string;
  tenantId: string;
  leadId: string;
  leadNome: string;
  agendadoPara: Date;
  versaoAtividade: number;
  status: string;
};

export function hashTokenConvite(token: string | null | undefined): string | null {
  return token ? createHash('sha256').update(token).digest('hex') : null;
}

export async function resolverEspecialistaPorTelefone(tenantId: string, telefone: string): Promise<SpecialistIdentity | null> {
  const normalizado = normalizarTelefone(telefone);
  const sufixo = normalizado.slice(-8);
  if (sufixo.length !== 8) return null;
  const candidatos = await prisma.$queryRaw<Array<SpecialistIdentity>>`
    SELECT "id", "tenantId", "nome", "telefone"
    FROM "usuarios"
    WHERE "tenantId" = ${tenantId}
      AND "estaAtivo" = true
      AND "telefone" IS NOT NULL
      AND RIGHT(REGEXP_REPLACE("telefone", '[^0-9]', '', 'g'), 8) = ${sufixo}
    LIMIT 2
  `;
  return candidatos.length === 1 ? candidatos[0] : null;
}

async function materializarConviteLegado(identity: SpecialistIdentity, agora: Date): Promise<void> {
  const atividade = await (prisma.atividade as any).findFirst({
    where: {
      corretorAtualId: identity.id,
      statusConfirmacaoCorretor: 'PENDENTE',
      statusAgendamento: { in: ['PENDENTE', 'SOLICITADO', 'PROPOSTO', 'CONFIRMADO'] },
      agendadoPara: { gt: agora },
      lead: { tenantId: identity.tenantId },
    },
    orderBy: { confirmacaoCorretorSolicitadaEm: 'desc' },
    select: {
      id: true, tokenConfirmacaoCorretor: true, confirmacaoCorretorSolicitadaEm: true,
      agendadoPara: true,
    },
  });
  if (!atividade?.confirmacaoCorretorSolicitadaEm) return;
  const prazoPadrao = new Date(atividade.confirmacaoCorretorSolicitadaEm.getTime() + 60 * 60 * 1000);
  const prazoEm = new Date(Math.min(prazoPadrao.getTime(), atividade.agendadoPara.getTime()));
  await (prisma.conviteEspecialistaAgenda as any).upsert({
    where: { atividadeId_tentativa: { atividadeId: atividade.id, tentativa: 1 } },
    create: {
      tenantId: identity.tenantId, atividadeId: atividade.id, usuarioId: identity.id, tentativa: 1,
      status: 'PENDENTE', tokenHash: hashTokenConvite(atividade.tokenConfirmacaoCorretor),
      solicitadoEm: atividade.confirmacaoCorretorSolicitadaEm, prazoEm,
    },
    update: {},
  });
}

export async function buscarConvitesAcionaveis(identity: SpecialistIdentity, agora = new Date()): Promise<SpecialistInviteContext[]> {
  let convites = await (prisma.conviteEspecialistaAgenda as any).findMany({
    where: { tenantId: identity.tenantId, usuarioId: identity.id, status: 'PENDENTE', prazoEm: { gt: agora } },
    orderBy: { solicitadoEm: 'desc' }, take: 5,
  });
  if (!convites.length) {
    await materializarConviteLegado(identity, agora);
    convites = await (prisma.conviteEspecialistaAgenda as any).findMany({
      where: { tenantId: identity.tenantId, usuarioId: identity.id, status: 'PENDENTE', prazoEm: { gt: agora } },
      orderBy: { solicitadoEm: 'desc' }, take: 5,
    });
  }
  const atividades = await prisma.atividade.findMany({
    where: {
      id: { in: convites.map((item: any) => item.atividadeId) },
      lead: { tenantId: identity.tenantId },
    },
    include: { lead: { select: { id: true, nome: true } } },
  });
  const porId = new Map(atividades.map((item) => [item.id, item]));
  return convites.flatMap((convite: any) => {
    const atividade = porId.get(convite.atividadeId);
    if (!atividade?.agendadoPara || atividade.corretorAtualId !== identity.id) return [];
    if (!['PENDENTE', 'SOLICITADO', 'PROPOSTO', 'CONFIRMADO'].includes(atividade.statusAgendamento || '')) return [];
    return [{
      conviteId: convite.id, atividadeId: atividade.id, usuarioId: identity.id, tenantId: identity.tenantId,
      tentativa: convite.tentativa, prazoEm: convite.prazoEm, leadId: atividade.lead.id,
      leadNome: atividade.lead.nome, agendadoPara: atividade.agendadoPara, versaoAtividade: atividade.versao,
    }];
  });
}

export function descreverConvitesParaDesambiguacao(convites: SpecialistInviteContext[]): string {
  const itens = convites.slice(0, 3).map((item, index) => {
    const horario = item.agendadoPara.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    return `${index + 1}. ${item.leadNome} — ${horario}`;
  });
  return `Encontrei mais de uma solicitação. Responda com o número correspondente:\n${itens.join('\n')}`;
}

export async function buscarFeedbacksPosAtendimentoAcionaveis(
  identity: SpecialistIdentity,
  agora = new Date(),
): Promise<SpecialistFeedbackContext[]> {
  const feedbacks = await prisma.feedbackPosAtendimentoAgenda.findMany({
    where: {
      tenantId: identity.tenantId,
      usuarioId: identity.id,
      status: { in: ['AGUARDANDO_RESPOSTA', 'PENDENCIA_GESTOR'] },
      criadoEm: { gte: new Date(agora.getTime() - 7 * 24 * 60 * 60_000) },
    },
    include: { atividade: { include: { lead: { select: { id: true, nome: true } } } } },
    orderBy: { enviadoEm: 'desc' },
    take: 5,
  });
  return feedbacks.flatMap((feedback) => {
    const atividade = feedback.atividade;
    if (!atividade.agendadoPara || atividade.corretorAtualId !== identity.id) return [];
    if (atividade.statusAgendamento !== 'CONFIRMADO' || atividade.versao !== feedback.versaoAtividade) return [];
    return [{
      feedbackId: feedback.id, atividadeId: atividade.id, usuarioId: identity.id,
      tenantId: identity.tenantId, leadId: atividade.lead.id, leadNome: atividade.lead.nome,
      agendadoPara: atividade.agendadoPara, versaoAtividade: feedback.versaoAtividade,
      status: feedback.status,
    }];
  });
}

export function descreverFeedbacksParaDesambiguacao(feedbacks: SpecialistFeedbackContext[]): string {
  const itens = feedbacks.slice(0, 3).map((item, index) => {
    const horario = item.agendadoPara.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    return `${index + 1}. ${item.leadNome} — ${horario}`;
  });
  return `Encontrei mais de um atendimento aguardando feedback. Responda “atendimento 1”, “atendimento 2” ou “atendimento 3” junto com o resultado:\n${itens.join('\n')}`;
}

export async function buscarCompromissosConfirmadosEspecialista(
  identity: SpecialistIdentity,
  agora = new Date(),
): Promise<SpecialistInviteContext[]> {
  const atividades = await prisma.atividade.findMany({
    where: {
      corretorAtualId: identity.id, statusAgendamento: 'CONFIRMADO', statusConfirmacaoCorretor: 'CONFIRMADO',
      agendadoPara: { gt: agora }, lead: { tenantId: identity.tenantId },
    },
    include: { lead: { select: { id: true, nome: true } } },
    orderBy: { agendadoPara: 'asc' }, take: 5,
  });
  return atividades.flatMap((atividade) => atividade.agendadoPara ? [{
    conviteId: '', atividadeId: atividade.id, usuarioId: identity.id, tenantId: identity.tenantId,
    tentativa: 0, prazoEm: atividade.agendadoPara, leadId: atividade.lead.id,
    leadNome: atividade.lead.nome, agendadoPara: atividade.agendadoPara, versaoAtividade: atividade.versao,
  }] : []);
}
