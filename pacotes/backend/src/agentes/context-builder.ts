import type { ElyonContext } from './elyon-context';
import type { SchemaState } from './conversation-state';
import type { Lead } from '@prisma/client';
import type { RagFact } from './rag-facts-context';

interface ContextBuilderConfig {
  tenantId: string;
  nomeAgente: string;
  genero: string;
  nomeImobiliaria: string;
  cidade?: string;
  diferenciais?: string[];
  comissaoPadrao?: string;
  prazoContrato?: number;
  ragPerfilTexto?: string;
  briefingEmpreendimento?: string;
}

interface ContextBuilderConversa {
  telefone: string;
  contatoId?: string;
  leadId?: string;
  statusLead?: string;
  doresIdentificadas?: string[];
  empreendimento?: string;
  situacaoAtual?: string;
  tipoAutorizacao?: string;
  comissaoAcordada?: string;
  prazoTrabalho?: number;
  ragFacts?: RagFact[];
}

interface ConstruirElyonContextParams {
  config: ContextBuilderConfig;
  contexto: ContextBuilderConversa;
  agenteCache?: string;
  prismaClient: ElyonContext['prisma'];
  schemaState?: SchemaState;
  leadRecord?: Lead | null;
  assertFencing?: () => Promise<void>;
  withFencedTransaction?: <T>(command: () => Promise<T>) => Promise<T>;
  executeExternalEffect?: (toolName: string, command: () => Promise<string>) => Promise<string>;
}


export function gerarTextoUltimaInteracao(agenteCache?: string): string | undefined {
  if (!agenteCache) return undefined;

  return `ATENÇÃO: Este lead acabou de ser transferido automaticamente para você (${agenteCache}). A conversa já está em andamento. Leia o histórico, NÃO SE APRESENTE NOVAMENTE e continue de onde parou de forma fluida.`;
}

export function construirElyonContext(params: ConstruirElyonContextParams): ElyonContext {
  const { config, contexto, agenteCache, prismaClient, schemaState, leadRecord, assertFencing, withFencedTransaction, executeExternalEffect } = params;
  const textoUltimaInteracao = gerarTextoUltimaInteracao(agenteCache);

  return {
    tenantId: config.tenantId,
    contatoId: contexto.contatoId,
    leadId: contexto.leadId,
    telefone: contexto.telefone,
    statusLead: contexto.statusLead,
    doresIdentificadas: contexto.doresIdentificadas,
    empreendimento: contexto.empreendimento,
    situacaoAtual: contexto.situacaoAtual,
    nomeAgente: config.nomeAgente,
    genero: config.genero,
    nomeImobiliaria: config.nomeImobiliaria,
    cidade: config.cidade,
    diferenciais: config.diferenciais,
    comissaoPadrao: config.comissaoPadrao,
    prazoContrato: config.prazoContrato,
    ragPerfilTexto: config.ragPerfilTexto,
    briefingEmpreendimento: config.briefingEmpreendimento,
    tipoAutorizacao: contexto.tipoAutorizacao,
    comissaoAcordada: contexto.comissaoAcordada,
    prazoTrabalho: contexto.prazoTrabalho,
    ragFacts: contexto.ragFacts,
    ultimaInteracao: textoUltimaInteracao,
    prisma: prismaClient,
    schemaState,
    leadRecord,
    assertFencing,
    withFencedTransaction,
    executeExternalEffect,
  };
}
