import { prisma } from '../lib/db';

export interface DadosAuditoria {
  tenantId: string;
  usuarioId?: string; // Pode ser null se acionado por cron/webhook
  acao: string; // Ex: LOGIN, MINERACAO_ASSERTIVA, CRIAR_CAMPANHA, LEAD_CONTATADO
  entidade?: string; // Ex: Usuario, Contato, Lead, Campanha
  entidadeId?: string;
  detalhes?: Record<string, any>;
  ip?: string;
}

export class ServicoAuditoria {
  /**
   * Registra uma ação no log de forma assíncrona (fogo e esquece).
   * Não travar a execução principal aguardando o retorno.
   */
  static registrar(dados: DadosAuditoria): void {
    // Fire and forget: roda de forma assíncrona para não aumentar a latência da request
    prisma.logAuditoria.create({
      data: {
        tenantId: dados.tenantId,
        usuarioId: dados.usuarioId,
        acao: dados.acao,
        entidade: dados.entidade,
        entidadeId: dados.entidadeId,
        detalhes: dados.detalhes || {},
        ip: dados.ip,
      }
    }).catch(err => {
      console.error(`[Auditoria] Falha ao registrar log de ação ${dados.acao}:`, err);
    });
  }

  /**
   * Limpa logs antigos para economizar banco (Retenção = 2 meses).
   * Recomendado chamar em um CRON diário.
   */
  static async limparLogsAntigos(diasParaManter = 60): Promise<number> {
    const dataCorte = new Date();
    dataCorte.setDate(dataCorte.getDate() - diasParaManter);

    const resultado = await prisma.logAuditoria.deleteMany({
      where: {
        criadoEm: {
          lt: dataCorte
        }
      }
    });

    return resultado.count;
  }
}
