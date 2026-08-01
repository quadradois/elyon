import { prisma } from '../lib/db';
import { getWhatsAppService } from '../servicos/whatsapp';
import { ServicoAuditoria } from '../servicos/servico-auditoria';
import { resolverEspecialistaCampanha } from '../servicos/resolucao-especialista-campanha';
import { remanejarCorretorAtividade } from '../servicos/remanejamento-corretor';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost';

function normalizarTelefoneParaWaMe(telefone?: string | null): string {
  const digits = (telefone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function minutosAntes(data: Date, minutos: number): Date {
  return new Date(new Date(data).getTime() - minutos * 60 * 1000);
}

function linkConfirmacaoCorretor(atividadeId: string, token: string): string {
  return `${FRONTEND_URL}/confirmar-corretor/${atividadeId}/${token}`;
}

function templateConvite(params: { leadNome: string; horario: Date; link: string }): string {
  return [
    'Elyon | Convite de confirmação',
    `Lead: ${params.leadNome}`,
    `Reunião: ${new Date(params.horario).toLocaleString('pt-BR')}`,
    `Confirme até 1h antes: ${params.link}`,
  ].join('\n');
}

function templateLembrete(params: { leadNome: string; horario: Date; link: string }): string {
  return [
    'Elyon | Lembrete de confirmação (T-90)',
    `Lead: ${params.leadNome}`,
    `Reunião: ${new Date(params.horario).toLocaleString('pt-BR')}`,
    `Prazo de confirmação: até T-60`,
    params.link,
  ].join('\n');
}

async function buscarSessaoConectadaTenant(tenantId: string): Promise<string | null> {
  const sessao = await prisma.sessaoWhatsapp.findFirst({
    where: { tenantId, status: 'CONECTADO' },
    orderBy: { atualizadoEm: 'desc' },
    select: { instanceName: true }
  });
  return sessao?.instanceName || null;
}

export async function executarConvitesConfirmacaoCorretor(): Promise<{ processados: number; enviados: number; erros: number }> {
  const agora = new Date();
  const janelaInicio = minutosAntes(agora, -120); // agora +120
  const janelaFim = minutosAntes(agora, -110); // agora +110

  const atividades = await (prisma.atividade as any).findMany({
    where: {
      tipo: 'REUNIAO',
      statusAgendamento: { in: ['PENDENTE', 'CONFIRMADO'] },
      statusConfirmacaoCorretor: 'PENDENTE',
      agendadoPara: { gte: janelaFim, lte: janelaInicio },
      confirmacaoCorretorSolicitadaEm: null,
      tokenConfirmacaoCorretor: { not: null },
    },
    include: {
      lead: { select: { id: true, nome: true, tenantId: true, campanhaOrigemId: true } }
    },
    take: 100
  });

  let enviados = 0;
  let erros = 0;
  for (const atividade of atividades) {
    try {
      if (!atividade.lead?.campanhaOrigemId) continue;
      const especialista = await resolverEspecialistaCampanha({
        tenantId: atividade.lead.tenantId,
        campanhaId: atividade.lead.campanhaOrigemId
      });
      if (!especialista?.telefone) continue;

      const instanceName = await buscarSessaoConectadaTenant(atividade.lead.tenantId);
      if (!instanceName) continue;

      const whatsapp = getWhatsAppService(instanceName);
      const telefone = normalizarTelefoneParaWaMe(especialista.telefone);
      const link = linkConfirmacaoCorretor(atividade.id, atividade.tokenConfirmacaoCorretor!);
      const msg = templateConvite({
        leadNome: atividade.lead.nome,
        horario: atividade.agendadoPara,
        link,
      });
      await whatsapp.enviarMensagemTexto(telefone, msg);

      await (prisma.atividade as any).update({
        where: { id: atividade.id },
        data: {
          confirmacaoCorretorSolicitadaEm: new Date(),
          corretorAtualId: especialista.usuarioId || (atividade as any).corretorAtualId || null,
          corretorOriginalId: (atividade as any).corretorOriginalId || especialista.usuarioId || null,
        }
      });
      ServicoAuditoria.registrar({
        tenantId: atividade.lead.tenantId,
        acao: 'CONVITE_CONFIRMACAO_CORRETOR',
        entidade: 'Atividade',
        entidadeId: atividade.id,
        ip: '127.0.0.1',
        detalhes: { leadId: atividade.lead.id, corretorTelefone: telefone }
      });
      enviados++;
    } catch (e) {
      erros++;
    }
  }

  return { processados: atividades.length, enviados, erros };
}

export async function executarLembretesConfirmacaoCorretor(): Promise<{ processados: number; enviados: number; erros: number }> {
  const agora = new Date();
  const janelaInicio = minutosAntes(agora, -90); // agora +90
  const janelaFim = minutosAntes(agora, -80); // agora +80

  const atividades = await (prisma.atividade as any).findMany({
    where: {
      tipo: 'REUNIAO',
      statusAgendamento: { in: ['PENDENTE', 'CONFIRMADO'] },
      statusConfirmacaoCorretor: 'PENDENTE',
      agendadoPara: { gte: janelaFim, lte: janelaInicio },
      confirmacaoCorretorSolicitadaEm: { not: null },
      lembreteCorretorEnviadoEm: null,
      tokenConfirmacaoCorretor: { not: null },
    },
    include: {
      lead: { select: { id: true, nome: true, tenantId: true, campanhaOrigemId: true } }
    },
    take: 100
  });

  let enviados = 0;
  let erros = 0;
  for (const atividade of atividades) {
    try {
      if (!atividade.lead?.campanhaOrigemId) continue;
      const especialista = await resolverEspecialistaCampanha({
        tenantId: atividade.lead.tenantId,
        campanhaId: atividade.lead.campanhaOrigemId
      });
      if (!especialista?.telefone) continue;

      const instanceName = await buscarSessaoConectadaTenant(atividade.lead.tenantId);
      if (!instanceName) continue;

      const whatsapp = getWhatsAppService(instanceName);
      const telefone = normalizarTelefoneParaWaMe(especialista.telefone);
      const link = linkConfirmacaoCorretor(atividade.id, atividade.tokenConfirmacaoCorretor!);
      const msg = templateLembrete({
        leadNome: atividade.lead.nome,
        horario: atividade.agendadoPara,
        link,
      });
      await whatsapp.enviarMensagemTexto(telefone, msg);
      await (prisma.atividade as any).update({
        where: { id: atividade.id },
        data: { lembreteCorretorEnviadoEm: new Date() }
      });
      ServicoAuditoria.registrar({
        tenantId: atividade.lead.tenantId,
        acao: 'LEMBRETE_CONFIRMACAO_CORRETOR',
        entidade: 'Atividade',
        entidadeId: atividade.id,
        ip: '127.0.0.1',
        detalhes: { leadId: atividade.lead.id, corretorTelefone: telefone }
      });
      enviados++;
    } catch (e) {
      erros++;
    }
  }

  return { processados: atividades.length, enviados, erros };
}

export async function executarCutoffRemanejamentoCorretor(): Promise<{ processados: number; remanejados: number; expirados: number; erros: number }> {
  const agora = new Date();

  const atividades = await (prisma.atividade as any).findMany({
    where: {
      tipo: 'REUNIAO',
      statusAgendamento: { in: ['PENDENTE', 'CONFIRMADO'] },
      statusConfirmacaoCorretor: { in: ['PENDENTE', 'RECUSADO'] },
      agendadoPara: { gt: agora, lte: minutosAntes(agora, -60) },
      tokenConfirmacaoCorretor: { not: null },
    },
    include: {
      lead: {
        select: {
          id: true,
          nome: true,
          tenantId: true,
          campanhaOrigemId: true,
          telefone: true,
        }
      }
    },
    take: 100
  });

  let remanejados = 0;
  let expirados = 0;
  let erros = 0;

  for (const atividade of atividades) {
    try {
      expirados++;
      const estadoAtualizadoEm = new Date();
      await (prisma.atividade as any).update({
        where: { id: atividade.id },
        data: {
          statusConfirmacaoCorretor: 'EXPIRADO',
          expiradoCorretorEm: estadoAtualizadoEm,
          versao: { increment: 1 },
          estadoAgendaAtualizadoEm: estadoAtualizadoEm,
        }
      });
      ServicoAuditoria.registrar({
        tenantId: atividade.lead.tenantId,
        acao: 'EXPIRACAO_CONFIRMACAO_CORRETOR',
        entidade: 'Atividade',
        entidadeId: atividade.id,
        ip: '127.0.0.1',
        detalhes: { leadId: atividade.lead.id }
      });

      const remanejamento = await remanejarCorretorAtividade({
        atividadeId: atividade.id,
        origem: 'CUTOFF',
      });
      if (remanejamento.sucesso) remanejados++;
    } catch (e) {
      erros++;
    }
  }

  const limiteExpiracao = Number(process.env.CORRETOR_CONFIRMACAO_ALERTA_EXPIRADOS || 10);
  if (expirados >= limiteExpiracao) {
    const expiradosPorTenant = new Map<string, number>();
    for (const atividade of atividades) {
      const tenantId = atividade.lead?.tenantId;
      if (!tenantId) continue;
      expiradosPorTenant.set(tenantId, (expiradosPorTenant.get(tenantId) || 0) + 1);
    }
    for (const [tenantId, total] of expiradosPorTenant.entries()) {
      if (total < limiteExpiracao) continue;
      ServicoAuditoria.registrar({
        tenantId,
        acao: 'ALERTA_EXPIRACAO_CONFIRMACAO_CORRETOR',
        entidade: 'Job',
        entidadeId: 'cutoff-remanejamento-corretor',
        ip: '127.0.0.1',
        detalhes: { expirados: total, limite: limiteExpiracao }
      });
    }
  }

  return { processados: atividades.length, remanejados, expirados, erros };
}
