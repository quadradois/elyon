import { prisma } from '../servidor';
import { whatsappService } from '../servicos/whatsapp';
import { openaiService } from '../servicos/openai';

/**
 * SUPERVISOR DE WORKERS
 * 
 * Camada de supervisão que monitora a qualidade das respostas dos workers.
 * Pode intervir quando detecta problemas ou situações que requerem escalação.
 * 
 * Responsabilidades:
 * - Analisar qualidade das respostas antes do envio
 * - Detectar sinais de frustração do cliente
 * - Identificar perguntas fora do escopo dos workers
 * - Escalar para atendente humano quando necessário
 * - Registrar métricas de qualidade
 * 
 * Hierarquia:
 * ELYON CORE → SUPERVISOR → WORKERS (SDR, DOCUMENTOS, etc.)
 */

export interface ContextoSupervisao {
  leadId: string;
  mensagemUsuario: string;
  respostaWorker: string;
  workerOrigem: 'SDR' | 'DOCUMENTOS' | 'FINANCEIRO';
  historicoRecente?: Array<{ role: string; content: string }>;
  temperatura?: string;
  tentativasAnteriores?: number;
}

export interface ResultadoSupervisao {
  aprovado: boolean;
  respostaFinal: string;
  acao: 'ENVIAR' | 'REFINAR' | 'ESCALAR_HUMANO' | 'MUDAR_WORKER';
  motivo?: string;
  novoWorker?: 'SDR' | 'DOCUMENTOS' | 'FINANCEIRO';
  alertaCorretor?: boolean;
  metricasQualidade: {
    confianca: number; // 0-100
    relevancia: number; // 0-100
    tom: 'ADEQUADO' | 'FORMAL_DEMAIS' | 'INFORMAL_DEMAIS';
    riscoEscalacao: number; // 0-100
  };
}

export interface RegrasEscalacao {
  maxTentativasSemQualificacao: number;
  palavrasFrustracao: string[];
  palavrasUrgencia: string[];
  temasEscalarImediato: string[];
}

const regrasEscalacaoPadrao: RegrasEscalacao = {
  maxTentativasSemQualificacao: 5,
  palavrasFrustracao: [
    'raiva', 'absurdo', 'reclamar', 'ouvidoria', 'procon', 'processo',
    'advogado', 'nunca mais', 'péssimo', 'horrível', 'decepcionado',
    'não funciona', 'mentira', 'enganado', 'golpe'
  ],
  palavrasUrgencia: [
    'urgente', 'urgência', 'emergência', 'agora mesmo', 'imediato',
    'prazo final', 'vencer hoje', 'preciso hoje'
  ],
  temasEscalarImediato: [
    'cancelamento', 'rescisão', 'processo judicial', 'devolução integral',
    'multa contratual', 'financiamento negado'
  ]
};

class Supervisor {
  private regras: RegrasEscalacao;

  constructor(regras?: RegrasEscalacao) {
    this.regras = regras || regrasEscalacaoPadrao;
  }

