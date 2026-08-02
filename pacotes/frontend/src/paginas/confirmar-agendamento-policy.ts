export function acaoPublicaPermitida(allowedActions: string[] | undefined, action: 'ACEITAR' | 'CANCELAR'): boolean {
  return allowedActions ? allowedActions.includes(action) : true;
}

export function mensagemRejeicaoPublica(code?: string): string {
  if (code === 'APPOINTMENT_STARTED') return 'Este compromisso já iniciou e não pode mais ser alterado por este link.';
  if (code === 'STALE_EVENT' || code === 'VERSION_CONFLICT') return 'O agendamento foi atualizado. Recarregue a página para ver o estado atual.';
  return 'Não foi possível atualizar o agendamento.';
}
