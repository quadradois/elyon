/**
 * DETECTOR DE IA vs IA
 * 
 * Detecta quando um bot/IA está conversando com nosso agente
 * para evitar loops infinitos e custos desnecessários.
 * 
 * Sinais analisados:
 * - Tempo de resposta (muito rápido = suspeito)
 * - Padrões de texto (sem erros, tamanho constante)
 * - Comportamento (respostas genéricas, sem contexto pessoal)
 */

import { prisma } from '../lib/db';

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface MensagemAnalise {
  conteudo: string;
  enviadaEm: Date;
  tempoResposta?: number; // ms desde última mensagem
}

export interface ResultadoDeteccao {
  scoreSuspeita: number; // 0-100
  sinaisDetectados: string[];
  acao: 'CONTINUAR' | 'CAPTCHA' | 'PAUSAR' | 'BLOQUEAR';
  mensagemCaptcha?: string;
}

export interface ConfiguracaoDetector {
  // Limiares
  limiarCaptcha: number;      // Score para inserir CAPTCHA (default: 50)
  limiarPausar: number;       // Score para pausar automação (default: 70)
  limiarBloquear: number;     // Score para bloquear (default: 90)
  
  // Janelas de análise
  mensagensAnalisar: number;  // Quantas mensagens analisar (default: 10)
  tempoRespostaSuspeito: number; // ms (default: 3000)
}

const CONFIG_PADRAO: ConfiguracaoDetector = {
  limiarCaptcha: 50,
  limiarPausar: 70,
  limiarBloquear: 90,
  mensagensAnalisar: 10,
  tempoRespostaSuspeito: 3000
};

// ============================================
// PERGUNTAS CAPTCHA CONVERSACIONAL
// ============================================

const PERGUNTAS_CAPTCHA = [
  {
    pergunta: "Só pra eu te conhecer melhor! 😊 Você está buscando o imóvel pra você ou pra outra pessoa?",
    validacao: (resposta: string) => {
      // Resposta deve ter contexto pessoal
      const palavrasPessoais = ['eu', 'meu', 'minha', 'família', 'filhos', 'esposa', 'marido', 'pais', 'mãe', 'pai'];
      return palavrasPessoais.some(p => resposta.toLowerCase().includes(p));
    }
  },
  {
    pergunta: "Antes de continuar, me conta: qual bairro você mais gosta na cidade? Tem algum motivo especial?",
    validacao: (resposta: string) => {
      // Resposta deve mencionar bairro ou motivo
      return resposta.length > 20 && !resposta.toLowerCase().includes('não sei');
    }
  },
  {
    pergunta: "Curiosidade: você trabalha perto de casa ou faz home office? Isso ajuda a escolher a localização!",
    validacao: (resposta: string) => {
      const palavrasTrabalho = ['trabalho', 'escritório', 'home office', 'remoto', 'empresa', 'perto', 'longe'];
      return palavrasTrabalho.some(p => resposta.toLowerCase().includes(p));
    }
  },
  {
    pergunta: "Me conta um pouco sobre você! O que é mais importante pra você num imóvel: localização, preço ou tamanho?",
    validacao: (resposta: string) => {
      // Resposta deve escolher ou elaborar
      return resposta.length > 15;
    }
  }
];

// ============================================
// CLASSE PRINCIPAL
// ============================================

class DetectorIA {
  private config: ConfiguracaoDetector;
  
  constructor(config?: Partial<ConfiguracaoDetector>) {
    this.config = { ...CONFIG_PADRAO, ...config };
  }
  
  /**
   * Analisa uma conversa e retorna score de suspeita
   */
  async analisar(
    leadId: string,
    mensagensRecentes: MensagemAnalise[]
  ): Promise<ResultadoDeteccao> {
    const sinais: string[] = [];
    let score = 0;
    
    if (mensagensRecentes.length < 3) {
      return {
        scoreSuspeita: 0,
        sinaisDetectados: [],
        acao: 'CONTINUAR'
      };
    }
    
    // 1. Analisar tempo de resposta
    const analiseTempoResposta = this.analisarTempoResposta(mensagensRecentes);
    score += analiseTempoResposta.score;
    if (analiseTempoResposta.suspeito) {
      sinais.push(analiseTempoResposta.motivo);
    }
    
    // 2. Analisar padrões de texto
    const analisePadroesTexto = this.analisarPadroesTexto(mensagensRecentes);
    score += analisePadroesTexto.score;
    sinais.push(...analisePadroesTexto.sinais);
    
    // 3. Analisar comportamento
    const analiseComportamento = this.analisarComportamento(mensagensRecentes);
    score += analiseComportamento.score;
    sinais.push(...analiseComportamento.sinais);
    
    // 4. Verificar horário suspeito
    const analiseHorario = this.analisarHorario(mensagensRecentes);
    score += analiseHorario.score;
    if (analiseHorario.suspeito) {
      sinais.push(analiseHorario.motivo);
    }
    
    // Limitar score a 100
    score = Math.min(score, 100);
    
    // Determinar ação
    const acao = this.determinarAcao(score);
    
    // Gerar pergunta CAPTCHA se necessário
    let mensagemCaptcha: string | undefined;
    if (acao === 'CAPTCHA') {
      mensagemCaptcha = this.gerarPerguntaCaptcha();
    }
    
    // Registrar análise no banco (para métricas)
    await this.registrarAnalise(leadId, score, sinais, acao);
    
    return {
      scoreSuspeita: score,
      sinaisDetectados: sinais,
      acao,
      mensagemCaptcha
    };
  }
  