  /**
   * Analisa a resposta do worker antes de enviar ao cliente
   * Pode aprovar, solicitar refinamento ou escalar
   */
  async supervisionar(contexto: ContextoSupervisao): Promise<ResultadoSupervisao> {
    console.log(`[SUPERVISOR] 🔍 Analisando resposta do ${contexto.workerOrigem}`);

    // 1. Verificar sinais de escalação imediata
    const escalacaoImediata = this.verificarEscalacaoImediata(contexto.mensagemUsuario);
    if (escalacaoImediata.escalar) {
      console.log(`[SUPERVISOR] ⚠️  Escalação imediata: ${escalacaoImediata.motivo}`);
      return this.gerarEscalacaoHumana(contexto, escalacaoImediata.motivo!);
    }

    // 2. Analisar qualidade da resposta com IA
    const analise = await this.analisarQualidadeResposta(contexto);

    // 3. Decidir ação baseada na análise
    if (analise.riscoEscalacao > 70) {
      console.log(`[SUPERVISOR] 🚨 Alto risco de escalação (${analise.riscoEscalacao}%)`);
      return this.gerarEscalacaoHumana(contexto, 'Alto risco de insatisfação detectado');
    }

    if (analise.confianca < 50 || analise.relevancia < 50) {
      console.log(`[SUPERVISOR] 🔄 Resposta precisa refinamento`);
      return await this.refinarResposta(contexto, analise);
    }

    // 4. Verificar se worker está correto para o contexto
    const workerIdeal = this.determinarWorkerIdeal(contexto);
    if (workerIdeal !== contexto.workerOrigem) {
      console.log(`[SUPERVISOR] 🔀 Sugerindo mudança para worker ${workerIdeal}`);
      return {
        aprovado: false,
        respostaFinal: contexto.respostaWorker,
        acao: 'MUDAR_WORKER',
        novoWorker: workerIdeal,
        motivo: `Contexto mais adequado para worker ${workerIdeal}`,
        alertaCorretor: false,
        metricasQualidade: analise
      };
    }

    // 5. Aprovado - resposta pode ser enviada
    console.log(`[SUPERVISOR] ✅ Resposta aprovada (confiança: ${analise.confianca}%)`);
    return {
      aprovado: true,
      respostaFinal: contexto.respostaWorker,
      acao: 'ENVIAR',
      alertaCorretor: analise.riscoEscalacao > 40,
      metricasQualidade: analise
    };
  }

  /**
   * Verifica sinais que requerem escalação humana imediata
   */
  private verificarEscalacaoImediata(mensagem: string): { escalar: boolean; motivo?: string } {
    const mensagemLower = mensagem.toLowerCase();

    // Verificar temas de escalação imediata
    for (const tema of this.regras.temasEscalarImediato) {
      if (mensagemLower.includes(tema.toLowerCase())) {
        return { escalar: true, motivo: `Tema sensível detectado: ${tema}` };
      }
    }

    // Verificar palavras de frustração intensa
    const palavrasFrustracao = this.regras.palavrasFrustracao.filter(p => 
      mensagemLower.includes(p.toLowerCase())
    );
    if (palavrasFrustracao.length >= 2) {
      return { escalar: true, motivo: `Múltiplos sinais de frustração: ${palavrasFrustracao.join(', ')}` };
    }

    // Verificar se cliente pede explicitamente por humano
    const pedeHumano = [
      'falar com pessoa', 'atendente humano', 'quero falar com alguém',
      'pessoa de verdade', 'não quero robô', 'atendimento humano',
      'falar com gerente', 'supervisor', 'responsável'
    ];
    for (const frase of pedeHumano) {
      if (mensagemLower.includes(frase)) {
        return { escalar: true, motivo: 'Cliente solicitou atendimento humano' };
      }
    }

    return { escalar: false };
  }

  /**
   * Analisa a qualidade da resposta usando IA
   */
  private async analisarQualidadeResposta(
    contexto: ContextoSupervisao
  ): Promise<ResultadoSupervisao['metricasQualidade']> {
    try {
      const prompt = `Você é um supervisor de atendimento. Analise a seguinte interação:

MENSAGEM DO CLIENTE:
${contexto.mensagemUsuario}

RESPOSTA DO ASSISTENTE:
${contexto.respostaWorker}

CONTEXTO: Worker ${contexto.workerOrigem}, Lead temperatura: ${contexto.temperatura || 'desconhecida'}

Analise e retorne APENAS um JSON com:
{
  "confianca": <0-100, quão confiante a resposta parece>,
  "relevancia": <0-100, quão relevante a resposta é para a pergunta>,
  "tom": "<ADEQUADO|FORMAL_DEMAIS|INFORMAL_DEMAIS>",
  "riscoEscalacao": <0-100, risco do cliente ficar insatisfeito>,
  "observacao": "<breve observação>"
}`;

      const resposta = await openaiService.gerarResposta([
        { role: 'system', content: 'Você é um analisador de qualidade. Responda apenas JSON.' },
        { role: 'user', content: prompt }
      ]);

      // Extrair JSON da resposta
      const jsonMatch = resposta.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analise = JSON.parse(jsonMatch[0]);
        return {
          confianca: analise.confianca ?? 70,
          relevancia: analise.relevancia ?? 70,
          tom: analise.tom ?? 'ADEQUADO',
          riscoEscalacao: analise.riscoEscalacao ?? 30
        };
      }
    } catch (error) {
      console.error('[SUPERVISOR] Erro na análise de qualidade:', error);
    }

