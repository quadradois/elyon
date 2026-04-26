const PARES_ASPAS_ENVOLVENTES: ReadonlyArray<readonly [string, string]> = [
  ['"', '"'],
  ["'", "'"],
  ['“', '”'],
  ['”', '“'],
  ['‘', '’'],
  ['«', '»'],
  ['‹', '›'],
  ['„', '“'],
];

const CHAVES_METADADOS = new Set([
  'raciocinio',
  'fase',
  'pvam',
  'spin',
  'proximopasso',
  'pvaminferido',
  'sinaisdetectados',
  'dadoscoletados',
]);

const CHAVES_METADADOS_FORTES = new Set([
  'raciocinio',
  'pvam',
  'spin',
  'pvaminferido',
  'sinaisdetectados',
  'dadoscoletados',
]);

const FASES_INTERNAS = new Set([
  'MEIO_CAMPO',
  'DESCOBERTA',
  'DIAGNOSTICO_SPIN',
  'PITCH',
  'AGENDAMENTO',
  'FOLLOW_UP',
  'RECUO',
]);

function normalizarToken(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function removerAspasEnvolventes(texto: string): string {
  let resposta = texto.trim();

  for (let i = 0; i < 3; i++) {
    let removeu = false;

    for (const [abertura, fechamento] of PARES_ASPAS_ENVOLVENTES) {
      if (!resposta.startsWith(abertura) || !resposta.endsWith(fechamento)) {
        continue;
      }

      const miolo = resposta.slice(abertura.length, resposta.length - fechamento.length).trim();
      if (!miolo) return texto.trim();

      resposta = miolo;
      removeu = true;
      break;
    }

    if (!removeu) break;
  }

  return resposta;
}

function extrairChaveLinha(linha: string): string | null {
  const match = linha.match(/^\s*([A-Za-zÀ-ÖØ-öø-ÿ_]+)\s*:/);
  if (!match) return null;
  return normalizarToken(match[1]);
}

function linhaFasePareceInterna(linha: string): boolean {
  const match = linha.match(/^\s*fase\s*:\s*(.+)\s*$/i);
  if (!match) return false;

  const bruto = match[1].trim().replace(/^["'`]|["'`]$/g, '');
  const fase = bruto.toUpperCase();
  return FASES_INTERNAS.has(fase);
}

function encontrarInicioBlocoMetadados(linhas: string[]): number {
  for (let i = 0; i < linhas.length; i++) {
    const chave = extrairChaveLinha(linhas[i]);
    if (!chave || !CHAVES_METADADOS.has(chave)) continue;

    const cauda = linhas.slice(i);
    const qtdMetadadosNaCauda = cauda
      .map((linha) => extrairChaveLinha(linha))
      .filter((key): key is string => !!key && CHAVES_METADADOS.has(key))
      .length;

    const ehChaveForte = CHAVES_METADADOS_FORTES.has(chave);
    const ehFaseInterna = chave === 'fase' && linhaFasePareceInterna(linhas[i]);

    if (qtdMetadadosNaCauda >= 2 || ehChaveForte || ehFaseInterna) {
      return i;
    }
  }

  return -1;
}

function removerBlocoMetadadosInternos(texto: string): string {
  const linhas = texto.split('\n');
  const inicioBloco = encontrarInicioBlocoMetadados(linhas);
  if (inicioBloco === -1) return texto.trim();
  return linhas.slice(0, inicioBloco).join('\n').trimEnd();
}

function limparBlocoInternoStructuredOutput(texto: string): string {
  let resposta = texto.trim();

  const idxJsonFinal = resposta.lastIndexOf('\n{');
  if (idxJsonFinal !== -1) {
    const prefixo = resposta.slice(0, idxJsonFinal).trim();
    const cauda = resposta.slice(idxJsonFinal).trim();
    const parecePayloadInterno =
      /"respostaParaOCliente"\s*:/.test(cauda)
      && /"raciocinio"|"proximoPasso"|"pvam"|"spin"|"fase"/.test(cauda);
    if (parecePayloadInterno) {
      resposta = prefixo;
    }
  }

  const matchBlocoMarkdown = resposta.match(/\n```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (matchBlocoMarkdown) {
    const payload = matchBlocoMarkdown[1];
    const parecePayloadInterno =
      /"respostaParaOCliente"\s*:/.test(payload)
      && /"raciocinio"|"proximoPasso"|"pvam"|"spin"|"fase"/.test(payload);
    if (parecePayloadInterno) {
      resposta = resposta.replace(/\n```(?:json)?\s*[\s\S]*?```\s*$/i, '').trim();
    }
  }

  return resposta;
}

function normalizarTermosComerciaisSensveis(texto: string): string {
  return texto
    .replace(
      /temos\s+duas\s+op[cç][oõ]es\s*:\s*(?:contrato\s+simples|autoriza[cç][aã]o\s+de\s+venda)\s*\(?.*?\)?\s*ou\s*exclusivo\s*(por\s*\d+\s*dias)?/gi,
      'Trabalhamos com autorização de venda, com condições alinhadas em atendimento consultivo'
    )
    .replace(/\bcontrato\s+simples\b/gi, 'autorização de venda')
    .replace(
      /quer que eu te envie os termos por e-?mail para ver antes ou prefere que o corretor explique tudo na nossa pr[oó]xima reuni[aã]o\?/gi,
      'Quer que eu te envie o documento de autorização aqui no WhatsApp para você analisar com calma, ou prefere que o corretor explique tudo na nossa próxima reunião?'
    )
    .replace(/por e-?mail/gi, 'aqui no WhatsApp');
}

export function sanitizarRespostaParaCliente(texto: string): string {
  let resposta = (texto || '').trim();
  if (!resposta) return '';

  resposta = resposta
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
    .replace(/\[?response_reasoning\]?[:\s]*[\s\S]*?(?=\n\n|$)/gi, '')
    .trim();

  resposta = limparBlocoInternoStructuredOutput(resposta);
  resposta = removerBlocoMetadadosInternos(resposta);
  resposta = removerAspasEnvolventes(resposta);
  resposta = normalizarTermosComerciaisSensveis(resposta);

  return resposta.trim();
}
