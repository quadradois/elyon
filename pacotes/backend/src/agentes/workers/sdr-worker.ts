import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import {
  todasFerramentasSDR,
  qualificarLeadTool,
  solicitarHumanoTool,
  buscarImovelTool,
  registrarOptoutTool,
  converterParaLeadTool,
  encaminharCorretorTool,
  agendarAvaliacaoTool,
  agendarFollowupTool
} from '../../ferramentas/sdr-tools';
import { conhecimentoCuradoService } from '../../servicos/conhecimento-curado';
import { gerarExemplosParaPrompt, gerarExemplosPorFase } from '../few-shot-examples';
import { SDRLogger } from '../../servicos/logger';

const prisma = new PrismaClient();

/**
 * CAPTADOR WORKER (SDR + CLOSER)
 * 
 * 🛡️ DECISÃO ARQUITETURAL (05/12/2025):
 * Este agente combina intencionalmente as funções de SDR e Closer.
 * 
 * JUSTIFICATIVA:
 * - MVP com 5 clientes não justifica separação de agentes
 * - No WhatsApp, cada handoff perde ~40% do lead
 * - 1 agente fazendo 2 papéis = mais conversão, menos complexidade
 * 
 * QUANDO SEPARAR:
 * - Escala de 50+ clientes
 * - Se taxa de conversão cair significativamente
 * - Se corretores pedirem leads mais "crus"
 * 
 * COMPETÊNCIAS HÍBRIDAS:
 * 
 * [SDR] Qualificação:
 * - Fazer primeiro contato (Técnica do Idoso Confuso)
 * - Descobrir interesse (VENDER ou ALUGAR)
 * - Qualificar urgência e orçamento (SPIN Selling)
 * - Classificar lead (FRIO/MORNO/QUENTE)
 * 
 * [CLOSER] Captação:
 * - Tratar objeções de preço/comissão
 * - Agendar avaliações presenciais
 * - Converter contatos em leads qualificados
 * - Usar técnicas de fechamento (ancoragem, urgência, etc)
 */

// Interface para configuração do agente do tenant
export interface ConfiguracaoAgente {
  nome: string;
  personalidade: {
    tom: 'formal' | 'amigavel' | 'entusiasta';
    usarEmojis: boolean;
    nivelFormalidade?: number;
  };
  expertise: {
    bairros: string[];
    tiposImovel: string[];
  };
  scripts: {
    saudacao: string;
    despedida: string;
  };
  tenantId?: string;    // ID do tenant para busca de conhecimento
  tenantNome?: string;
  modoProspeccao?: boolean; // Indica se está em modo de prospecção ativa
  empreendimento?: string; // Nome do empreendimento (se prospecção)

  // Política da imobiliária (valores configurados no Perfil)
  politica?: {
    comissaoVenda?: number;  // % de comissão de venda (ex: 6)
    taxaLocacao?: number;    // % de taxa de administração (ex: 10)
  };
}

// FSM: Fases do SPIN Selling
export type FaseSPIN = 'SAUDACAO' | 'SITUACAO' | 'PROBLEMA' | 'IMPLICACAO' | 'NECESSIDADE' | 'SOLUCAO' | 'QUALIFICADO';

// FSM: Estado da qualificação
export interface EstadoQualificacao {
  fase: FaseSPIN;
  dadosColetados: {
    quartos?: number;
    ocupacao?: 'ocupado' | 'vazio';
    motivacao?: string;
    timeline?: string;
  };
  tentativasRecovery: number;
  objecoesRecebidas: string[];
}

// FSM: Resultado da análise de histórico
interface AnaliseHistorico {
  estado: EstadoQualificacao;
  proximaFase: FaseSPIN;
  dadosFaltantes: string[];
  podeQualificar: boolean;
  leadAceitou?: boolean;  // Lead aceitou anunciar/agendar visita
}

// Configuração padrão caso o tenant não tenha configurado
export const configPadrao: ConfiguracaoAgente = {
  nome: 'Sofia',
  personalidade: {
    tom: 'amigavel',
    usarEmojis: true,
    nivelFormalidade: 3
  },
  expertise: {
    bairros: [],
    tiposImovel: []
  },
  scripts: {
    saudacao: 'Olá! Como posso ajudar você hoje?',
    despedida: 'Foi um prazer ajudar! Até logo!'
  }
};

export class CaptadorWorker {
  private anthropic: Anthropic | null = null;

  constructor() {
    // Lazy initialization - será criado no primeiro uso
    // Isso garante que o dotenv já carregou as variáveis de ambiente
  }

  /**
   * FSM: Carrega estado persistido do banco de dados
   * Permite retomar conversas de onde pararam
   */
  private async carregarEstadoPersistido(conversaId: string): Promise<AnaliseHistorico | null> {
    try {
      // Usa raw query para evitar problemas de cache do TypeScript
      const conversa = await prisma.conversa.findUnique({
        where: { id: conversaId },
      }) as any;

      if (!conversa || !conversa.faseSPIN) {
        return null; // Sem estado persistido
      }

      const dadosColetados = conversa.dadosColetados || {};
      const fase = conversa.faseSPIN as FaseSPIN;

      // Calcular próxima fase baseado na atual
      const ordemFases: FaseSPIN[] = ['SAUDACAO', 'SITUACAO', 'PROBLEMA', 'IMPLICACAO', 'NECESSIDADE', 'SOLUCAO', 'QUALIFICADO'];
      const indexAtual = ordemFases.indexOf(fase);
      const proximaFase = indexAtual < ordemFases.length - 1 ? ordemFases[indexAtual + 1] : 'QUALIFICADO';

      // Calcular dados faltantes
      const camposObrigatorios = ['quartos', 'ocupacao', 'motivacao', 'timeline'];
      const dadosFaltantes = camposObrigatorios.filter(campo => !dadosColetados[campo]);

      console.log(`[SDR FSM] 📂 Estado carregado do banco: fase=${fase}, dados=${Object.keys(dadosColetados).length}/4`);

      return {
        estado: {
          fase,
          dadosColetados,
          tentativasRecovery: conversa.tentativasRecovery || 0,
          objecoesRecebidas: dadosColetados.objecoes || [],
        },
        proximaFase,
        dadosFaltantes,
        podeQualificar: conversa.podeQualificar || false,
      };
    } catch (error) {
      console.error('[SDR FSM] Erro ao carregar estado:', error);
      return null;
    }
  }

  /**
   * FSM: Salva estado no banco de dados para persistência
   * Chamado após cada processamento de mensagem
   */
  private async salvarEstado(conversaId: string, analise: AnaliseHistorico): Promise<void> {
    try {
      // Usa any para evitar problemas de cache do TypeScript
      await (prisma.conversa as any).update({
        where: { id: conversaId },
        data: {
          faseSPIN: analise.estado.fase,
          dadosColetados: {
            ...analise.estado.dadosColetados,
            objecoes: analise.estado.objecoesRecebidas,
          },
          tentativasRecovery: analise.estado.tentativasRecovery,
          podeQualificar: analise.podeQualificar,
          ultimaMensagemEm: new Date(),
        }
      });
      console.log(`[SDR FSM] 💾 Estado salvo: fase=${analise.estado.fase}, podeQualificar=${analise.podeQualificar}`);
    } catch (error) {
      console.error('[SDR FSM] Erro ao salvar estado:', error);
      // Não lança erro - falha silenciosa para não interromper a conversa
    }
  }

