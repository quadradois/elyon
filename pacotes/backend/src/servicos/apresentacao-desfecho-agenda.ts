interface DesfechoAgendaParaExibicao {
  status?: string | null;
  tipoAtividade?: string | null;
  parteAusente?: string | null;
  motivo?: string | null;
}

function quantidadeMarcadoresCorrompidos(texto: string): number {
  return (texto.match(/[\uFFFDÃƒÃ‚]|[\p{L}]\?+[\p{L}]/gu) || []).length;
}

function repararMojibakeUtf8(texto: string): string {
  if (!/[ÃƒÃ‚]/.test(texto)) return texto;

  const reparado = Buffer.from(texto, 'latin1').toString('utf8');
  if (reparado.includes('\uFFFD')) return texto;

  return quantidadeMarcadoresCorrompidos(reparado) < quantidadeMarcadoresCorrompidos(texto)
    ? reparado
    : texto;
}

export function motivoDesfechoAgendaParaExibicao({
  status,
  tipoAtividade,
  parteAusente,
  motivo,
}: DesfechoAgendaParaExibicao): string | null {
  const normalizado = repararMojibakeUtf8(motivo?.trim().normalize('NFC') || '');
  if (!normalizado) return null;
  if (quantidadeMarcadoresCorrompidos(normalizado) === 0) return normalizado;

  if (status === 'NAO_COMPARECEU') {
    if (parteAusente === 'CORRETOR') {
      return tipoAtividade === 'REUNIAO'
        ? 'Especialista não realizou a ligação confirmada'
        : 'Especialista não compareceu ao atendimento confirmado';
    }

    if (parteAusente === 'LEAD') {
      return 'Lead não compareceu ao atendimento confirmado';
    }
  }

  return 'Observação registrada com caracteres inválidos; consulte o histórico de auditoria.';
}
