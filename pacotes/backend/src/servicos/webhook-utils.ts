export type DeteccaoInteresse = {
  tipoInteresse: 'VENDA' | 'LOCACAO' | 'AMBOS';
  temperatura: 'MORNO' | 'QUENTE';
  timeline?: string;
};

export type TelemetriaConversaoStatus = 'nao_elegivel' | 'ja_convertido' | 'convertido' | 'falha_conversao' | 'inconsistente_pos_conversao';

export function registrarTelemetriaConversao(payload: {
  status: TelemetriaConversaoStatus;
  contatoId: string;
  textoConversa: string;
  deteccao?: DeteccaoInteresse;
  reasonCode?: string;
  erro?: string;
  leadId?: string;
}) {
  const resumoTexto = (payload.textoConversa || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const log = {
    status: payload.status,
    contatoId: payload.contatoId,
    leadId: payload.leadId || null,
    reasonCode: payload.reasonCode || null,
    erro: payload.erro || null,
    deteccao: payload.deteccao || null,
    resumoTexto,
    timestamp: new Date().toISOString()
  };

  const prefixo = '[Webhook][AUTO_CONVERSAO]';
  if (payload.status === 'convertido') {
    console.log(prefixo, JSON.stringify(log));
    return;
  }

  if (payload.status === 'nao_elegivel' || payload.status === 'ja_convertido') {
    console.info(prefixo, JSON.stringify(log));
    return;
  }

  console.warn(prefixo, JSON.stringify(log));
}

export function detectarInteresseVendaLocacao(texto: string): DeteccaoInteresse | null {
  const normalizado = (texto || '').toLowerCase().trim();
  if (!normalizado) return null;

  const padraoNegacao = /\b(n[aã]o|nao)\s+(quero|pretendo|tenho\s+interesse\s+em|vou)?\s*(vender|alugar|locar|loca[cç][aã]o|venda|aluguel)\b/i;
  if (padraoNegacao.test(normalizado)) return null;

  const mencionaVenda = /\b(vender|venda|vendo|dispon[ií]vel\s+pra\s+venda|dispon[ií]vel\s+para\s+venda)\b/i.test(normalizado);
  const mencionaLocacao = /\b(alugar|aluguel|loca[cç][aã]o|locar|dispon[ií]vel\s+pra\s+alugar|dispon[ií]vel\s+para\s+alugar)\b/i.test(normalizado);
  const mencionaAnuncioAtivo = /\b(anunciando|anunciado|anuncio|publicado|publicando)\b/i.test(normalizado);
  const mencionaInteresse = /\b(tenho\s+intere+s+e|tenho\s+intersse|interesse|quero|pretendo|gostaria\s+de|tenho\s+apartamento|tenho\s+im[oó]vel|tenho\s+uma\s+casa|sim|minha\s+inten(c|ç)[aã]o\s+[ée]?\s*(vender|alugar)|inten(c|ç)[aã]o\s+[ée]?\s*(vender|alugar))\b/i.test(normalizado);
  const afirmaDecisao = /\b(j[aá]\s+defini\s+(vender|alugar)|decidi\s+(vender|alugar)|vou\s+(vender|alugar)|estou\s+(vendendo|alugando)|quero\s+(vender|alugar)|pretendo\s+(vender|alugar)|preciso\s+(de\s+)?(vender|alugar)|j[aá]\s+estou\s+anunciando|estou\s+anunciando)\b/i.test(normalizado);
  const confirmouIntencaoDireta = /^\s*(sim\s+)?(vender|alugar|locar|loca[cç][aã]o)\s*!?\s*$/i.test(normalizado);

  const temSinalTipoInteresse = mencionaVenda || mencionaLocacao || mencionaAnuncioAtivo || confirmouIntencaoDireta;
  const temSinalIntencao = mencionaInteresse || afirmaDecisao || confirmouIntencaoDireta;

  if (!temSinalTipoInteresse || !temSinalIntencao) {
    return null;
  }

  const urgenciaAlta = /\b(urgente|urg[êe]ncia|imediat|agora|o\s+quanto\s+antes|essa\s+semana|este\s+m[eê]s)\b/i.test(normalizado);

  return {
    tipoInteresse: mencionaVenda && mencionaLocacao ? 'AMBOS' : mencionaVenda ? 'VENDA' : 'LOCACAO',
    temperatura: urgenciaAlta ? 'QUENTE' : 'MORNO',
    timeline: urgenciaAlta ? 'urgente' : undefined
  };
}

export function registrarIgnorado(telefone: string, motivo: string, contatoId?: string) {
  const contatoInfo = contatoId ? `contato=${contatoId}` : 'contato=N/A';
  console.log(`[Webhook] ⛔ Ignorado (${motivo}) telefone=${telefone} ${contatoInfo}`);
}

export type TelemetriaSaidaStatus = 'tentativa' | 'sucesso' | 'falha';

export function registrarTelemetriaSaida(payload: {
  status: TelemetriaSaidaStatus;
  contatoId: string;
  telefone: string;
  tentativa: number;
  totalTentativas: number;
  erro?: string;
  statusCode?: number;
}) {
  const prefixo = '[Webhook][SAIDA_WHATSAPP]';
  const log = {
    status: payload.status,
    contatoId: payload.contatoId,
    telefone: payload.telefone,
    tentativa: payload.tentativa,
    totalTentativas: payload.totalTentativas,
    statusCode: payload.statusCode || null,
    erro: payload.erro || null,
    timestamp: new Date().toISOString()
  };

  if (payload.status === 'sucesso') {
    console.log(prefixo, JSON.stringify(log));
    return;
  }

  if (payload.status === 'tentativa') {
    console.info(prefixo, JSON.stringify(log));
    return;
  }

  console.warn(prefixo, JSON.stringify(log));
}

export function aguardar(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
