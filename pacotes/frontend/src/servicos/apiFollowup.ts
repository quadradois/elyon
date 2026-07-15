import { api } from './api';

export interface FollowupManualPayload {
  mensagem: string;
  dataEnvio: string;
  timezoneIana: string;
  motivo: string;
}

export function criarPayloadFollowupManual(params: { mensagem: string; dataLocal: string; timezoneIana?: string }): FollowupManualPayload {
  const mensagem = params.mensagem.trim();
  const dataEnvio = params.dataLocal.trim().replace('T', ' ');
  const timezoneIana = params.timezoneIana || Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!mensagem || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dataEnvio) || !timezoneIana) {
    throw new Error('FOLLOWUP_MANUAL_CONTRACT_INVALID');
  }
  return { mensagem, dataEnvio, timezoneIana, motivo: 'Agendamento manual pelo operador autenticado' };
}

export async function agendarFollowupManual(leadId: string, params: { mensagem: string; dataLocal: string; timezoneIana?: string }) {
  return api.post(`/leads/${leadId}/followup`, criarPayloadFollowupManual(params));
}
