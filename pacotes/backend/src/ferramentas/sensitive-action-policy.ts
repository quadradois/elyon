import type { Lead } from '@prisma/client';

export type AcaoSensivel = 'GERAR_CONTRATO' | 'ENVIAR_CRM' | 'MOVER_CAPTADO';

export type PolicyReasonCode =
  | 'SENSITIVE_ACTION_POLICY_DENIED'
  | 'MISSING_REQUIRED_FIELDS'
  | 'INVALID_LEAD_STATUS'
  | 'MANUAL_APPROVAL_REQUIRED';

export interface PolicyInput {
  acao: AcaoSensivel;
  lead: Partial<Lead>;
  aprovacaoHumana?: boolean;
}

export interface PolicyResult {
  permitido: boolean;
  reasonCode?: PolicyReasonCode;
  error?: string;
  detalhes?: string[];
}

const STATUS_CONTRATO = new Set(['DOCUMENTACAO', 'EM_NEGOCIACAO', 'ONBOARDING']);
const STATUS_CRM = new Set(['DOCUMENTACAO', 'EM_NEGOCIACAO', 'ONBOARDING']);
const STATUS_CAPTADO = new Set(['ONBOARDING']);

function parseBoolEnv(name: string, fallback: boolean): boolean {
  const raw = (process.env[name] || '').trim().toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function hasText(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireManualApproval(acao: AcaoSensivel): boolean {
  if (acao === 'GERAR_CONTRATO') {
    return parseBoolEnv('AGENT_REQUIRE_MANUAL_APPROVAL_CONTRACT', true);
  }
  if (acao === 'ENVIAR_CRM') {
    return parseBoolEnv('AGENT_REQUIRE_MANUAL_APPROVAL_CRM', true);
  }
  if (acao === 'MOVER_CAPTADO') {
    return parseBoolEnv('AGENT_REQUIRE_MANUAL_APPROVAL_CAPTADO', true);
  }
  return true;
}

export function avaliarPolicyAcaoSensivel(input: PolicyInput): PolicyResult {
  const { acao, lead } = input;
  const detalhes: string[] = [];
  const status = String(lead.status || '');

  if (acao === 'GERAR_CONTRATO') {
    if (!STATUS_CONTRATO.has(status)) {
      return {
        permitido: false,
        reasonCode: 'INVALID_LEAD_STATUS',
        error: 'Contrato só pode ser gerado em fase de negociação/documentação.',
      };
    }

    if (!hasText(lead.tipoAutorizacao as string) || !hasText(lead.comissaoAcordada as string) || !lead.prazoTrabalho || lead.autorizouAnuncio !== true) {
      if (!hasText(lead.tipoAutorizacao as string)) detalhes.push('tipoAutorizacao');
      if (!hasText(lead.comissaoAcordada as string)) detalhes.push('comissaoAcordada');
      if (!lead.prazoTrabalho) detalhes.push('prazoTrabalho');
      if (lead.autorizouAnuncio !== true) detalhes.push('autorizouAnuncio=true');
      return {
        permitido: false,
        reasonCode: 'MISSING_REQUIRED_FIELDS',
        error: 'Dados mínimos de negociação incompletos para gerar contrato.',
        detalhes,
      };
    }
  }

  if (acao === 'ENVIAR_CRM') {
    if (!STATUS_CRM.has(status)) {
      return {
        permitido: false,
        reasonCode: 'INVALID_LEAD_STATUS',
        error: 'Envio para CRM permitido apenas em fase de onboarding/documentação.',
      };
    }

    if (!hasText(lead.tipoImovel as string) || !hasText(lead.valorPretendido as string) || (!lead.quartosImovel && !lead.areaImovel)) {
      if (!hasText(lead.tipoImovel as string)) detalhes.push('tipoImovel');
      if (!hasText(lead.valorPretendido as string)) detalhes.push('valorPretendido');
      if (!lead.quartosImovel && !lead.areaImovel) detalhes.push('quartosImovel|areaImovel');
      return {
        permitido: false,
        reasonCode: 'MISSING_REQUIRED_FIELDS',
        error: 'Dados do imóvel incompletos para envio ao CRM.',
        detalhes,
      };
    }

    if (!hasText(lead.tipoAutorizacao as string) || !hasText(lead.comissaoAcordada as string)) {
      if (!hasText(lead.tipoAutorizacao as string)) detalhes.push('tipoAutorizacao');
      if (!hasText(lead.comissaoAcordada as string)) detalhes.push('comissaoAcordada');
      return {
        permitido: false,
        reasonCode: 'MISSING_REQUIRED_FIELDS',
        error: 'Dados de contrato/negociação incompletos para envio ao CRM.',
        detalhes,
      };
    }
  }

  if (acao === 'MOVER_CAPTADO') {
    if (!STATUS_CAPTADO.has(status)) {
      return {
        permitido: false,
        reasonCode: 'INVALID_LEAD_STATUS',
        error: 'Lead só pode ir para CAPTADO a partir de ONBOARDING.',
      };
    }

    if (lead.crmSyncStatus !== 'synced') {
      return {
        permitido: false,
        reasonCode: 'SENSITIVE_ACTION_POLICY_DENIED',
        error: 'Lead só pode ir para CAPTADO após CRM sincronizado.',
      };
    }
  }

  if (requireManualApproval(acao) && input.aprovacaoHumana !== true) {
    return {
      permitido: false,
      reasonCode: 'MANUAL_APPROVAL_REQUIRED',
      error: 'Ação sensível requer aprovação humana explícita.',
    };
  }

  return { permitido: true };
}

export function isAutoCaptadoAfterCrmEnabled(): boolean {
  return parseBoolEnv('AGENT_AUTO_CAPTADO_AFTER_CRM', false);
}
