import { api } from './api';

export interface FollowupManualPayload {
  mensagem: string;
  dataEnvio: string;
  timezoneIana: string;
  motivo: string;
  requestId: string;
  followupId?: string;
}

export interface FollowupAtivoManual { id: string; mensagem: string; dataLocal: string; timezoneIana: string; status: string; reasonCode?: string | null }

export function criarPayloadFollowupManual(params: { mensagem: string; dataLocal: string; requestId: string; timezoneIana?: string; followupId?: string }): FollowupManualPayload {
  const mensagem = params.mensagem.trim();
  const dataEnvio = params.dataLocal.trim().replace('T', ' ');
  const timezoneIana = params.timezoneIana || Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!mensagem || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dataEnvio) || !timezoneIana || !params.requestId.trim()) {
    throw new Error('FOLLOWUP_MANUAL_CONTRACT_INVALID');
  }
  return { mensagem, dataEnvio, timezoneIana, motivo: 'Agendamento manual pelo operador autenticado', requestId: params.requestId.trim(), ...(params.followupId ? { followupId: params.followupId } : {}) };
}

export async function agendarFollowupManual(leadId: string, params: { mensagem: string; dataLocal: string; requestId: string; timezoneIana?: string; followupId?: string }) {
  return api.post(`/leads/${leadId}/followup`, criarPayloadFollowupManual(params));
}

export async function obterFollowupAtivoManual(leadId: string): Promise<FollowupAtivoManual | null> {
  const response = await api.get(`/leads/${leadId}/followup/ativo`);
  return response.data.followup || null;
}
