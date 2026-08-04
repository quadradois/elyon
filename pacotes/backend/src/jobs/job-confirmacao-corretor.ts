import { prisma } from '../lib/db';
import { getWhatsAppService } from '../servicos/whatsapp';
import { ServicoAuditoria } from '../servicos/servico-auditoria';
import { resolverEspecialistaCampanha } from '../servicos/resolucao-especialista-campanha';
import { remanejarCorretorAtividade } from '../servicos/remanejamento-corretor';
import {
  calcularPrazoConfirmacaoCorretor,
  obterAntecedenciaLembreteCorretorMinutos,
  obterPrazoConfirmacaoCorretorMinutos,
} from '../servicos/prazo-confirmacao-corretor';
import { obterSpecialistCopilotRollout } from '../servicos/agenda-lifecycle-rollout';
import { hashTokenConvite } from '../servicos/specialist-copilot-context';
import { montarIdentificacaoImovel, sanitizarContextoEspecialista } from '../servicos/specialist-copilot-privacy';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost';
const STATUS_AGENDAMENTO_ATIVOS = ['PENDENTE', 'SOLICITADO', 'PROPOSTO', 'CONFIRMADO'];

function normalizarTelefoneParaWaMe(telefone?: string | null): string {
  const digits = (telefone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function adicionarMinutos(data: Date, minutos: number): Date {
  return new Date(new Date(data).getTime() + minutos * 60 * 1000);
}

function linkConfirmacaoCorretor(atividadeId: string, token: string): string {
  return `${FRONTEND_URL}/confirmar-corretor/${atividadeId}/${token}`;
}

function formatarHorario(data: Date): string {
  return new Date(data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function templateConvite(params: {
  especialistaNome?: string | null;
  leadNome: string;
  horario: Date;
  prazo: Date;
  link: string;
  modalidade?: string | null;
  imovel?: string | null;
  resumo?: string | null;
  conversacional?: boolean;
}): string {
  if (params.conversacional) {
    const detalhes = [
      params.imovel ? `*Imóvel:* ${params.imovel}` : null,
      params.resumo ? `*Resumo do atendimento:* ${params.resumo}` : null,
    ].filter(Boolean);
    return [
      'Elyon | Convite de confirmação',
      '',
      `Olá, ${params.especialistaNome?.trim() || 'especialista'}! Você tem uma nova solicitação de atendimento.`,
      '',
      `*Lead:* ${params.leadNome}`,
      `*Data e horário:* ${formatarHorario(params.horario)}`,
      `*Modalidade:* ${params.modalidade || 'Ligação telefônica'}`,
      ...(detalhes.length ? ['', '*Detalhes:*', ...detalhes] : []),
      '',
      'Posso confirmar este horário ou prefere sugerir outro?',
      `Responda em até ${obterPrazoConfirmacaoCorretorMinutos()} minutos (prazo: ${formatarHorario(params.prazo)}).`,
      '',
      `Se preferir, use o link: ${params.link}`,
    ].join('\n');
  }
  return [
    'Elyon | Convite de confirmação',
    `Lead: ${params.leadNome}`,
    `Reunião: ${formatarHorario(params.horario)}`,
    `Responda em até ${obterPrazoConfirmacaoCorretorMinutos()} minutos (prazo: ${formatarHorario(params.prazo)}).`,
    params.link,
  ].join('\n');
}

function templateLembrete(params: { leadNome: string; horario: Date; prazo: Date; link: string }): string {
  return [
    'Elyon | Lembrete de confirmação',
    `Lead: ${params.leadNome}`,
    `Reunião: ${formatarHorario(params.horario)}`,
    `Seu prazo termina às ${formatarHorario(params.prazo)}. Sem resposta, o atendimento será oferecido ao especialista fallback.`,
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

async function resolverEspecialistaAtividade(atividade: any): Promise<any | null> {
  if (atividade.corretorAtualId) {
    const atual = await prisma.usuario.findFirst({
      where: {
        id: atividade.corretorAtualId,
        tenantId: atividade.lead.tenantId,
        estaAtivo: true,
        telefone: { not: null },
      },
      select: { id: true, nome: true, telefone: true, email: true, papel: true },
    });
    if (atual && normalizarTelefoneParaWaMe(atual.telefone).length >= 12) {
      return {
        usuarioId: atual.id,
        nome: atual.nome,
        telefone: atual.telefone,
        email: atual.email || undefined,
        cargo: atual.papel === 'ADMIN' ? 'Especialista Comercial' : 'Corretor Especialista',
        origem: 'RESPONSAVEL_ATIVIDADE',
      };
    }
  }

  if (!atividade.lead?.campanhaOrigemId) return null;
  return resolverEspecialistaCampanha({
    tenantId: atividade.lead.tenantId,
    campanhaId: atividade.lead.campanhaOrigemId,
  });
}

export async function executarConvitesConfirmacaoCorretor(): Promise<{ processados: number; enviados: number; erros: number }> {
  const agora = new Date();

  const atividades = await (prisma.atividade as any).findMany({
    where: {
      tipo: 'REUNIAO',
      statusAgendamento: { in: STATUS_AGENDAMENTO_ATIVOS },
      statusConfirmacaoCorretor: 'PENDENTE',
      // O convite nasce com o pedido; o scheduler também recupera convites perdidos após reinício.
      agendadoPara: { gt: agora },
      confirmacaoCorretorSolicitadaEm: null,
      tokenConfirmacaoCorretor: { not: null },
    },
    include: {
      lead: {
        select: {
          id: true, nome: true, tenantId: true, campanhaOrigemId: true,
          nomeEdificio: true, enderecoImovel: true, briefingCloser: true, observacoesSpin: true,
          campanhaOrigem: { select: { nomeEmpreendimento: true, empreendimento: { select: { nome: true } } } },
        }
      }
    },
    orderBy: { criadoEm: 'asc' },
    take: 100
  });

  let enviados = 0;
  let erros = 0;
  for (const atividade of atividades) {
    try {
      const especialista = await resolverEspecialistaAtividade(atividade);
      if (!especialista?.telefone) continue;

      const instanceName = await buscarSessaoConectadaTenant(atividade.lead.tenantId);
      if (!instanceName) continue;

      const whatsapp = getWhatsAppService(instanceName);
      const telefone = normalizarTelefoneParaWaMe(especialista.telefone);
      const link = linkConfirmacaoCorretor(atividade.id, atividade.tokenConfirmacaoCorretor!);
      const solicitadoEm = new Date();
      const prazoEm = new Date(Math.min(
        atividade.agendadoPara.getTime(),
        solicitadoEm.getTime() + obterPrazoConfirmacaoCorretorMinutos() * 60 * 1000,
      ));
      const copilot = await obterSpecialistCopilotRollout(atividade.lead.tenantId, solicitadoEm);
      const imovel = montarIdentificacaoImovel({
        nomeEdificio: atividade.lead.nomeEdificio,
        enderecoImovel: atividade.lead.enderecoImovel,
        empreendimentoNome: atividade.lead.campanhaOrigem?.empreendimento?.nome || atividade.lead.campanhaOrigem?.nomeEmpreendimento,
      });
      const resumo = sanitizarContextoEspecialista(
        atividade.lead.briefingCloser || atividade.lead.observacoesSpin || '',
        500,
      );
      const msg = templateConvite({
        especialistaNome: especialista.nome,
        leadNome: atividade.lead.nome,
        horario: atividade.agendadoPara,
        prazo: prazoEm,
        link,
        modalidade: atividade.canal === 'VISITA' ? 'Visita presencial' : 'Ligação telefônica',
        imovel,
        resumo,
        conversacional: copilot.enabled,
      });
      const envio = await whatsapp.enviarMensagemTexto(
        telefone,
        msg,
        `specialist-invite:${atividade.id}:${atividade.versao || 0}:${especialista.usuarioId || telefone}`,
      );

      if (copilot.enabled && especialista.usuarioId) {
        const tentativaAnterior = await (prisma.conviteEspecialistaAgenda as any).findFirst({
          where: { atividadeId: atividade.id }, orderBy: { tentativa: 'desc' }, select: { tentativa: true },
        });
        await (prisma.conviteEspecialistaAgenda as any).create({
          data: {
            tenantId: atividade.lead.tenantId,
            atividadeId: atividade.id,
            usuarioId: especialista.usuarioId,
            tentativa: (tentativaAnterior?.tentativa || 0) + 1,
            status: 'PENDENTE',
            tokenHash: hashTokenConvite(atividade.tokenConfirmacaoCorretor),
            solicitadoEm,
            prazoEm,
            messageIdConvite: envio?.key?.id || envio?.id || null,
          },
        });
      }

      await (prisma.atividade as any).update({
        where: { id: atividade.id },
        data: {
          confirmacaoCorretorSolicitadaEm: solicitadoEm,
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
  const prazoMinutos = obterPrazoConfirmacaoCorretorMinutos();
  const antecedenciaMinutos = obterAntecedenciaLembreteCorretorMinutos();
  const inicioJanela = adicionarMinutos(agora, -(prazoMinutos - antecedenciaMinutos));
  const fimJanela = adicionarMinutos(agora, -prazoMinutos);

  const atividades = await (prisma.atividade as any).findMany({
    where: {
      tipo: 'REUNIAO',
      statusAgendamento: { in: STATUS_AGENDAMENTO_ATIVOS },
      statusConfirmacaoCorretor: 'PENDENTE',
      // Lembra perto do fim do SLA, sem reenviar depois que o prazo venceu.
      agendadoPara: { gt: agora },
      confirmacaoCorretorSolicitadaEm: { not: null, gt: fimJanela, lte: inicioJanela },
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
      const especialista = await resolverEspecialistaAtividade(atividade);
      if (!especialista?.telefone) continue;

      const instanceName = await buscarSessaoConectadaTenant(atividade.lead.tenantId);
      if (!instanceName) continue;

      const whatsapp = getWhatsAppService(instanceName);
      const telefone = normalizarTelefoneParaWaMe(especialista.telefone);
      const link = linkConfirmacaoCorretor(atividade.id, atividade.tokenConfirmacaoCorretor!);
      const msg = templateLembrete({
        leadNome: atividade.lead.nome,
        horario: atividade.agendadoPara,
        prazo: calcularPrazoConfirmacaoCorretor(atividade)!,
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
  const prazoVencidoEm = adicionarMinutos(agora, -obterPrazoConfirmacaoCorretorMinutos());

  const atividades = await (prisma.atividade as any).findMany({
    where: {
      tipo: 'REUNIAO',
      statusAgendamento: { in: STATUS_AGENDAMENTO_ATIVOS },
      agendadoPara: { gt: agora },
      OR: [
        { statusConfirmacaoCorretor: 'RECUSADO' },
        {
          statusConfirmacaoCorretor: 'PENDENTE',
          confirmacaoCorretorSolicitadaEm: { not: null, lte: prazoVencidoEm },
        },
      ],
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
      await (prisma.conviteEspecialistaAgenda as any).updateMany({
        where: { atividadeId: atividade.id, status: 'PENDENTE' },
        data: { status: 'EXPIRADO', respondidoEm: estadoAtualizadoEm, origemResposta: 'JOB' },
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