  /**
   * Analisa tempo de resposta das mensagens
   */
  private analisarTempoResposta(mensagens: MensagemAnalise[]): {
    score: number;
    suspeito: boolean;
    motivo: string;
  } {
    const temposResposta = mensagens
      .filter(m => m.tempoResposta !== undefined)
      .map(m => m.tempoResposta!);
    
    if (temposResposta.length < 2) {
      return { score: 0, suspeito: false, motivo: '' };
    }
    
    // Calcular média
    const mediaMs = temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length;
    
    // Resposta muito rápida consistentemente = suspeito
    if (mediaMs < 2000) {
      return {
        score: 30,
        suspeito: true,
        motivo: `Tempo médio de resposta muito baixo: ${Math.round(mediaMs)}ms`
      };
    }
    
    if (mediaMs < this.config.tempoRespostaSuspeito) {
      return {
        score: 15,
        suspeito: true,
        motivo: `Tempo de resposta consistentemente rápido: ${Math.round(mediaMs)}ms`
      };
    }
    
    return { score: 0, suspeito: false, motivo: '' };
  }
  
  /**
   * Analisa padrões de texto das mensagens
   */
  private analisarPadroesTexto(mensagens: MensagemAnalise[]): {
    score: number;
    sinais: string[];
  } {
    const sinais: string[] = [];
    let score = 0;
    
    const conteudos = mensagens.map(m => m.conteudo);
    
    // 1. Verificar se não tem erros de digitação (muito perfeito)
    const temErrosDigitacao = conteudos.some(c => 
      /[a-z]{2,}[A-Z]|[^aeiouAEIOU]{5,}/.test(c) || // Caps lock errado ou consonantes demais
      c.includes('..') ||
      c.includes('  ')
    );
    
    if (!temErrosDigitacao && conteudos.length >= 5) {
      score += 10;
      sinais.push('Nenhum erro de digitação em múltiplas mensagens');
    }
    
    // 2. Verificar tamanho constante das mensagens
    const tamanhos = conteudos.map(c => c.length);
    const mediaTamanho = tamanhos.reduce((a, b) => a + b, 0) / tamanhos.length;
    const variacaoTamanho = tamanhos.reduce((sum, t) => sum + Math.abs(t - mediaTamanho), 0) / tamanhos.length;
    
    if (variacaoTamanho < 20 && tamanhos.length >= 5) {
      score += 15;
      sinais.push(`Tamanho das mensagens muito constante (variação: ${Math.round(variacaoTamanho)})`);
    }
    
    // 3. Verificar ausência de gírias/informalidades
    const palavrasInformais = ['vc', 'tb', 'tbm', 'pq', 'q', 'n', 'blz', 'vlw', 'pra', 'tá', 'tô', 'né'];
    const usaInformalidade = conteudos.some(c => 
      palavrasInformais.some(p => c.toLowerCase().includes(p))
    );
    
    if (!usaInformalidade && conteudos.length >= 5) {
      score += 10;
      sinais.push('Linguagem muito formal, sem gírias ou abreviações');
    }
    
    // 4. Verificar padrão de emoji (sempre no mesmo lugar ou nunca)
    const emojisPattern = conteudos.map(c => {
      const emojiMatch = c.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/gu);
      return emojiMatch ? emojiMatch.length : 0;
    });
    
    const todosIguais = emojisPattern.every(e => e === emojisPattern[0]);
    if (todosIguais && emojisPattern.length >= 5) {
      score += 5;
      sinais.push('Uso de emojis em padrão robótico');
    }
    
