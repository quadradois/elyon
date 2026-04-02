/**
 * TASK-12: Tipos para dados do CacheCpf
 * 
 * Substituir os `as any` espalhados em mensagens.rotas.ts e contatos.rotas.ts.
 * Esses dados vêm do JSON retornado pela Assertiva e armazenado no campo `dados` do CacheCpf.
 */

export interface ParticipacaoEmpresa {
  razaoSocial: string;
  cnpj?: string;
  participacao?: string;
  inicio?: string;
  fim?: string;
  situacao?: string;
}

export interface EnderecoCache {
  tipoLogradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

export interface DadosCacheCpf {
  // Dados pessoais
  nome?: string;
  nomeMae?: string;
  dataNascimento?: string;
  idade?: number | string;
  sexo?: string;
  signo?: string;
  situacaoCadastral?: string;

  // Dados profissionais (emprego CLT)
  profissao?: string;
  rendaEstimada?: number;
  faixaSalarial?: string;
  setor?: string;
  empresaAtual?: string;
  cnpjEmpresa?: string;

  // Fallback para sócios/empresários (sem CLT recente)
  participacoesEmpresas?: ParticipacaoEmpresa[];

  // Contato
  telefones?: unknown;
  emails?: unknown;

  // Endereço
  endereco?: EnderecoCache;
}

/**
 * TASK-10: DTO de enriquecimento do contato
 * 
 * Antes: dados do cache eram mutados diretamente no objeto Prisma.
 * Agora: contato retornado pelo Prisma nunca é mutado. Os campos enriquecidos
 * são mesclados num novo objeto antes de retornar ao cliente.
 */
export type ContatoEnriquecido<T extends object> = T & {
  // Campos injetados pelo enriquecimento em tempo real
  _enriquecido?: boolean;
  _fonteEnriquecimento?: 'cache_cpf' | 'imovel' | 'smart_discovery';
};

export function criarContatoEnriquecido<T extends object>(
  base: T,
  campos: Partial<T>
): T {
  // Merge sem mutar o objeto original do Prisma
  return { ...base, ...campos };
}
