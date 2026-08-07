function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ehConsultaStatusAgendamento(textoOriginal?: string): boolean {
  const texto = normalizarTexto(textoOriginal || '');
  if (!texto || !/agendamento|atendimento|reuniao|ligacao|vai\s+me\s+ligar/.test(texto)) return false;
  const entidade = '(?:agendamento|atendimento|reuniao|ligacao)';

  return /\bstatus\b/.test(texto)
    || new RegExp(`\\b(?:tenho|ha|existe|possuo)\\b.{0,35}\\b${entidade}\\b`).test(texto)
    || new RegExp(`\\b${entidade}\\b.{0,45}\\b(?:ativo|confirmado|cancelado|pendente|solicitado)\\b`).test(texto)
    || /\b(?:esta|foi|ficou)\b.{0,25}\b(?:ativo|confirmado|cancelado|pendente)\b/.test(texto)
    || /\b(?:qual|quando)\b.{0,45}\b(?:dia|data|horario|especialista|corretor)\b/.test(texto)
    || new RegExp(`\\b(?:dia|data|horario|especialista|corretor)\\b.{0,45}\\b${entidade}\\b`).test(texto)
    || /\bquem\b.{0,35}\b(?:vai\s+me\s+ligar|especialista|corretor)\b/.test(texto);
}
