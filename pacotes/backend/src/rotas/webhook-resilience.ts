import { ehConsultaStatusAgendamento } from '../servicos/intencao-status-agendamento';

export const STATUS_ELEGIVEIS_AUTO_RETORNO_IA = new Set(['DOCUMENTACAO', 'EM_NEGOCIACAO', 'ONBOARDING']);

export function extrairSinaisNegociacaoHumana(texto: string): {
  tipoAutorizacao?: 'exclusiva' | 'simples';
  comissaoAcordada?: string;
  prazoTrabalho?: number;
} {
  const base = (texto || '').toLowerCase();
  const sinais: { tipoAutorizacao?: 'exclusiva' | 'simples'; comissaoAcordada?: string; prazoTrabalho?: number } = {};

  if (/\bexclusiv[ao]\b/.test(base)) sinais.tipoAutorizacao = 'exclusiva';
  else if (/\bsimples\b|\bsem exclusividade\b/.test(base)) sinais.tipoAutorizacao = 'simples';

  const comissao = base.match(/(\d{1,2}(?:[.,]\d+)?)\s*%/);
  if (comissao?.[1]) sinais.comissaoAcordada = `${comissao[1].replace(',', '.')}%`;

  const prazo = base.match(/\b(\d{1,3})\s*dias?\b/);
  if (prazo?.[1]) sinais.prazoTrabalho = Number(prazo[1]);

  return sinais;
}

export function deveAutoRetornarParaIA(autoRetornoAtivo: boolean, statusLead?: string): boolean {
  if (!autoRetornoAtivo) return false;
  if (!statusLead) return false;
  return STATUS_ELEGIVEIS_AUTO_RETORNO_IA.has(statusLead);
}

export function deveExecutarFallbackConversao(params: {
  virouLead?: boolean | null;
  leadId?: string | null;
  lockAdquirido: boolean;
}): boolean {
  if (params.virouLead && params.leadId) return false;
  return params.lockAdquirido;
}

export function deveExecutarFallbackAtualizacaoLead(params: {
  leadId?: string | null;
  houveToolSucessoNoTurno?: boolean;
  houveToolExecRecente: boolean;
  textoConversa: string;
}): boolean {
  if (!params.leadId) return false;
  if (ehConsultaStatusAgendamento(params.textoConversa)) return false;
  if (params.houveToolSucessoNoTurno) return false;
  if (params.houveToolExecRecente) return false;
  return (params.textoConversa || '').trim().length >= 8;
}