    // Fallback: valores padrão se análise falhar
    return {
      confianca: 70,
      relevancia: 70,
      tom: 'ADEQUADO',
      riscoEscalacao: 30
    };
  }

  /**
   * Refina uma resposta que não passou na análise de qualidade
   */
  private async refinarResposta(
    contexto: ContextoSupervisao,
    analise: ResultadoSupervisao['metricasQualidade']
  ): Promise<ResultadoSupervisao> {
    try {
      const prompt = `Você é um assistente de imobiliária refinando uma resposta.

MENSAGEM DO CLIENTE:
${contexto.mensagemUsuario}

RESPOSTA ORIGINAL (precisa melhoria):
${contexto.respostaWorker}

PROBLEMAS IDENTIFICADOS:
- Confiança: ${analise.confianca}% (ideal > 70%)
- Relevância: ${analise.relevancia}% (ideal > 70%)
- Tom: ${analise.tom}

INSTRUÇÕES:
1. Mantenha as informações corretas da resposta original
2. Torne a resposta mais direta e relevante à pergunta
3. Ajuste o tom para ser amigável mas profissional
4. Máximo 2 parágrafos
5. Se não souber algo, seja honesto

Responda APENAS com a resposta refinada, sem explicações:`;

      const respostaRefinada = await openaiService.gerarResposta([
        { role: 'system', content: 'Refine a resposta mantendo o contexto.' },
        { role: 'user', content: prompt }
      ]);

      return {
        aprovado: true,
        respostaFinal: respostaRefinada,
        acao: 'REFINAR',
        motivo: 'Resposta refinada pelo supervisor',
        alertaCorretor: false,
        metricasQualidade: {
          ...analise,
          confianca: Math.min(analise.confianca + 20, 100),
          relevancia: Math.min(analise.relevancia + 20, 100)
        }
      };
    } catch (error) {
      console.error('[SUPERVISOR] Erro ao refinar resposta:', error);
      // Se falhar refinamento, envia a original
      return {
        aprovado: true,
        respostaFinal: contexto.respostaWorker,
        acao: 'ENVIAR',
        motivo: 'Refinamento falhou, usando original',
        alertaCorretor: true,
        metricasQualidade: analise
      };
    }
  }

  /**
   * Gera resposta de escalação para atendente humano
   */
  private async gerarEscalacaoHumana(
    contexto: ContextoSupervisao,
    motivo: string
  ): Promise<ResultadoSupervisao> {
    // Mensagem para o cliente
    const respostaEscalacao = `Entendo sua situação e quero garantir o melhor atendimento possível! 🤝

Vou transferir você para um de nossos especialistas que poderá te ajudar de forma mais completa. Um corretor entrará em contato em breve.

Enquanto isso, posso ajudar com mais alguma informação?`;

    // Registrar evento de escalação para alertar corretor
    await this.registrarEscalacao(contexto.leadId, motivo);

    return {
      aprovado: true,
      respostaFinal: respostaEscalacao,
      acao: 'ESCALAR_HUMANO',
      motivo,
      alertaCorretor: true,
      metricasQualidade: {
        confianca: 0,
        relevancia: 0,
        tom: 'ADEQUADO',
        riscoEscalacao: 100
      }
    };
  }

  /**
   * Determina qual worker seria ideal para o contexto atual
   */
  private determinarWorkerIdeal(contexto: ContextoSupervisao): 'SDR' | 'DOCUMENTOS' | 'FINANCEIRO' {
    const mensagemLower = contexto.mensagemUsuario.toLowerCase();

    // Palavras que indicam documentação
    const palavrasDocumentos = [
      'documento', 'cpf', 'rg', 'comprovante', 'certidão', 'matrícula',
      'enviar foto', 'enviar arquivo', 'documentação'
    ];
    if (palavrasDocumentos.some(p => mensagemLower.includes(p))) {
      return 'DOCUMENTOS';
    }

    // Palavras que indicam questões financeiras
    const palavrasFinanceiro = [
      'financiamento', 'parcela', 'entrada', 'prestação', 'crédito',
      'banco', 'aprovação', 'renda', 'score', 'simulação'
    ];
    if (palavrasFinanceiro.some(p => mensagemLower.includes(p))) {
      return 'FINANCEIRO'; // Futuro worker
    }

    // Default: SDR para qualificação
    return 'SDR';
  }

  /**
   * Registra evento de escalação para alerta ao corretor
   */
  private async registrarEscalacao(leadId: string, motivo: string): Promise<void> {
    try {
      // Buscar lead e corretor responsável
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          tenant: true
        }
      });

      if (!lead) return;

      console.log(`[SUPERVISOR] 📢 Escalação registrada para lead ${lead.nome}: ${motivo}`);

      // TODO: Implementar notificação real (WebSocket, Email, SMS)
      // Por enquanto apenas loga
      
      // Atualizar lead para indicar que precisa atenção humana
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          // @ts-ignore - campo pode não existir ainda
          requerAtencaoHumana: true,
          ultimaAtualizacao: new Date()
        }
      });

    } catch (error) {
      console.error('[SUPERVISOR] Erro ao registrar escalação:', error);
    }
  }

  /**
   * Analisa o histórico do lead para métricas de qualidade
   */
  async analisarHistoricoLead(leadId: string): Promise<{
    totalMensagens: number;
    taxaResolucao: number;
    tempoMedioResposta: number;
    escalacoes: number;
    satisfacaoEstimada: number;
  }> {
    try {
      const mensagens = await prisma.mensagem.findMany({
        where: {
          conversa: {
            leadId
          }
        },
        orderBy: { enviadaEm: 'asc' }
      });

      // Análise básica
      const totalMensagens = mensagens.length;
      const mensagensUsuario = mensagens.filter((m: any) => m.remetente === 'usuario');
      const mensagensAssistente = mensagens.filter((m: any) => m.remetente === 'assistente');

      // Calcular tempo médio de resposta
      let temposTotais = 0;
      let contadorRespostas = 0;
      for (let i = 0; i < mensagens.length - 1; i++) {
        const atual = mensagens[i] as any;
        const proxima = mensagens[i + 1] as any;
        if (atual.remetente === 'usuario' && proxima.remetente === 'assistente') {
          const tempo = new Date(proxima.enviadaEm).getTime() - new Date(atual.enviadaEm).getTime();
          temposTotais += tempo;
          contadorRespostas++;
        }
      }
      const tempoMedioResposta = contadorRespostas > 0 ? temposTotais / contadorRespostas / 1000 : 0;

      return {
        totalMensagens,
        taxaResolucao: mensagensAssistente.length / Math.max(mensagensUsuario.length, 1) * 100,
        tempoMedioResposta,
        escalacoes: 0, // TODO: buscar do banco
        satisfacaoEstimada: 75 // TODO: calcular baseado em análise de sentimento
      };
    } catch (error) {
      console.error('[SUPERVISOR] Erro ao analisar histórico:', error);
      return {
        totalMensagens: 0,
        taxaResolucao: 0,
        tempoMedioResposta: 0,
        escalacoes: 0,
        satisfacaoEstimada: 0
      };
    }
  }
}

// Exportar instância singleton
export const supervisor = new Supervisor();
