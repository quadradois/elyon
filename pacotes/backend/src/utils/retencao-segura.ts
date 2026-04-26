import crypto from 'crypto';
import { prisma } from '../lib/db';

export interface AplicarRetencaoSeguraInput {
  tenantId: string;
  leadId: string;
  preservarRag?: boolean;
}

export interface AplicarRetencaoSeguraResult {
  leadId: string;
  tokenAnonimo: string;
  mensagensAnonimizadas: number;
  conversasAnonimizadas: number;
  embeddingsRemovidos: number;
  preservarRag: boolean;
  aplicadoEm: string;
}

function gerarTokenAnonimo(tenantId: string, leadId: string): string {
  const salt = process.env.RETENCAO_SALT || 'elyon-retencao-v1';
  return crypto
    .createHash('sha256')
    .update(`${tenantId}:${leadId}:${salt}`)
    .digest('hex')
    .slice(0, 12);
}

export async function aplicarRetencaoSeguraLead(input: AplicarRetencaoSeguraInput): Promise<AplicarRetencaoSeguraResult> {
  const preservarRag = input.preservarRag === true;
  const tokenAnonimo = gerarTokenAnonimo(input.tenantId, input.leadId);
  const aplicadoEm = new Date().toISOString();

  const conversas = await prisma.conversa.findMany({
    where: { leadId: input.leadId },
    select: { id: true },
  });

  const conversaIds = conversas.map((c) => c.id);

  const mensagensContagem = conversaIds.length > 0
    ? await prisma.mensagem.count({ where: { conversaId: { in: conversaIds } } })
    : 0;

  if (conversaIds.length > 0) {
    await prisma.mensagem.updateMany({
      where: { conversaId: { in: conversaIds } },
      data: {
        conteudo: '[MENSAGEM REDIGIDA POR RETENCAO SEGURA]',
        metadata: {
          retencaoSegura: true,
          aplicadoEm,
          versao: 'RETENCAO_SEGURA_V1',
        },
      },
    });

    await prisma.conversa.updateMany({
      where: { id: { in: conversaIds } },
      data: {
        numeroOrigem: `anon-${tokenAnonimo}`,
        contexto: {
          retencaoSegura: true,
          aplicadoEm,
          versao: 'RETENCAO_SEGURA_V1',
        },
      },
    });
  }

  let embeddingsRemovidos = 0;
  if (!preservarRag) {
    const deletados = await prisma.conversaEmbedding.deleteMany({
      where: {
        tenantId: input.tenantId,
        OR: [
          { leadId: input.leadId },
          conversaIds.length > 0 ? { conversaId: { in: conversaIds } } : undefined,
        ].filter(Boolean) as any,
      },
    });
    embeddingsRemovidos = deletados.count;
  }

  await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      nome: `ANON-${tokenAnonimo}`,
      cpf: null,
      email: null,
      email2: null,
      telefone: null,
      telefone2: null,
      telefone3: null,
      telefoneVerificado: false,
      dataNascimento: null,
      enderecoPrincipal: null,
      empresaAtual: null,
      cnpjEmpresa: null,
      profissao: null,
      bairroImovel: null,
      enderecoImovel: null,
      observacoesSpin: '[REDACTED]',
      briefingCloser: '[REDACTED]',
      schemaState: {
        retencaoSegura: true,
        aplicadoEm,
        versao: 'RETENCAO_SEGURA_V1',
      },
    },
  });

  return {
    leadId: input.leadId,
    tokenAnonimo,
    mensagensAnonimizadas: mensagensContagem,
    conversasAnonimizadas: conversaIds.length,
    embeddingsRemovidos,
    preservarRag,
    aplicadoEm,
  };
}