  /**
   * FSM: Analisa o histórico de mensagens e extrai dados coletados
   * Usa LLM para análise semântica + regex fallback (mais robusto)
   * 
   * MELHORIAS v2.1 (05/12/2025):
   * - Inclui diálogo completo para contexto
   * - Regex fallback para dados críticos
   * - Detecta sinais de fechamento
   */
  private async analisarHistoricoParaEstado(
    mensagens: Array<{ role: string, content: string }>
  ): Promise<AnaliseHistorico> {
    try {
      // Verificar se há mensagens do lead
      const mensagensLead = mensagens
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('\n');

      if (!mensagensLead.trim()) {
        // Primeira mensagem - estado inicial
        return {
          estado: {
            fase: 'SAUDACAO',
            dadosColetados: {},
            tentativasRecovery: 0,
            objecoesRecebidas: []
          },
          proximaFase: 'SITUACAO',
          dadosFaltantes: ['quartos', 'ocupacao', 'motivacao', 'timeline'],
          podeQualificar: false
        };
      }

      // === PRÉ-EXTRAÇÃO VIA REGEX (mais confiável para dados específicos) ===
      const regexQuartos = /(\d+)\s*(?:quartos?|qtos?|dormit[oó]rios?|suites?)/i;
      const regexOcupacao = /\b(vazio|desocupado|vago|livre|n[aã]o\s*mora|mora|ocupado|alugado|morando)\b/i;
      const regexTimeline = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d+\s*(?:meses?|dias?|semanas?)|urgente|r[aá]pido|imediato|sem\s*pressa)/i;

      // Detectar sinais de fechamento (importante para conversão)
      const sinaisFechamento = [
        /sim[,.]?\s*(?:o\s*que\s*precisa|pode\s*ser|vamos)/i,
        /pode\s*ser\s*(?:no\s*dia|dia|em|quando)/i,
        /(?:aceito|concordo|fechado|combinado|t[aá]\s*bom)/i,
        /(?:pode\s*incluir|inclua|anuncie|divulgue)/i,
        // Novos padrões mais abrangentes
        /podemos\s*(?:agendar|marcar|combinar)/i,           // "podemos agendar"
        /(?:agende|marque|marca)\s*(?:a\s*visita|pra|para)/i, // "agende a visita"
        /dia\s*\d{1,2}[\/-]\d{1,2}/i,                         // "dia 08/12" - mencionou data específica
        /(?:às|as)\s*\d{1,2}[h:]\d{0,2}/i,                    // "às 14:00" - mencionou horário
        /aguardo\s*(?:o\s*)?(?:contato|retorno|visita)/i,     // "aguardo o contato"
        /obrigad[oa]\s*(?:pelo\s*)?(?:retorno|contato)/i,     // "obrigado pelo retorno"
        /quando\s*(?:voc[eê]s?\s*)?(?:podem|pode)\s*vir/i,    // "quando vocês podem vir"
        /ok[,.]?\s*(?:pode|vamos|fechado)/i,                  // "ok, pode ser"
        /\b(?:sim|ok)\b[,.!]?\s*$/i,                          // "sim" ou "ok" no final
        /tudo\s*(?:certo|ok|bem)/i,                           // "tudo certo"
      ];

      const leadAceitou = sinaisFechamento.some(regex => regex.test(mensagensLead));

      // Log detalhado da detecção
      if (leadAceitou) {
        const matchedPattern = sinaisFechamento.find(regex => regex.test(mensagensLead));
        console.log(`[SDR FSM] ✅ Sinal de fechamento detectado! Pattern: ${matchedPattern}`);
      }

      // Extrair via regex primeiro (fallback confiável)
      const matchQuartos = mensagensLead.match(regexQuartos);
      const matchOcupacao = mensagensLead.match(regexOcupacao);
      const matchTimeline = mensagensLead.match(regexTimeline);

      // Montar diálogo completo para LLM (melhor contexto)
      const dialogoCompleto = mensagens
        .slice(-10) // Últimas 10 mensagens para não sobrecarregar
        .map(m => `${m.role === 'user' ? 'PROPRIETÁRIO' : 'CORRETOR'}: ${m.content}`)
        .join('\n\n');

      // Usar LLM para extração estruturada com contexto completo
      const promptExtracao = `Você é um extrator de dados de conversas imobiliárias. Analise o diálogo abaixo e extraia TODOS os dados mencionados pelo PROPRIETÁRIO.

=== DIÁLOGO ===
${dialogoCompleto}
===============

INSTRUÇÕES:
1. Procure menções a quantidade de QUARTOS (ex: "2 quartos", "dois dormitórios")
2. Procure se o imóvel está OCUPADO ou VAZIO (ex: "está vazio", "moro lá", "alugado")
3. Procure a MOTIVAÇÃO para vender (ex: "mudar de região", "preciso de dinheiro")
4. Procure o TIMELINE/PRAZO (ex: "dia 13/12", "3 meses", "urgente", "sem pressa")
5. Identifique se o proprietário ACEITOU anunciar ou agendar visita

Retorne APENAS JSON válido (sem markdown, sem explicações):
{
  "quartos": número ou null,
  "ocupacao": "ocupado" ou "vazio" ou null,
  "motivacao": "descrição curta" ou null,
  "timeline": "prazo ou data" ou null,
  "objecoes": ["comissao", "valor", "prazo", etc] ou [],
  "aceitouAnunciar": true ou false,
  "agendouVisita": true ou false,
  "dataVisita": "DD/MM/YYYY HH:mm" ou null
}`;

      const resposta = await this.getClient().messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 250, // Aumentado para incluir novos campos
        temperature: 0.1, // Baixa temperatura para consistência
        messages: [{ role: 'user', content: promptExtracao }]
      });

      const conteudo = resposta.content[0];
      const textoResposta = conteudo.type === 'text' ? conteudo.text : '{}';

      // Remover markdown se houver (```json ... ```)
      const jsonLimpo = textoResposta
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      console.log('[SDR FSM] 📊 Resposta LLM para extração:', jsonLimpo);

      let dados: any = {};
      try {
        dados = JSON.parse(jsonLimpo);
      } catch (parseError) {
        console.warn('[SDR FSM] ⚠️ Erro parsing JSON, usando apenas regex');
      }

      // === FALLBACK COM REGEX (mais confiável para dados específicos) ===
      // Se LLM não extraiu, tentar via regex

      // Quartos: regex muito confiável
      if (!dados.quartos && matchQuartos) {
        dados.quartos = parseInt(matchQuartos[1], 10);
        console.log(`[SDR FSM] 📊 Regex extraiu quartos: ${dados.quartos}`);
      }

      // Ocupação: normalizar resultado do regex
      if (!dados.ocupacao && matchOcupacao) {
        const ocupacaoRaw = matchOcupacao[1].toLowerCase();
        if (['vazio', 'desocupado', 'vago', 'livre'].some(v => ocupacaoRaw.includes(v))) {
          dados.ocupacao = 'vazio';
        } else if (['mora', 'ocupado', 'alugado', 'morando'].some(v => ocupacaoRaw.includes(v))) {
          dados.ocupacao = 'ocupado';
        }
        console.log(`[SDR FSM] 📊 Regex extraiu ocupacao: ${dados.ocupacao}`);
      }

      // Timeline: regex para data/prazo
      if (!dados.timeline && matchTimeline) {
        dados.timeline = matchTimeline[0];
        console.log(`[SDR FSM] 📊 Regex extraiu timeline: ${dados.timeline}`);
      }

      // Usar sinal de fechamento detectado anteriormente
      if (leadAceitou && !dados.aceitouAnunciar) {
        dados.aceitouAnunciar = true;
        console.log('[SDR FSM] 📊 Regex detectou aceitação de anúncio');
      }

      // Construir estado baseado nos dados extraídos
      const dadosColetados: EstadoQualificacao['dadosColetados'] = {};
      const dadosFaltantes: string[] = [];

      if (dados.quartos) dadosColetados.quartos = dados.quartos;
      else dadosFaltantes.push('quartos');

      if (dados.ocupacao) dadosColetados.ocupacao = dados.ocupacao;
      else dadosFaltantes.push('ocupacao');

      if (dados.motivacao) dadosColetados.motivacao = dados.motivacao;
      else dadosFaltantes.push('motivacao');

      if (dados.timeline) dadosColetados.timeline = dados.timeline;
      else dadosFaltantes.push('timeline');

      // Determinar fase atual baseado nos dados coletados
      let fase: FaseSPIN = 'SAUDACAO';
      let proximaFase: FaseSPIN = 'SITUACAO';

      const dadosCount = Object.keys(dadosColetados).length;

      if (dadosCount === 0) {
        fase = 'SAUDACAO';
        proximaFase = 'SITUACAO';
      } else if (dadosCount >= 1 && !dadosColetados.motivacao) {
        fase = 'SITUACAO';
        proximaFase = 'PROBLEMA';
      } else if (dadosColetados.motivacao && !dadosColetados.timeline) {
        fase = 'PROBLEMA';
        proximaFase = 'IMPLICACAO';
      } else if (dadosCount >= 3) {
        fase = 'IMPLICACAO';
        proximaFase = 'NECESSIDADE';
      }

      if (dadosCount >= 4) {
        fase = 'NECESSIDADE';
        proximaFase = 'SOLUCAO';
      }

      const podeQualificar = dadosCount >= 4;

      return {
        estado: {
          fase,
          dadosColetados,
          tentativasRecovery: 0,
          objecoesRecebidas: dados.objecoes || []
        },
        proximaFase,
        dadosFaltantes,
        podeQualificar,
        leadAceitou: dados.aceitouAnunciar || leadAceitou || false
      };

    } catch (error) {
      console.error('[SDR FSM] Erro ao analisar histórico:', error);

      // Fallback seguro
      return {
        estado: {
          fase: 'SAUDACAO',
          dadosColetados: {},
          tentativasRecovery: 0,
          objecoesRecebidas: []
        },
        proximaFase: 'SITUACAO',
        dadosFaltantes: ['quartos', 'ocupacao', 'motivacao', 'timeline'],
        podeQualificar: false,
        leadAceitou: false
      };
    }
  }

  /**
   * FSM: Valida se uma tool pode ser executada baseado no estado atual
   */
  private validarToolCall(
    toolName: string,
    analise: AnaliseHistorico
  ): { permitido: boolean; motivo?: string } {

    // VALIDAÇÃO CRÍTICA: qualificar_lead só com 4+ dados
    if (toolName === 'qualificar_lead') {
      if (!analise.podeQualificar) {
        return {
          permitido: false,
          motivo: `Dados insuficientes! Faltam: ${analise.dadosFaltantes.join(', ')}. Coletados: ${Object.keys(analise.estado.dadosColetados).length}/4`
        };
      }
    }

    // ✅ PERMISSÃO ESPECIAL: Se lead aceitou, permitir converter_para_lead e agendar_avaliacao
    // mesmo com menos de 4 dados (o proprietário demonstrou interesse claro)
    if (analise.leadAceitou) {
      if (['converter_para_lead', 'agendar_avaliacao'].includes(toolName)) {
        console.log(`[SDR FSM] ✅ Lead aceitou! Permitindo ${toolName} com dados parciais`);
        return { permitido: true };
      }
    }

    // VALIDAÇÃO: solicitar_humano só após tentativa de qualificação
    if (toolName === 'solicitar_humano') {
      const dadosCount = Object.keys(analise.estado.dadosColetados).length;
      if (dadosCount < 3) {
        return {
          permitido: false,
          motivo: `Qualifique antes de transferir! Dados coletados: ${dadosCount}/4`
        };
      }
    }

    return { permitido: true };
  }

  /**
   * Gera o system prompt personalizado baseado na configuração do tenant
   * 
   * MODO PROSPECÇÃO ATIVA (modoProspeccao = true):
   *   Usa CONTEXTO_PROSPECCAO_ATIVA (V2 - Closer Digital)
   *   Foco em captação assertiva e fechamento
   * 
   * MODO ATENDIMENTO PASSIVO (modoProspeccao = false/undefined):
   *   Usa prompt de qualificação SPIN Selling
   *   Foco em descobrir necessidades e classificar
   */
  private gerarSystemPrompt(config: ConfiguracaoAgente, contextoRAG?: string): string {
    const { nome, personalidade, expertise, scripts, tenantNome, politica, modoProspeccao, empreendimento } = config;

    // Aplicar configuração de emojis dinamicamente
    const emoji = personalidade.usarEmojis ? '😊' : '';

    // Valores da política da imobiliária (com fallback para padrões)
    const comissaoVenda = politica?.comissaoVenda ?? 6; // Default: 6%
    const taxaLocacao = politica?.taxaLocacao ?? 10;    // Default: 10%

    // Aplicar tom de voz em variações de resposta
    const saudacaoContextual = personalidade.tom === 'formal'
      ? `${scripts.saudacao}`
      : scripts.saudacao;

    const tratamento = personalidade.tom === 'formal' ? 'senhor(a)' : 'você';

    // Expertise
    const expertiseTexto = expertise.bairros.length > 0 || expertise.tiposImovel.length > 0
      ? `Expertise: ${expertise.bairros.join(', ')} | ${expertise.tiposImovel.join(', ')}`
      : '';

    // Conhecimento do empreendimento (compactado)
    let conhecimentoRAG = '';
    if (contextoRAG) {
      conhecimentoRAG = `
📚 CONTEXTO: ${contextoRAG}
⚠️ Valores/metragens são aproximados. Diga: "corretor confirma detalhes exatos".
`;
    }

    const promptBase = `# IDENTIDADE
Você é ${nome}, consultora de qualificação da ${tenantNome || 'imobiliária'}. ${expertiseTexto}

⚠️ CONTEXTO CRÍTICO DA PRIMEIRA MENSAGEM:
Você enviou uma mensagem de PROSPECÇÃO ATIVA dizendo:
- "Estou ajudando uma família que quer muito morar no [empreendimento]"
- "Me chamo ${nome}, trabalho com imóveis aqui na região"

MANTENHA COERÊNCIA! Se o lead perguntar "de onde você é?", responda:
"Sou ${nome} da ${tenantNome || 'imobiliária'}! Como disse na mensagem, estou ajudando uma família a encontrar imóvel na região do [empreendimento]. Você conhece alguém vendendo?"

Sua função: qualificar leads via WhatsApp. Corretores fazem: visitas, documentação, fechamento.

${conhecimentoRAG}

# RESTRIÇÕES ABSOLUTAS (JAMAIS VIOLE)
❌ PROIBIDO perguntar valor/preço ANTES de coletar 4 dados básicos
❌ PROIBIDO transferir para corretor sem 4+ dados coletados
❌ PROIBIDO aceitar "não obrigado" sem tentativa de recovery (mínimo 1x)
❌ PROIBIDO dizer: "não sou corretora", "base de dados", "acesso a informações de leads"
❌ PROIBIDO prometer valores/prazos específicos
❌ PROIBIDO oferecer "avaliação gratuita" ANTES de qualificar completamente

# OBJETIVO
**PRIMÁRIO:** Qualificar lead coletando dados relevantes (andar, estado, ocupação, motivação) e classificar: FRIO/MORNO/QUENTE
**SECUNDÁRIO:** Captar interesse real de venda (não empurrar avaliação!)
**CARTA NA MANGA:** Avaliação gratuita - use SOMENTE se lead hesitar ou desistir

# PROCESSO DE QUALIFICAÇÃO INTELIGENTE

⚠️ IMPORTANTE: Se você recebeu um BRIEFING do empreendimento, DEMONSTRE conhecimento!
- NÃO pergunte "quantos quartos?" se o briefing já diz que são 2 quartos
- NÃO pergunte informações que você JÁ TEM no briefing
- Faça perguntas que MOSTREM que você conhece o prédio

**SITUAÇÃO** (adapte ao briefing!):
- COM briefing: "O seu é em qual andar?" / "Está reformado ou original?"
- SEM briefing: "Quantos quartos?" / "Qual o tamanho aproximado?"
- SEMPRE pergunte: "Está morando ou alugado?" (ocupação)

**PROBLEMA** (descubra motivação):
"O que te fez pensar em vender?" → aguarde
- Se "preciso grana" → explore urgência
- Se "vou mudar" → explore timeline

**IMPLICAÇÃO** (amplifique dor):
"E enquanto não vende, [problema] tá impactando como?"
- Se vazio: "Quanto tá custando manter parado?"

**NECESSIDADE** (peça autorização!):
⚠️ NUNCA assuma que o cliente quer anunciar. SEMPRE pergunte!

❌ ERRADO: "Vou incluir seu apartamento na nossa carteira!"
✅ CERTO: "Posso incluir seu apartamento na nossa carteira? Aí quando aparecer interessado, te aviso!"

- Se AUTORIZAR ("pode", "sim", "ok"): Prossiga para fechamento (fotos, valor, etc)
- Se RECUSAR ou HESITAR: Entenda a objeção! "O que te preocupa? É a comissão, prazo?"

**SOLUÇÃO** (só após autorização explícita):
"Perfeito! Pra começar, você tem fotos do apartamento ou prefere que a gente tire?"

# QUANDO USAR "AVALIAÇÃO GRATUITA" (carta na manga)
Use APENAS nestes casos:

1. **Lead hesitante após qualificar:**
   Lead: "vou pensar"
   Você: "Tranquilo! Que tal fazer uma avaliação rápida sem compromisso? Aí você tem mais clareza pra decidir${emoji}"

2. **Lead pergunta valor específico:**
   Lead: "quanto vale meu apartamento?"
   - COM briefing: "Apartamentos de 2 quartos aqui estão saindo de R$ 280 a 380k! Mas pra te dar valor exato, posso fazer uma avaliação gratuita. O seu é em qual andar?"
   - SEM briefing: "Posso fazer avaliação gratuita pra te dar valor exato! Me conta mais sobre o apartamento?"

3. **Lead desistindo após 2+ tentativas recovery:**
   Lead: "não quero vender agora"
   Você: "Sem pressão! Deixa eu fazer avaliação gratuita. Aí quando decidir, você já sabe o valor. Sem compromisso!"

❌ NUNCA ofereça avaliação como "próximo passo natural" - você não é avaliadora, é qualificadora!

# CHAIN-OF-THOUGHT (PENSE ANTES DE RESPONDER)
Formato mental antes de CADA resposta:
[FASE: Situação|Problema|Implicação|Necessidade|Solução]
[DADOS: 0-4 coletados] 
[PRÓXIMA AÇÃO: perguntar X | chamar tool Y]
[AVALIAÇÃO OFERECIDA: SIM/NÃO - só use se hesitação]

# FERRAMENTAS DISPONÍVEIS

## Prospecção Ativa (converter proprietários):
- **converter_para_lead**: Quando proprietário demonstrou interesse REAL em vender/alugar. Use após coletar: tipo interesse, timeline, dados básicos.
- **agendar_avaliacao**: Quando proprietário ACEITOU visita de avaliação. Confirme data/hora ANTES de usar!
- **agendar_followup**: Quando proprietário disse "talvez depois", "não agora", "me liga mês que vem". Agenda recontato automático.
- **registrar_optout**: IMEDIATAMENTE quando disser "para", "não me ligue", "spam". RESPEITE sempre!

## Qualificação de Leads:
- **qualificar_lead**: SÓ com 4+ dados (quartos, ocupação, motivação, timeline). Classifica FRIO/MORNO/QUENTE.
- **solicitar_humano**: SÓ se lead QUENTE qualificado OU pediu explicitamente falar com pessoa.
- **buscar_imovel**: Quando lead perguntar sobre imóvel dele especificamente.

## CRITÉRIOS PARA CONVERSÃO EM LEAD:
✅ CONVERTER (usar converter_para_lead):
- Aceitou avaliação/visita → temperatura QUENTE
- Perguntou "como funciona?" / "quanto cobram?" → temperatura MORNO
- Disse frustração com corretor atual → temperatura MORNO
- Demonstrou interesse real em vender/alugar → temperatura adequada

❌ NÃO CONVERTER:
- Disse claramente que não quer
- Tem exclusividade e está satisfeito
- Pediu para não ser contatado (usar registrar_optout!)

## QUANDO AGENDAR FOLLOW-UP (usar agendar_followup):
| Resposta do Proprietário | Dias para Recontato |
|--------------------------|---------------------|
| "Talvez mês que vem" | 30 dias |
| "Agora não, depois" | 15 dias |
| "Vou pensar" | 7 dias |
| "Me liga semana que vem" | 7 dias |

# OBJEÇÕES COMUNS E CONTORNO (SPIN SELLING)

**"Já tenho corretor"** (NÃO desista!):
Você: "Que bom que já está com alguém cuidando! Há quanto tempo está anunciado?"
[SE > 2 MESES]: "Às vezes uma nova exposição ajuda a acelerar. A gente trabalha forte com marketing digital. Teria interesse em uma avaliação sem compromisso?"
→ Perguntas-chave: "Está tendo muitas visitas?" / "O corretor tem dado retorno?"

**"Estou vendendo sozinho"** (FSBO = oportunidade!):
Você: "Entendo! Muita gente começa assim. Está conseguindo boas visitas?"
[SE NÃO]: "70% dos compradores procuram por imobiliárias. Quer que eu dê uma olhada no seu anúncio e dê umas dicas? Sem compromisso!"
[SE SIM]: "Ótimo! Se quiser ampliar a divulgação, me avisa. Tenho compradores procurando na região!"

**"Já tenho várias imobiliárias"**:
Você: "Entendi! E com tantas divulgando, como estão as visitas?"
[SE POUCAS]: "Às vezes o problema não é quantidade, mas estratégia. Posso te mostrar como trabalhamos diferente?"
[SE MUITAS MAS SEM PROPOSTA]: "Muita visita sem proposta geralmente significa ajuste de preço. Fez avaliação recente?"

**"Qual comissão?"** (antes de qualificar):
"Taxa padrão ${comissaoVenda}%. Mas me ajuda: o que MAIS te preocupa na venda? Só comissão ou tem outras coisas?"
→ Se insistir: "Imóveis com imobiliária vendem 40% mais rápido. Compensa!"

**"Não obrigado" / "Vou pensar"**:
TENTATIVA 1: "Tranquilo${emoji} Mas o que te fez pensar em vender? Às vezes conversar ajuda!"
TENTATIVA 2: "Sem pressão! Posso te dar uma estimativa rápida de valor. O seu é em qual andar?"
SE RECUSAR 2x: Use agendar_followup para recontato em 7-15 dias
"Entendido! Te retorno daqui uns dias. Conhece vizinho querendo vender?"

**"Quanto vale meu apartamento?"** (Use o briefing se tiver!):
- COM briefing: "Apartamentos de 2 quartos no [empreendimento] estão saindo de R$ 280 a 380k! O seu é em qual andar? Influencia no valor!"
- SEM briefing: "Depende de vários fatores! Me conta mais sobre o apartamento - quantos quartos, em qual andar?"
→ Use a pergunta para coletar dados que você NÃO TEM no briefing!

**"Como conseguiu meu contato?"**:
"Foi indicação! Quando ajudo alguém, peço contatos de vizinhos interessados. Foi assim que cheguei em ${tratamento}${emoji}"
NUNCA diga: prefeitura, base de dados, IPTU.

# PERGUNTA CHAVE SPIN: "E quantas propostas já teve?"
Após saber que está vendendo, pergunte sobre propostas:
- Se POUCAS/NENHUMA → IMPLICAÇÃO: "Quanto tempo mais consegue esperar?" / "Está pagando condomínio de imóvel parado?"
- Se VÁRIAS mas não fechou → "Interessante... o que aconteceu com as propostas?"

# ⚡ AÇÕES AUTOMÁTICAS (CHAME TOOLS IMEDIATAMENTE!)

## 🎯 SINAIS DE FECHAMENTO → AGIR IMEDIATAMENTE!

Quando detectar QUALQUER um destes sinais, CHAME A TOOL correspondente:

| Sinal do Proprietário | Tool a Chamar | Parâmetros Mínimos |
|----------------------|---------------|-------------------|
| "sim, pode incluir" / "ok, pode anunciar" / "sim o que precisa?" | converter_para_lead | temperatura: QUENTE ou MORNO |
| "pode ser dia 13/12" / "dia 15 às 14h" / "semana que vem" | agendar_avaliacao | dataAvaliacao: "DD/MM/YYYY HH:mm" |
| "para de me ligar" / "não quero" / "spam" | registrar_optout | motivo: descrição |
| "me liga mês que vem" / "agora não" | agendar_followup | dias: 7-30 |

⚠️ IMPORTANTE: Se o proprietário ACEITOU anunciar e MARCOU data de visita na MESMA conversa:
1. PRIMEIRO: chame converter_para_lead (para criar o lead)
2. DEPOIS: chame agendar_avaliacao (para agendar a visita)

## 🔥 EXEMPLOS DE QUANDO CHAMAR TOOLS

**EXEMPLO 1 - Proprietário aceita anunciar:**
Proprietário: "sim pode incluir, o que precisa de mim?"
→ VOCÊ DEVE: Chamar converter_para_lead(temperatura: "QUENTE", tipoInteresse: "VENDA")
→ DEPOIS: Responder pedindo dados complementares (fotos, valor pretendido)

**EXEMPLO 2 - Proprietário marca visita:**
Proprietário: "pode ser no dia 13/12/2025 às 13:00h"
→ VOCÊ DEVE: Chamar agendar_avaliacao(dataAvaliacao: "13/12/2025 13:00")
→ DEPOIS: Confirmar o agendamento na resposta

**EXEMPLO 3 - Proprietário não tem interesse agora:**
Proprietário: "agora não, talvez depois"
→ VOCÊ DEVE: Chamar agendar_followup(dias: 15, motivo: "Sem interesse imediato")
→ DEPOIS: Despedir-se educadamente

**EXEMPLO 4 - Proprietário aceita E marca visita (conversa completa):**
Proprietário: "sim quero anunciar"
Você: "Ótimo! Posso tirar fotos profissionais grátis! Qual dia?"
Proprietário: "dia 20/12 às 10h"
→ VOCÊ DEVE: 
  1. Chamar converter_para_lead(temperatura: "QUENTE")
  2. Chamar agendar_avaliacao(dataAvaliacao: "20/12/2025 10:00")

## ❌ QUANDO NÃO CHAMAR TOOLS

- Se ainda está coletando dados básicos (quartos, ocupação, etc)
- Se proprietário está apenas perguntando informações
- Se não houve CONFIRMAÇÃO explícita de interesse

# ESTILO (tom: ${personalidade.tom})
${personalidade.tom === 'formal' ? '- Linguagem profissional, trate por "senhor(a)", seja objetivo' : ''}
${personalidade.tom === 'amigavel' ? '- Natural e próximo, crie conexão, demonstre interesse genuíno' : ''}
${personalidade.tom === 'entusiasta' ? '- Animado e positivo, celebre avanços, transmita energia' : ''}
${personalidade.usarEmojis ? '- 1 emoji/mensagem (moderação)' : '- Sem emojis'}
- 1 pergunta por vez, aguarde resposta
- Scripts: Saudação="${saudacaoContextual}" | Despedida="${scripts.despedida}"

# EXEMPLOS (calibração - adapte ao briefing!)

COM BRIEFING (você sabe que é um prédio de 2 quartos, 54-59m²):
❌ Lead: "penso em vender" → Você: "Quantos quartos?" (você já sabe!)
✅ Lead: "penso em vender" → Você: "Ótimo! Seu apto é em qual andar? Adoro aquelas plantas de 2 quartos com varanda gourmet!"

SEM BRIEFING (empreendimento desconhecido):
❌ Lead: "penso em vender" → Você: "Qual valor?" (pulou qualificação!)
✅ Lead: "penso em vender" → Você: "Ótimo! Me conta mais - quantos quartos tem?"

AUTORIZAÇÃO (SEMPRE pedir antes de anunciar!):
❌ Lead: "sim tenho interesse" → Você: "Vou incluir seu apartamento na nossa lista!" (assumiu sem autorização!)
✅ Lead: "sim tenho interesse" → Você: "Ótimo! Posso incluir seu apartamento na nossa carteira? Aí te aviso quando aparecer interessado!"

APÓS AUTORIZAÇÃO:
❌ Lead: "pode sim" → Você: "Perfeito, já vou começar a divulgar!" (não coletou dados!)
✅ Lead: "pode sim" → Você: "Perfeito! Você tem fotos do apartamento ou prefere que a gente tire profissionalmente?"

HESITAÇÃO (entender objeção):
❌ Lead: "vou pensar" → Você: "Ok, qualquer coisa me chama!" (desistiu!)
✅ Lead: "vou pensar" → Você: "Tranquilo! O que te preocupa? É a comissão, prazo, ou outra coisa?"

Qualifique com excelência${emoji}`;

    // 🎯 MODO PROSPECÇÃO ATIVA: Usar prompt V3 compacto (Closer Digital)
    // V3 é focado 100% em fechamento, com tools no TOPO
    if (config.modoProspeccao) {
      console.log(`[CaptadorWorker] 🚀 MODO V3 ATIVO (CLOSER) - Empreendimento: ${empreendimento}`);
      console.log(`[CaptadorWorker] 🏢 Imobiliária no config: ${tenantNome}`);
      console.log(`[CaptadorWorker] 📚 contextoRAG recebido? ${!!contextoRAG} (${contextoRAG?.length || 0} chars)`);

      // 🔥 CRÍTICO: Briefing vai NO INÍCIO para máxima atenção do Claude!
      // LLMs têm "primacy effect" - focam mais no início do prompt
      let prefixoBriefing = '';
      if (contextoRAG) {
        console.log(`[CaptadorWorker] ✅ Briefing será adicionado NO INÍCIO do prompt`);
        prefixoBriefing = `
╔═══════════════════════════════════════════════════════════════════════════╗
║  📚 CONHECIMENTO OBRIGATÓRIO DO EMPREENDIMENTO - MEMORIZE ESTES DADOS!    ║
╚═══════════════════════════════════════════════════════════════════════════╝

${contextoRAG}

⚠️ REGRA ABSOLUTA: 
- SEMPRE use os dados acima nas suas respostas!
- Se perguntarem tipologia, preço, área → USE ESTES DADOS!
- NUNCA invente ou generalize (ex: "2 ou 3 quartos" quando só tem 2)!
- Se perguntarem quem é você/imobiliária → DIGA: "${tenantNome || 'nossa imobiliária'}"

═══════════════════════════════════════════════════════════════════════════

`;
      } else {
        console.log(`[CaptadorWorker] ⚠️ SEM briefing - contextoRAG vazio!`);
      }

      // Prompt V3 compacto: usa o promptBase com briefing
      // Briefing vai ANTES do prompt principal!
      const promptV3 = prefixoBriefing + promptBase;

      return promptV3;
    }

    console.log(`[CaptadorWorker] 📋 MODO V1 (SDR passivo) - modoProspeccao=${config.modoProspeccao}`);
    return promptBase;
  }

  /**
   * Busca conhecimento relevante (curado + tenant) para o contexto atual
   * 
   * @param ultimaMensagem - Última mensagem do lead para contextualizar a busca
   * @param tenantId - ID do tenant para buscar conhecimento específico
   * @param fase - Fase atual do SPIN (para filtrar por categoria)
   * @returns String formatada com conhecimento relevante
   */
  private async buscarConhecimentoContextual(
    ultimaMensagem: string,
    tenantId?: string,
    fase?: FaseSPIN
  ): Promise<string> {
    try {
      // Mapear fase SPIN para categoria de conhecimento
      const categoriaMap: Record<FaseSPIN, string | undefined> = {
        'SAUDACAO': 'script_abertura',
        'SITUACAO': 'spin',
        'PROBLEMA': 'spin',
        'IMPLICACAO': 'spin',
        'NECESSIDADE': 'fechamento',
        'SOLUCAO': 'fechamento',
        'QUALIFICADO': undefined,
      };

      const categoria = fase ? categoriaMap[fase] : undefined;

      // Buscar conhecimento curado (global) - sempre disponível
      const resultados = await conhecimentoCuradoService.buscar({
        query: ultimaMensagem,
        categoria,
        limite: 3,
      });

      if (resultados.length === 0) {
        return '';
      }

      // Formatar conhecimento para o prompt
      let conhecimento = '\n\n💡 TÉCNICAS SUGERIDAS PARA ESTE MOMENTO:\n';

      for (const r of resultados) {
        conhecimento += `\n📌 ${r.titulo} (${Math.round(r.scoreEficacia)}% eficácia):\n`;
        conhecimento += `   "${r.texto}"\n`;
        conhecimento += `   Usar quando: ${r.contextoUso}\n`;
      }

      // TODO: Adicionar busca de conhecimento do tenant quando RAG estiver populado
      // if (tenantId) {
      //   const conhecimentoTenant = await buscarConhecimentoTenant(...)
      // }

      return conhecimento;
    } catch (error) {
      console.error('[SDR Worker] Erro ao buscar conhecimento:', error);
      return ''; // Falha silenciosa - não impede a conversa
    }
  }

  /**
   * Lazy loading do cliente Anthropic
   * Garante que as variáveis de ambiente já foram carregadas
   */
  private getClient(): Anthropic {
    if (!this.anthropic) {
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        console.error('[SDR Worker] ❌ ANTHROPIC_API_KEY não encontrada no .env!');
        throw new Error('ANTHROPIC_API_KEY não configurada. Adicione no arquivo .env');
      }

      console.log('[SDR Worker] ✅ Inicializando cliente Anthropic...');

      this.anthropic = new Anthropic({
        apiKey: apiKey,
      });
    }
    return this.anthropic;
  }

  /**
   * Processa uma mensagem do lead e retorna a resposta do SDR
   * 
   * @param mensagens - Histórico de mensagens (formato OpenAI)
   * @param leadId - ID do lead no banco de dados
   * @param config - Configuração do agente (opcional, usa padrão se não fornecido)
   * @param contextoRAG - Contexto do empreendimento/campanha (opcional)
   * @param conversaId - ID da conversa para persistência de estado (opcional)
   * @returns Resposta do SDR para enviar ao lead
   */
  async processar(
    mensagens: Array<{ role: string, content: string }>,
    leadId: string,
    config: ConfiguracaoAgente = configPadrao,
    contextoRAG?: string,
    conversaId?: string
  ): Promise<string> {
    const inicio = Date.now();
    const traceId = SDRLogger.inicioProcessamento({
      conversaId,
      leadId
    });

    try {
      // 🔍 FASE 1: Tentar carregar estado persistido ou analisar histórico
      let analise: AnaliseHistorico;

      if (conversaId) {
        const estadoPersistido = await this.carregarEstadoPersistido(conversaId);
        if (estadoPersistido) {
          analise = estadoPersistido;
          SDRLogger.conhecimentoInjetado(conversaId, 'conversa', 1);
        } else {
          analise = await this.analisarHistoricoParaEstado(mensagens);
        }
      } else {
        analise = await this.analisarHistoricoParaEstado(mensagens);
      }

      SDRLogger.decisaoIA(
        conversaId || leadId,
        `Fase ${analise.estado.fase}`,
        analise.podeQualificar ? 1.0 : 0.5,
        {
          dadosColetados: Object.keys(analise.estado.dadosColetados).length,
          faltam: analise.dadosFaltantes
        }
      );

      // Gerar system prompt personalizado
      const systemPrompt = this.gerarSystemPrompt(config, contextoRAG);

      // 🧠 FASE 1.5: Buscar conhecimento contextual (curado + tenant)
      let conhecimentoContextual = '';
      if (mensagens.length > 0) {
        const ultimaMensagemLead = mensagens.filter(m => m.role === 'user').pop();
        if (ultimaMensagemLead?.content) {
          conhecimentoContextual = await this.buscarConhecimentoContextual(
            ultimaMensagemLead.content,
            config.tenantId,
            analise.estado.fase
          );
          if (conhecimentoContextual) {
            SDRLogger.conhecimentoInjetado(conversaId || leadId, 'curado', 1);
          }
        }
      }

      // 🎯 FASE 2: Injetar estado atual no contexto do LLM
      const contextoFSM = `
📊 ESTADO ATUAL DA QUALIFICAÇÃO:
- Fase: ${analise.estado.fase} → Próxima: ${analise.proximaFase}
- Dados coletados: ${Object.keys(analise.estado.dadosColetados).length}/4
${Object.keys(analise.estado.dadosColetados).length > 0 ? `  ✓ ${Object.keys(analise.estado.dadosColetados).map(k => k.toUpperCase()).join(', ')}` : ''}
${analise.dadosFaltantes.length > 0 ? `  ✗ Faltam: ${analise.dadosFaltantes.join(', ')}` : ''}
- Pode qualificar: ${analise.podeQualificar ? '✅ SIM' : '❌ NÃO'}

⚠️ INSTRUÇÃO PRIORITÁRIA: ${analise.podeQualificar ? 'Todos os dados coletados! Pode chamar qualificar_lead.' : `CONTINUE coletando! Próxima pergunta: ${analise.dadosFaltantes[0]}`}
`;

      // 📚 FASE 2.5: Gerar exemplos Few-Shot para a fase atual
      const exemplosFewShot = gerarExemplosPorFase(analise.estado.fase, 3);

      // Preparar mensagens no formato Anthropic (system separado)
      // Incluir conhecimento contextual + exemplos few-shot se disponível
      const systemMessage = systemPrompt + contextoFSM + conhecimentoContextual + exemplosFewShot + `\n\nLead ID atual: ${leadId}`;

      // Converter mensagens para formato Anthropic (validação de alternância)
      const mensagensAnthropic: Anthropic.MessageParam[] = [];

      for (const m of mensagens) {
        const role = m.role === 'assistant' ? 'assistant' : 'user';
        const content = m.content?.trim();

        // Pular mensagens vazias
        if (!content) {
          console.warn('[SDR Worker] ⚠️ Mensagem vazia ignorada:', m);
          continue;
        }

        // Anthropic exige alternância user/assistant - garantir isso
        if (mensagensAnthropic.length > 0) {
          const ultimaRole = mensagensAnthropic[mensagensAnthropic.length - 1].role;
          if (ultimaRole === role) {
            console.warn('[SDR Worker] ⚠️ Roles consecutivos iguais detectados, mesclando...');
            // Mesclar com mensagem anterior
            const ultimaMensagem = mensagensAnthropic[mensagensAnthropic.length - 1];
            ultimaMensagem.content = `${ultimaMensagem.content}\n\n${content}`;
            continue;
          }
        }

        mensagensAnthropic.push({
          role: role as 'user' | 'assistant',
          content: content
        });
      }

      // Anthropic exige que a primeira mensagem seja do 'user'
      if (mensagensAnthropic.length > 0 && mensagensAnthropic[0].role !== 'user') {
        console.warn('[SDR Worker] ⚠️ Primeira mensagem não é do user, corrigindo...');
        mensagensAnthropic.unshift({
          role: 'user',
          content: '[Início da conversa]'
        });
      }

      console.log('[SDR Worker] 📨 Mensagens preparadas:', {
        total: mensagensAnthropic.length,
        roles: mensagensAnthropic.map(m => m.role).join(' → ')
      });

      // Preparar tools em formato Anthropic
      // Converter Zod schema para JSON Schema (formato Anthropic)
      const zodToJsonSchema = (zodSchema: any): Anthropic.Tool.InputSchema => {
        const shape = zodSchema._def.typeName === 'ZodObject'
          ? zodSchema._def.shape()
          : zodSchema.shape;

        const properties: Record<string, any> = {};
        const required: string[] = [];

        for (const [key, value] of Object.entries(shape)) {
          const zodType = value as any;
          properties[key] = {
            type: zodType._def.typeName === 'ZodString' ? 'string' :
              zodType._def.typeName === 'ZodNumber' ? 'number' :
                zodType._def.typeName === 'ZodBoolean' ? 'boolean' :
                  zodType._def.typeName === 'ZodEnum' ? 'string' : 'string',
            description: zodType._def.description || undefined,
          };

          if (zodType._def.typeName === 'ZodEnum') {
            properties[key].enum = zodType._def.values;
          }

          // Verificar se é obrigatório (não é opcional)
          if (!zodType.isOptional || !zodType.isOptional()) {
            required.push(key);
          }
        }

        return {
          type: 'object' as const,
          properties,
          required
        };
      };

      const tools: Anthropic.Tool[] = [
        {
          name: qualificarLeadTool.name,
          description: qualificarLeadTool.description,
          input_schema: zodToJsonSchema(qualificarLeadTool.parameters)
        },
        {
          name: solicitarHumanoTool.name,
          description: solicitarHumanoTool.description,
          input_schema: zodToJsonSchema(solicitarHumanoTool.parameters)
        },
        {
          name: buscarImovelTool.name,
          description: buscarImovelTool.description,
          input_schema: zodToJsonSchema(buscarImovelTool.parameters)
        },
        {
          name: registrarOptoutTool.name,
          description: registrarOptoutTool.description,
          input_schema: zodToJsonSchema(registrarOptoutTool.parameters)
        },
        {
          name: converterParaLeadTool.name,
          description: converterParaLeadTool.description,
          input_schema: zodToJsonSchema(converterParaLeadTool.parameters)
        },
        {
          name: agendarAvaliacaoTool.name,
          description: agendarAvaliacaoTool.description,
          input_schema: zodToJsonSchema(agendarAvaliacaoTool.parameters)
        },
        {
          name: agendarFollowupTool.name,
          description: agendarFollowupTool.description,
          input_schema: zodToJsonSchema(agendarFollowupTool.parameters)
        }
      ];

      // 📊 Log do tamanho do prompt (para análise de custo)
      const tokensEstimados = Math.ceil((systemMessage.length + JSON.stringify(mensagensAnthropic).length) / 4);
      console.log(`[CaptadorWorker] 📊 TOKENS ESTIMADOS: ~${tokensEstimados} (system: ${systemMessage.length} chars, msgs: ${mensagensAnthropic.length})`);

      // Chamar Claude com tool calling
      let resposta = await this.getClient().messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        temperature: 0.7,
        system: systemMessage,
        messages: mensagensAnthropic,
        tools: tools
      });

      // Loop para executar function calls se houver
      const maxIteracoes = 5; // Evitar loops infinitos
      let iteracoes = 0;

      while (resposta.stop_reason === 'tool_use' && iteracoes < maxIteracoes) {
        // Adicionar resposta do assistente ao histórico
        mensagensAnthropic.push({
          role: 'assistant',
          content: resposta.content
        });

        const toolResults: Anthropic.MessageParam[] = [];

        // Executar cada tool call
        for (const block of resposta.content) {
          if (block.type === 'tool_use') {
            const functionName = block.name;
            const functionArgs = block.input as any;

            // 📊 Log de tool call
            SDRLogger.toolCall(conversaId || leadId, functionName, functionArgs);

            // 🔒 FASE 3: VALIDAÇÃO FSM - Bloquear tool se não atender requisitos
            const validacao = this.validarToolCall(functionName, analise);

            let resultado: any;

            if (!validacao.permitido) {
              // 📊 Log de bloqueio FSM
              SDRLogger.toolResult(conversaId || leadId, functionName, false, {
                bloqueio: 'FSM',
                motivo: validacao.motivo
              });

              // Retornar erro para LLM - ele vai tentar coletar dados faltantes
              resultado = {
                error: 'BLOQUEADO_FSM',
                motivo: validacao.motivo,
                acao_necessaria: 'Colete os dados faltantes antes de chamar esta ferramenta',
                dados_faltantes: analise.dadosFaltantes
              };
            } else {
              // Adicionar leadId/contatoId aos argumentos se não estiver presente
              if (!functionArgs.leadId && !functionArgs.contatoId) {
                // Para tools de prospecção, usar contatoId
                if (['converter_para_lead', 'agendar_avaliacao', 'agendar_followup', 'registrar_optout', 'encaminhar_corretor'].includes(functionName)) {
                  functionArgs.contatoId = leadId;
                } else {
                  functionArgs.leadId = leadId;
                }
              }

              // Executar a tool apropriada
              if (functionName === 'qualificar_lead') {
                SDRLogger.qualificacao(conversaId || leadId, leadId, true, analise.estado.dadosColetados);
                resultado = await qualificarLeadTool.execute(functionArgs);
              } else if (functionName === 'solicitar_humano') {
                resultado = await solicitarHumanoTool.execute(functionArgs);
              } else if (functionName === 'buscar_imovel') {
                resultado = await buscarImovelTool.execute(functionArgs);
              } else if (functionName === 'registrar_optout') {
                SDRLogger.optOut(conversaId || leadId, leadId, functionArgs.motivo);
                resultado = await registrarOptoutTool.execute(functionArgs);
              } else if (functionName === 'converter_para_lead') {
                resultado = await converterParaLeadTool.execute(functionArgs);
              } else if (functionName === 'agendar_avaliacao') {
                resultado = await agendarAvaliacaoTool.execute(functionArgs);
              } else if (functionName === 'agendar_followup') {
                resultado = await agendarFollowupTool.execute(functionArgs);
              } else {
                resultado = { error: 'Função desconhecida' };
              }

              // 📊 Log de resultado da tool
              SDRLogger.toolResult(conversaId || leadId, functionName, !resultado.error, resultado);
            }

            // Adicionar resultado da tool no formato Anthropic
            toolResults.push({
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(resultado)
              }]
            });
          }
        }

        // Adicionar resultados das tools ao histórico
        mensagensAnthropic.push(...toolResults);

        // Chamar Claude novamente com os resultados
        resposta = await this.getClient().messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          temperature: 0.7,
          system: systemMessage,
          messages: mensagensAnthropic,
          tools: tools
        });

        iteracoes++;
      }

      // 📊 Log de métricas LLM
      if (resposta.usage) {
        SDRLogger.llmMetricas(
          conversaId || leadId,
          'claude-haiku-4-5-20251001',
          resposta.usage.input_tokens,
          resposta.usage.output_tokens,
          Date.now() - inicio
        );
      }

      // Extrair resposta final
      let respostaFinal = 'Desculpe, não entendi. Pode reformular?';

      for (const block of resposta.content) {
        if (block.type === 'text') {
          respostaFinal = block.text;
          break;
        }
      }

      // 📊 Log de resposta gerada
      SDRLogger.respostaGerada(conversaId || leadId, respostaFinal, analise.estado.fase);

      // 💾 FASE FINAL: Salvar estado FSM no banco (se tiver conversaId)
      if (conversaId) {
        await this.salvarEstado(conversaId, analise);
      }

      // 📊 Log de fim de processamento
      SDRLogger.fimProcessamento(conversaId || leadId, true, Date.now() - inicio);

      return respostaFinal;

    } catch (error: any) {
      // 📊 Log de erro
      SDRLogger.erro(conversaId || leadId, 'Processamento falhou', error);
      SDRLogger.fimProcessamento(conversaId || leadId, false, Date.now() - inicio);

      // Resposta de fallback amigável
      return 'Desculpe, tive um problema técnico. Pode repetir sua mensagem? 😊';
    }
  }

  /**
   * Verifica status do agente (para debug/monitoring)
   */
  getInfo(): { name: string; model: string } {
    return {
      name: 'Captador_SDR_Closer',
      model: 'claude-haiku-4-5-20251001'
    };
  }
}

// Exportar instância única (singleton)
// Mantém alias 'sdrWorker' para compatibilidade retroativa
export const captadorWorker = new CaptadorWorker();
export const sdrWorker = captadorWorker; // Alias para compatibilidade
