/**
 * ANÁLISE DE SENTIMENTO EM TEMPO REAL
 * 
 * Classifica o sentimento da última mensagem do lead para que o
 * orquestrador ajuste o tom e a estratégia do agente automaticamente.
 * 
 * Implementação leve baseada em padrões lexicais (sem chamada de LLM),
 * garantindo latência zero no pipeline de processamento de mensagens.
 * 
 * @version 1.0
 * @date 02/04/2026
 */

export type Sentimento = 'POSITIVO' | 'NEUTRO' | 'NEGATIVO' | 'IRRITADO';

export interface ResultadoSentimento {
  sentimento: Sentimento;
  confianca: number; // 0-100
  sinaisDetectados: string[];
}

// ====================================
// PADRÕES LEXICAIS
// ====================================

const PADROES_POSITIVO: RegExp[] = [
  /\b(sim|pode|quero|aceito|concordo|fechado|combinado|ótimo|maravilh|excelent|perfeito|legal|bacana|massa|show|top|demais|amei|adorei|interessant|gostei|faz sentido|pode ser|vamos|bora)\b/i,
  /\b(obrigad[oa]|parabéns|grat[oa]|satisfeito|feliz|contente|animad[oa])\b/i,
  /😊|😃|😍|🤩|👍|✅|💪|🙏|❤️|🎉|😄|🥰|👏/,
  /\b(tá bom|tudo certo|tudo ok|tá ótimo|pode sim|com certeza|claro|lógico)\b/i,
];

const PADROES_NEGATIVO: RegExp[] = [
  /\b(não|nao|nem|nunca|jamais|difícil|complicado|impossível|problema|ruim|péssim[oa]|horrível|terrível|lament[oa]|infelizment|decepcion|frustr)\b/i,
  /\b(desist|cancel|parar|caro|muito caro|absurdo|exagero|sem condição|não vale)\b/i,
  /😔|😢|😞|👎|😕|🙁|😟|💔/,
  /\b(não gostei|não quero|não preciso|deixa pra lá|esquece)\b/i,
];

const PADROES_IRRITADO: RegExp[] = [
  /\b(para|pare|chega|basta|spam|golpe|fraude|denunci|bloqu|saco|inferno|merda|porra|droga|cacete)\b/i,
  /\b(me deixa em paz|não me ligue|não mande mais|quem te deu|como conseguiu|invadindo|assédio|processarei|advogado|justiça|procon)\b/i,
  /\b(irritad[oa]|raiv[oa]|furios[oa]|brav[oa]|puto|estressad[oa]|enojad[oa])\b/i,
  /😡|🤬|😤|💢|🖕/,
  /[!?]{3,}/, // Excesso de pontuação
  /[A-ZÁÉÍÓÚÃÕÇÊ\s]{15,}/, // Texto em CAPS LOCK extenso
];

// ====================================
// ANALISAR SENTIMENTO
// ====================================

/**
 * Analisa o sentimento de uma mensagem do lead.
 * Execução síncrona — sem chamada de LLM, baseada em padrões lexicais.
 * Latência: < 1ms.
 */
export function analisarSentimento(mensagem: string): ResultadoSentimento {
  if (!mensagem || mensagem.trim().length === 0) {
    return { sentimento: 'NEUTRO', confianca: 50, sinaisDetectados: [] };
  }

  const sinais: string[] = [];
  let scoreIrritado = 0;
  let scoreNegativo = 0;
  let scorePositivo = 0;

  // Verificar padrões de irritação (prioridade máxima)
  for (const padrao of PADROES_IRRITADO) {
    const match = mensagem.match(padrao);
    if (match) {
      scoreIrritado += 30;
      sinais.push(`IRRITADO: "${match[0]}"`);
    }
  }

  // Verificar padrões negativos
  for (const padrao of PADROES_NEGATIVO) {
    const match = mensagem.match(padrao);
    if (match) {
      scoreNegativo += 20;
      sinais.push(`NEGATIVO: "${match[0]}"`);
    }
  }

  // Verificar padrões positivos
  for (const padrao of PADROES_POSITIVO) {
    const match = mensagem.match(padrao);
    if (match) {
      scorePositivo += 20;
      sinais.push(`POSITIVO: "${match[0]}"`);
    }
  }

  // Determinar sentimento predominante
  let sentimento: Sentimento;
  let confianca: number;

  if (scoreIrritado >= 30) {
    sentimento = 'IRRITADO';
    confianca = Math.min(95, 50 + scoreIrritado);
  } else if (scoreNegativo > scorePositivo && scoreNegativo >= 20) {
    sentimento = 'NEGATIVO';
    confianca = Math.min(90, 40 + scoreNegativo);
  } else if (scorePositivo > scoreNegativo && scorePositivo >= 20) {
    sentimento = 'POSITIVO';
    confianca = Math.min(90, 40 + scorePositivo);
  } else {
    sentimento = 'NEUTRO';
    confianca = 50;
  }

  return { sentimento, confianca, sinaisDetectados: sinais };
}

/**
 * Gera instrução contextual para o agente baseada no sentimento detectado.
 * Concatenada ao prompt do agente pelo orquestrador.
 */
export function gerarInstrucaoSentimento(resultado: ResultadoSentimento): string {
  switch (resultado.sentimento) {
    case 'IRRITADO':
      return `⚠️ ATENÇÃO: O lead demonstra IRRITAÇÃO (confiança: ${resultado.confianca}%). Adote tom ULTRA-CALMO e empático. Peça desculpas se necessário. NÃO insista, NÃO faça perguntas invasivas. Priorize encerrar a conversa de forma respeitosa se o lead não quiser continuar. Sinais: ${resultado.sinaisDetectados.join(', ')}`;
    
    case 'NEGATIVO':
      return `📉 O lead demonstra sentimento NEGATIVO (confiança: ${resultado.confianca}%). Use tom acolhedor e compreensivo. Valide os sentimentos do lead antes de argumentar. Evite pressão — foque em escuta ativa. Sinais: ${resultado.sinaisDetectados.join(', ')}`;
    
    case 'POSITIVO':
      return `📈 O lead demonstra sentimento POSITIVO (confiança: ${resultado.confianca}%). Aproveite a energia positiva! Seja entusiasmado mas profissional. Bom momento para avançar no funil ou fazer proposta. Sinais: ${resultado.sinaisDetectados.join(', ')}`;
    
    case 'NEUTRO':
    default:
      return ''; // Sem instrução adicional para sentimento neutro
  }
}
