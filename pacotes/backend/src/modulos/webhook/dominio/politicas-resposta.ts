import type { MensagemPendente, PerfilVendaTenant, PreferenciaAudio } from './tipos';

export const MARCADOR_AUDIO_PERMITIDO = '[PREFERENCIA_AUDIO=PERMITIDO]';
export const MARCADOR_AUDIO_NEGADO = '[PREFERENCIA_AUDIO=NEGADO]';
export const MARCADOR_AUDIO_PERGUNTADO = '[PREFERENCIA_AUDIO=PERGUNTADO]';

export function normalizarTextoAssinatura(texto: string): string {
  return (texto || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function normalizarTextoAssinaturaForte(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function construirInstrucaoTurnoMensagensSequenciais(
  mensagens: MensagemPendente[],
): string | undefined {
  if (!Array.isArray(mensagens) || mensagens.length <= 1) return undefined;

  const textos = mensagens.map((mensagem) => (mensagem?.conteudo || '').trim()).filter(Boolean);
  if (textos.length <= 1) return undefined;

  const blob = textos.join('\n').toLowerCase();
  const topicos: string[] = [];
  const instrucoesExtras: string[] = [];
  if (/como.*(encontrou|conseguiu).*(numero|número)|onde.*(conseguiu|pegou).*(numero|número)|de onde.*(numero|número)|lista p[úu]blica|privacidade/.test(blob)) {
    topicos.push('origem do número e privacidade');
  }
  if (/(quais|que|o que).*(informac|dados).*(enviar|preciso)|o que te enviar|quais informa(c|ç)ões tenho que te enviar/.test(blob)) {
    topicos.push('dados necessários para avançar');
  }
  if (/documenta(c|ç)[aã]o|documentos?|precisa de alguma documenta/.test(blob)) {
    topicos.push('documentação necessária');
  }
  if (/exclusiv|exclusivo|controle de tudo|como voc[eê]s conseguem ter o controle/.test(blob)) {
    topicos.push('modelo de trabalho e exclusividade');
  }

  const valoresDetectados = Array.from(new Set(
    (blob.match(/(?:r\$\s*)?\d{2,3}(?:[.\s]?\d{3})*(?:,\d{2})?|\b\d+(?:[.,]\d+)?\s*(?:k|mil|mi)\b/gi) || [])
      .map((valor) => valor.replace(/\s+/g, ' ').trim())
      .filter((valor) => /\d/.test(valor)),
  ));
  if (valoresDetectados.length >= 2) {
    topicos.push('reconciliação de valores informados no mesmo contexto');
    instrucoesExtras.push(
      `Há potencial conflito de valor (${valoresDetectados.slice(0, 3).join(' vs ')}). Confirme o valor final com uma frase objetiva no formato: "Confirmando: R$ X líquidos para você, comissão à parte, certo?"`,
    );
  }
  if (/\ba vista\b|à vista|financiamento|financiad[oa]/.test(blob)) {
    topicos.push('condição de pagamento');
    instrucoesExtras.push('Consolide condição financeira junto com valor final (à vista/financiamento e líquido/comissão).');
  }

  const perguntas = textos.filter((texto) => texto.includes('?')).map((texto) => texto.slice(0, 140));
  const perguntasRecentes = perguntas.length > 0
    ? `Perguntas recentes do lead: ${perguntas.map((pergunta) => `"${pergunta}"`).join(' | ')}`
    : '';
  const topicosTexto = topicos.length > 0
    ? topicos.join('; ')
    : 'responder todas as mensagens sequenciais sem omitir nenhuma pergunta';

  return `[INSTRUÇÃO DE TURNO - MENSAGENS SEQUENCIAIS]
O lead enviou múltiplas mensagens em sequência no mesmo contexto. Responda PRIMEIRO todos os tópicos pendentes antes de fazer uma nova pergunta.
Tópicos obrigatórios neste turno: ${topicosTexto}.
${perguntasRecentes}
${instrucoesExtras.join('\n')}
Regra: resposta única, objetiva, cobrindo tudo que o lead perguntou neste bloco.`;
}

export function gerarFallbackSemSilencio(textoConsolidado: string): string {
  const texto = (textoConsolidado || '').toLowerCase();
  if (/(como|onde).*(encontrou|conseguiu).*(numero|número)|de onde.*(numero|número)/.test(texto)) {
    return 'Perfeito, te explico com transparência: seu contato veio de base pública de proprietários da região para prospecção imobiliária. Se preferir, eu encerro por aqui sem problema.';
  }
  if (/(quais|que|o que).*(informac|dados).*(enviar|preciso)|documenta(c|ç)[aã]o|documentos?/.test(texto)) {
    return 'Ótima pergunta. Para avançar agora, preciso só de dados básicos do imóvel (metragem, situação, valor pretendido e se já está anunciando). A documentação completa fica para a etapa seguinte, com orientação do corretor.';
  }
  return 'Perfeito, recebi suas mensagens. Para não te deixar sem retorno: já organizei seu contexto aqui e vou te responder objetivamente no próximo passo. Pode contar comigo.';
}

export function detectarPermissaoAudioNoTexto(texto: string): Exclude<PreferenciaAudio, 'PERGUNTADO'> | null {
  const normalizado = normalizarTextoAssinaturaForte(texto || '');
  if (!normalizado) return null;
  if (
    /\b(pode|podes|pode sim|manda|mandar|envia|enviar|responde|responder)\b.*\b(audio|áudio|voz|falando)\b/.test(normalizado)
    || /\b(audio|áudio|voz)\b.*\b(pode|sim|manda|envia|ok|pode sim)\b/.test(normalizado)
    || /\bpode mandar audio\b/.test(normalizado)
    || /\bmanda audio\b/.test(normalizado)
  ) return 'PERMITIDO';
  if (
    /\b(nao|não)\b.*\b(audio|áudio|voz)\b/.test(normalizado)
    || /\b(prefiro|melhor)\b.*\b(texto|escrito|mensagem)\b/.test(normalizado)
    || /\bsem audio\b/.test(normalizado)
    || /\bagora nao posso ouvir\b/.test(normalizado)
    || /\bnao posso ouvir\b/.test(normalizado)
  ) return 'NEGADO';
  return null;
}

export function preferenciaAudioPorObservacoes(observacoes?: string | null): PreferenciaAudio | null {
  const observacoesAtuais = observacoes || '';
  if (observacoesAtuais.includes(MARCADOR_AUDIO_NEGADO)) return 'NEGADO';
  if (observacoesAtuais.includes(MARCADOR_AUDIO_PERMITIDO)) return 'PERMITIDO';
  if (observacoesAtuais.includes(MARCADOR_AUDIO_PERGUNTADO)) return 'PERGUNTADO';
  return null;
}

export function clienteMandouAudio(mensagens: MensagemPendente[]): boolean {
  return mensagens.some((mensagem) => mensagem.tipo === 'AUDIO');
}

export function contemLinkOuAgendamentoOperacional(texto: string): boolean {
  const normalizado = normalizarTextoAssinaturaForte(texto || '');
  const bruto = texto || '';
  const contemLink = /https?:\/\/|www\.|wa\.me\/|bit\.ly\/|maps\.app\.goo\.gl|goo\.gl\/maps|calendar\.google|meet\.google|zoom\.us|teams\.microsoft/i.test(bruto);
  const contemAgenda =
    /\b(agendad[oa]|confirmad[oa]|marcad[oa]|horario confirmado|visita confirmada|agenda confirmada|reuniao confirmada|reunião confirmada)\b/.test(normalizado)
    || /\b(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\b.*\b(\d{1,2}h|\d{1,2}:\d{2})\b/.test(normalizado)
    || /\b(hoje|amanha|amanhã)\b.*\b(\d{1,2}h|\d{1,2}:\d{2})\b/.test(normalizado);
  return contemLink || contemAgenda;
}

export function deveResponderEmAudio(params: {
  respostaEmAudioAtiva: boolean;
  preferenciaAudio: PreferenciaAudio | null;
  clienteEnviouAudio: boolean;
  resposta: string;
}): boolean {
  if (!params.respostaEmAudioAtiva) return false;
  if (contemLinkOuAgendamentoOperacional(params.resposta)) return false;
  if (params.preferenciaAudio === 'NEGADO') return false;
  if (params.preferenciaAudio === 'PERMITIDO') return true;
  return params.clienteEnviouAudio;
}

export function devePedirPermissaoAudio(params: {
  respostaEmAudioAtiva: boolean;
  preferenciaAudio: PreferenciaAudio | null;
  clienteEnviouAudio: boolean;
  textoConsolidado: string;
  resposta: string;
}): boolean {
  if (!params.respostaEmAudioAtiva || params.preferenciaAudio || params.clienteEnviouAudio) return false;
  if (detectarPermissaoAudioNoTexto(params.textoConsolidado)) return false;
  return params.resposta.length >= 140;
}

export function anexarPedidoPermissaoAudio(resposta: string): string {
  const base = resposta.trim();
  if (base.toLowerCase().includes('responder por áudio') || base.toLowerCase().includes('responder em áudio')) return base;
  return `${base}\n\nSe for mais prático pra você, posso te responder por áudio também. Pode ser ou prefere que eu mantenha tudo por texto?`;
}

export function textoPedeDocumentoAutorizacao(texto: string): boolean {
  const normalizado = normalizarTextoAssinaturaForte(texto || '');
  if (!normalizado) return false;
  return /(manda|enviar|envia|me mostra|quero ver|pode mandar).*(documento|termos|autorizacao|autorização|contrato)/.test(normalizado)
    || /(documento|termos|autorizacao|autorização|contrato).*(manda|enviar|envia|ver)/.test(normalizado);
}

export function respostaOfereceEmailParaTermos(resposta: string): boolean {
  const texto = normalizarTextoAssinaturaForte(resposta || '');
  return /(termos|autorizacao|autorização|documento).*(e mail|email)/.test(texto)
    || /(enviar|envio).*(e mail|email).*(termos|autorizacao|autorização|documento)/.test(texto);
}

export function normalizarCanalTermosParaWhatsapp(resposta: string): string {
  return (resposta || '')
    .replace(
      /quer que eu te envie os termos por e-?mail para ver antes ou prefere que o corretor explique tudo na nossa pr[oó]xima reuni[aã]o\?/gi,
      'Quer que eu te envie o documento de autorização aqui no WhatsApp para você analisar com calma, ou prefere que o corretor explique tudo na nossa próxima reunião?',
    )
    .replace(/por e-?mail/gi, 'aqui no WhatsApp');
}

export function construirInstrucaoExclusividadePorTenant(
  perfilVendaTenant: PerfilVendaTenant | null | undefined,
  textoConsolidado: string,
): string | undefined {
  const texto = normalizarTextoAssinaturaForte(textoConsolidado || '');
  if (!/(exclusiv|exclusivo|controle de tudo)/.test(texto)) return undefined;
  const modalidades = Array.isArray(perfilVendaTenant?.modalidadesVenda)
    ? Array.from(new Set(perfilVendaTenant.modalidadesVenda))
    : [];
  const temExclusiva = modalidades.includes('EXCLUSIVA');
  const temNaoExclusiva = modalidades.includes('NAO_EXCLUSIVA');
  if (temExclusiva && !temNaoExclusiva) {
    return `[INSTRUÇÃO DE TURNO - EXCLUSIVIDADE]
Pergunta do lead sobre exclusividade detectada.
Responda DIRETAMENTE primeiro: esta imobiliária trabalha com autorização EXCLUSIVA.
Depois explique em linguagem consultiva (sem termos proibidos) e convide para próximo passo.
Nunca use "contrato simples" e nunca diga "duas opções de contrato".`;
  }
  if (!temExclusiva && temNaoExclusiva) {
    return `[INSTRUÇÃO DE TURNO - EXCLUSIVIDADE]
Pergunta do lead sobre exclusividade detectada.
Responda DIRETAMENTE primeiro: esta imobiliária trabalha com autorização NÃO EXCLUSIVA.
Depois explique como coordena processo e resultados mesmo sem exclusividade.
Nunca use "contrato simples" e nunca diga "duas opções de contrato".`;
  }
  const preferencial = perfilVendaTenant?.modalidadePreferencial === 'NAO_EXCLUSIVA' ? 'não exclusiva' : 'exclusiva';
  return `[INSTRUÇÃO DE TURNO - EXCLUSIVIDADE]
Pergunta do lead sobre exclusividade detectada.
Responda DIRETAMENTE primeiro: a imobiliária pode operar com autorização exclusiva e não exclusiva.
Em seguida, deixe claro que a recomendação inicial costuma ser ${preferencial}, ajustada ao contexto do proprietário.
Nunca use "contrato simples" e nunca diga "duas opções de contrato".`;
}

export function gerarAssinaturaLote(contatoId: string, mensagens: MensagemPendente[]): string {
  const ids = mensagens.map((mensagem) => mensagem.messageId).filter((id): id is string => !!id).sort();
  if (ids.length > 0) return `${contatoId}|ids:${ids.join('|')}`;
  const textos = mensagens
    .map((mensagem) => normalizarTextoAssinatura(mensagem.conteudo))
    .filter(Boolean)
    .join('|')
    .slice(0, 240);
  const ultimoTimestamp = mensagens.length > 0
    ? Math.max(...mensagens.map((mensagem) => mensagem.timestamp || 0))
    : Date.now();
  return `${contatoId}|txt:${textos}|n:${mensagens.length}|b:${Math.floor(ultimoTimestamp / 5000)}`;
}