    return { score, sinais };
  }
  
  /**
   * Analisa comportamento conversacional
   */
  private analisarComportamento(mensagens: MensagemAnalise[]): {
    score: number;
    sinais: string[];
  } {
    const sinais: string[] = [];
    let score = 0;
    
    const conteudos = mensagens.map(m => m.conteudo.toLowerCase());
    
    // 1. Verificar se nunca faz perguntas pessoais
    const fazPerguntas = conteudos.some(c => c.includes('?') && c.length > 20);
    if (!fazPerguntas && conteudos.length >= 5) {
      score += 10;
      sinais.push('Nunca faz perguntas, apenas responde');
    }
    
    // 2. Verificar respostas muito genéricas
    const respostasGenericas = ['ok', 'sim', 'não', 'certo', 'entendi', 'claro', 'pode ser'];
    const qtdGenericas = conteudos.filter(c => respostasGenericas.includes(c.trim())).length;
    
    if (qtdGenericas >= 3) {
      score += 15;
      sinais.push(`Muitas respostas genéricas (${qtdGenericas} de ${conteudos.length})`);
    }
    
    // 3. Verificar ausência de contexto pessoal
    const palavrasPessoais = ['eu', 'meu', 'minha', 'família', 'trabalho', 'filho', 'esposa', 'marido'];
    const temContextoPessoal = conteudos.some(c => 
      palavrasPessoais.some(p => c.includes(p))
    );
    
    if (!temContextoPessoal && conteudos.length >= 5) {
      score += 10;
      sinais.push('Nenhum contexto pessoal nas respostas');
    }
    
    // 4. Verificar respostas que parecem scripts
    const padroesScript = [
      /obrigad[oa] pela informação/i,
      /vou verificar/i,
      /agradeço o contato/i,
      /posso ajudar em algo mais/i
    ];
    
    const pareceScript = conteudos.some(c => 
      padroesScript.some(p => p.test(c))
    );
    
    if (pareceScript) {
      score += 20;
      sinais.push('Respostas com padrão de script/bot detectado');
    }
    
    return { score, sinais };
  }
  
  /**
   * Analisa horário das mensagens
   */
  private analisarHorario(mensagens: MensagemAnalise[]): {
    score: number;
    suspeito: boolean;
    motivo: string;
  } {
    // Verificar se responde de madrugada instantaneamente
    const msgMadrugada = mensagens.filter(m => {
      const hora = m.enviadaEm.getHours();
      return hora >= 0 && hora < 6;
    });
    
    if (msgMadrugada.length >= 3) {
      const temposRapidos = msgMadrugada.filter(m => 
        m.tempoResposta && m.tempoResposta < 5000
      );
      
      if (temposRapidos.length >= 2) {
        return {
          score: 20,
          suspeito: true,
          motivo: 'Respostas instantâneas de madrugada (0h-6h)'
        };
      }
    }
    
    return { score: 0, suspeito: false, motivo: '' };
  }
  
  /**
   * Determina ação baseada no score
   */
  private determinarAcao(score: number): ResultadoDeteccao['acao'] {
    if (score >= this.config.limiarBloquear) return 'BLOQUEAR';
    if (score >= this.config.limiarPausar) return 'PAUSAR';
    if (score >= this.config.limiarCaptcha) return 'CAPTCHA';
    return 'CONTINUAR';
  }
  
  /**
   * Gera uma pergunta CAPTCHA aleatória
   */
  private gerarPerguntaCaptcha(): string {
    const indice = Math.floor(Math.random() * PERGUNTAS_CAPTCHA.length);
    return PERGUNTAS_CAPTCHA[indice].pergunta;
  }
  
  /**
   * Valida resposta do CAPTCHA
   */
  validarRespostaCaptcha(perguntaOriginal: string, resposta: string): boolean {
    const captcha = PERGUNTAS_CAPTCHA.find(c => c.pergunta === perguntaOriginal);
    if (!captcha) return true; // Se não encontrar, deixa passar
    
    return captcha.validacao(resposta);
  }
  
  /**
   * Registra análise no banco para métricas
   */
  private async registrarAnalise(
    leadId: string,
    score: number,
    sinais: string[],
    acao: string
  ): Promise<void> {
    try {
      // Log para análise posterior
      console.log(`[DETECTOR-IA] Lead ${leadId}: Score ${score}, Ação: ${acao}`);
      if (sinais.length > 0) {
        console.log(`[DETECTOR-IA] Sinais: ${sinais.join(', ')}`);
      }
      
      // TODO: Salvar em tabela de métricas quando criada
      // await prisma.metricaDeteccaoIA.create({...})
      
    } catch (error) {
      console.error('[DETECTOR-IA] Erro ao registrar análise:', error);
    }
  }
  
  /**
   * Gera mensagem de bloqueio educada
   */
  gerarMensagemBloqueio(): string {
    return `Para continuar nossa conversa, por favor entre em contato diretamente com nosso corretor pelo telefone ou visite nossa imobiliária. 📞

Será um prazer atendê-lo pessoalmente!`;
  }
  
  /**
   * Gera mensagem de pausa
   */
  gerarMensagemPausa(): string {
    return `Notei que temos muitas mensagens! 😊 

Para te ajudar melhor, vou passar você para um de nossos especialistas. Aguarde um momento que ele vai entrar em contato!`;
  }
}

// Exportar instância singleton
export const detectorIA = new DetectorIA();

// Exportar classe para testes
export { DetectorIA };
