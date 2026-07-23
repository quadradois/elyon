const MARCADOR_BAIRRO = /\s*,?\s*BAIRRO\s+(.+)$/i;

const MARCADOR_UNIDADE = new RegExp(
  [
    '\\s+(?:',
    'AP(?:ARTAMENTO|TO|T)?(?=\\s*[-.]?\\s*\\d)',
    '|BOX(?:E)?(?=\\s*[A-Z0-9])',
    '|SALA(?=\\s*[-.]?\\s*\\d)',
    '|LOJA(?=\\s*[-.]?\\s*\\d)',
    '|CASA(?=\\s*[-.]?\\s*\\d)',
    '|HOSP\\.?\\s*UH(?=\\s*[-.]?\\s*\\d)',
    '|UH(?=\\s*[-.]?\\s*\\d)',
    '|ESC(?:ANINHO)?(?=\\s*[-.]?\\s*\\d)',
    '|ARM(?:ARIO|ÁRIO)?(?=\\s*[-.]?\\s*\\d)',
    '|GAR(?:AGEM)?(?=\\s*[-.]?\\s*\\d)',
    '|VAGA(?=\\s*[-.]?\\s*\\d)',
    ').*$'
  ].join(''),
  'i'
);

function limparTrecho(valor: string): string {
  return valor
    .replace(/\s+/g, ' ')
    .replace(/[\s,;:._+~-]+$/g, '')
    .trim();
}

/**
 * Converte o endereço de uma unidade usado pelo portal em endereço de exibição
 * do lote. O valor bruto continua preservado no banco para busca e auditoria.
 */
export function formatarEnderecoEmpreendimento(
  enderecoOficial: string | null | undefined,
  bairroOficial?: string | null
): string {
  const endereco = enderecoOficial?.trim() || '';
  const bairroEncontrado = endereco.match(MARCADOR_BAIRRO)?.[1];
  const bairro = limparTrecho(bairroOficial?.trim() || bairroEncontrado || '');

  const trechoAntesDoBairro = endereco.replace(MARCADOR_BAIRRO, '');
  const logradouro = limparTrecho(trechoAntesDoBairro.replace(MARCADOR_UNIDADE, ''));

  if (logradouro && bairro) {
    return `${logradouro}, BAIRRO ${bairro}`;
  }

  return logradouro || bairro;
}
