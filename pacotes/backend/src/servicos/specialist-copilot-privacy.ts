const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}\b/g;
const TOKEN_PATTERN = /\b(?:token|bearer|authorization)\s*[:=]?\s*[-a-z0-9._~+/]{8,}\b/gi;
const INTERNAL_DIAGNOSTIC_PATTERN = /\b(?:fallback\s+t[eé]cnico|tool_exec|tool_audit|reasoncode|orchestrator)\b/i;

function removerCaracteresControle(value: string): string {
  return [...value].map((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('');
}

export function sanitizarContextoEspecialista(value: string | null | undefined, maxLength = 600): string {
  if (!value) return '';
  if (INTERNAL_DIAGNOSTIC_PATTERN.test(value)) return '';
  return removerCaracteresControle(value)
    .replace(CPF_PATTERN, '[CPF REMOVIDO]')
    .replace(TOKEN_PATTERN, '[CREDENCIAL REMOVIDA]')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, Math.max(0, maxLength));
}

export function extrairResumoAtendimentoEspecialista(params: {
  descricaoAtividade?: string | null;
  briefingCloser?: string | null;
  observacoesSpin?: string | null;
}, maxLength = 600): string {
  const contextoAtividade = params.descricaoAtividade
    ?.match(/(?:^|\|\s*)contexto:\s*(.+)$/i)?.[1];

  for (const candidato of [contextoAtividade, params.briefingCloser, params.observacoesSpin]) {
    const resumo = sanitizarContextoEspecialista(candidato, maxLength);
    if (resumo) return resumo;
  }
  return '';
}

export function montarIdentificacaoImovel(params: {
  nomeEdificio?: string | null;
  enderecoImovel?: string | null;
  empreendimentoNome?: string | null;
}): string {
  return sanitizarContextoEspecialista(
    params.nomeEdificio || params.empreendimentoNome || params.enderecoImovel || '',
    180,
  );
}
