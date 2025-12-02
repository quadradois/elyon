/**
 * ========================================================================
 * ARQUIVO DESATIVADO - NÃO ESTÁ EM USO
 * ========================================================================
 * Este arquivo contém o serviço de pesquisa de empreendimentos por IA.
 * Foi desativado em 02/12/2025 em favor do preenchimento manual.
 * 
 * Para reativar:
 * 1. Renomear para pesquisador-empreendimento.ts
 * 2. Renomear _groq.DESATIVADO.ts para groq.ts
 * 3. Descomentar imports abaixo
 * 4. Atualizar rotas/campanhas.ts para usar este serviço
 * ========================================================================
 */

// IMPORTS DESATIVADOS - descomentar para reativar
// import { GeminiClient, getAIProvider } from './gemini';
// import { GroqClient } from './groq';
// import OpenAI from 'openai';

// Placeholders para evitar erros de compilação
type GeminiClient = any;
type GroqClient = any;
const getAIProvider = () => null;

/**
 * Serviço de Pesquisa Automática de Empreendimentos v2.1
 * 
 * MELHORIAS IMPLEMENTADAS:
 * - Suporte a múltiplos provedores de IA (Groq, Gemini, OpenAI)
 * - Múltiplas queries especializadas (preço, características, construtora)
 * - Filtro de domínios confiáveis vs não confiáveis
 * - Prompt mais restritivo para evitar alucinações
 * - Separação de dados verificados vs inferidos
 * - Validação geográfica de pontos de interesse
 * 
 * Estratégia Multi-Fonte:
 * 1. Serper API (Google Search) - Snippets de portais imobiliários
 * 2. Filtro de qualidade (prioriza fontes confiáveis)
 * 3. IA consolida com instruções anti-alucinação
 * 
 * Custo: GRATUITO com Groq/Gemini, ~$0.02 por briefing com OpenAI
 */

// Função para escolher provedor de IA (prioridade: Groq > Gemini > OpenAI)
function detectAIProvider(): 'groq' | 'gemini' | 'openai' | null {
  if (process.env.GROQ_API_KEY) {
    return 'groq';
  }
  if (process.env.GEMINI_API_KEY) {
    return 'gemini';
  }
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  return null;
}

interface DadosEmpreendimento {
  nome: string;
  localizacao: string;   // Campo legado ou montado
  // Campos separados (novo padrão)
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  tipo?: string;
  perfil?: string;
}

// NOVO: Estrutura mais rica para diferenciar dados verificados vs inferidos
interface DadoVerificado {
  valor: string | number;
  fonte: string;
  confianca: number; // 0-1
}

interface BriefingEstruturado {
  // Dados básicos (sempre presentes)
  nome_empreendimento: string;
  localizacao_completa: string;
  tipo_imovel: string;
  
  // Dados de preço (podem ser inferidos)
  faixa_preco?: {
    min: number;
    max: number;
    moeda: string;
    fonte: string; // De onde veio a informação
    confianca: number; // 0-1
    observacao?: string;
  };
  
  // Características físicas
  caracteristicas: Array<{
    item: string;
    verificado: boolean; // true = encontrado em fonte, false = inferido
    fonte?: string;
  }>;
  
  // Diferenciais do empreendimento
  diferenciais: string[];
  
  // Pontos de interesse (com validação geográfica)
  pontos_interesse: Array<{
    nome: string;
    distancia?: string;
    verificado: boolean; // true = fonte menciona, false = estimativa
  }>;
  
  // Resumo para o SDR (texto narrativo)
  resumo_sdr: string;
  
  // Metadados
  fontes_consultadas: string[];
  fontes_descartadas?: string[]; // Domínios ignorados por baixa qualidade
  alertas: string[];
  confiabilidade: number; // 0-1 geral
  quantidade_resultados: number;
  gerado_em: string;
}

// Domínios confiáveis para dados imobiliários
// Lista curada de portais de qualidade para consulta
const DOMINIOS_CONFIAVEIS = [
  // Portais Nacionais de Imóveis (Alta Confiança)
  'zapimoveis.com.br',      // ZAP Imóveis
  'vivareal.com.br',        // Viva Real (mesmo grupo ZAP)
  'olx.com.br',             // OLX Imóveis
  'imovelweb.com.br',       // ImóvelWeb
  'quintoandar.com.br',     // Quinto Andar
  'chavesnamao.com.br',     // Chaves na Mão
  
  // Portais Regionais (Goiás/DF - Alta Relevância)
  'wimoveis.com.br',        // W Imóveis - especializado GO/DF
  '62imoveis.com.br',       // 62 Imóveis - focado Goiânia/GO
  
  // Outros Portais Relevantes
  'casamineira.com.br',     // Casa Mineira
  'lugarcerto.com.br',      // Lugar Certo
  'imoveis.com.br',         // Portal genérico
  
  // Sites de Informação e Análise
  'myside.com.br',          // Blogs sobre regiões/bairros
  'imovelguide.com.br',     // Avaliação m² por região
  'apto.vc',                // Preços e análises
  
  // Sites de Incorporadoras (match parcial)
  'construtora',
  'incorporadora',
  'empreendimento',
  'lancamento',
];

const DOMINIOS_EVITAR = [
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'tiktok.com',
  'youtube.com',
  'reddit.com',
  'reclameaqui.com.br',
  'jusbrasil.com.br',
  'wikipedia.org',
];

export class PesquisadorEmpreendimento {
  private openai: OpenAI | null = null;
  private gemini: GeminiClient | null = null;
  private groq: GroqClient | null = null;
  private aiProvider: 'groq' | 'gemini' | 'openai' | null = null;

  constructor() {
    this.aiProvider = detectAIProvider();
    console.log(`[Pesquisador v2.1] 🤖 Provedor de IA: ${this.aiProvider || 'nenhum configurado'}`);
  }

  private getOpenAIClient(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }

  private getGeminiClient(): GeminiClient {
    if (!this.gemini) {
      this.gemini = new GeminiClient();
    }
    return this.gemini;
  }

  private getGroqClient(): GroqClient {
    if (!this.groq) {
      this.groq = new GroqClient();
    }
    return this.groq;
  }

  /**
   * Consulta dados de preço/m² do ZAP Imóveis via Glue API
   * DESATIVADO: Cloudflare bloqueia requisições automatizadas
   * TODO: Implementar Puppeteer para contornar bloqueio se necessário
   */
  private async consultarZapM2(dados: DadosEmpreendimento): Promise<any> {
    // API do ZAP protegida por Cloudflare - desativado temporariamente
    console.log('[ZAP API] ⏸️ Desativado (Cloudflare protection)');
    return null;
  }

  /**
   * Pesquisa automática com múltiplas queries especializadas
   */
  async pesquisar(dados: DadosEmpreendimento): Promise<BriefingEstruturado> {
    console.log(`[Pesquisador v2] 🔍 Iniciando pesquisa: ${dados.nome} - ${dados.localizacao}`);

    const fontes: any = {
      preco: [],
      caracteristicas: [],
      construtora: [],
      zapM2: null, // Dados do ZAP sobre m² do bairro
    };

    try {
      // NOVO: Consultar ZAP Imóveis para dados de m² do bairro
      console.log('[Pesquisador v2] 🏠 Consultando ZAP Imóveis (valor m² bairro)...');
      fontes.zapM2 = await this.consultarZapM2(dados);
      
      if (process.env.SERPER_API_KEY) {
        console.log('[Pesquisador v2] 📡 Executando queries especializadas...');
        
        // Query 1: Preço e metragem
        fontes.preco = await this.buscarGoogle(
          `"${dados.nome}" ${dados.localizacao} preço valor m² área metros`,
          dados
        );
        
        // Query 2: Características físicas
        fontes.caracteristicas = await this.buscarGoogle(
          `"${dados.nome}" ${dados.localizacao} quartos suíte vagas planta`,
          dados
        );
        
        // Query 3: Construtora/Incorporadora (dados oficiais)
        fontes.construtora = await this.buscarGoogle(
          `"${dados.nome}" ${dados.localizacao} construtora incorporadora lançamento entrega`,
          dados
        );
        
      } else {
        console.log('[Pesquisador v2] ⚠️ SERPER_API_KEY não configurada');
      }

      // Consolidar todas as fontes
      const todasFontes = [
        ...fontes.preco,
        ...fontes.caracteristicas,
        ...fontes.construtora
      ];
      
      // Remover duplicatas por URL
      const fontesUnicas = this.removerDuplicatas(todasFontes);
      
      // Filtrar por qualidade
      const { confiaveis, descartadas } = this.filtrarPorQualidade(fontesUnicas);
      
      console.log(`[Pesquisador v2] ✅ ${confiaveis.length} fontes confiáveis, ${descartadas.length} descartadas`);

      // Consolidar com GPT usando prompt melhorado + dados do ZAP
      const briefing = await this.consolidarDados(dados, confiaveis, descartadas, fontes.zapM2);

      console.log('[Pesquisador v2] 📋 Briefing gerado com sucesso!');
      return briefing;

    } catch (error) {
      console.error('[Pesquisador v2] ❌ Erro durante pesquisa:', error);
      return this.gerarBriefingBasico(dados);
    }
  }

  /**
   * Busca no Google com query específica
   */
  private async buscarGoogle(query: string, dados: DadosEmpreendimento): Promise<any[]> {
    console.log(`[Pesquisador v2] 🔎 Query: "${query.substring(0, 60)}..."`);

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: 10,
          gl: 'br',
          hl: 'pt-br',
        }),
      });

      if (!response.ok) {
        console.error(`[Pesquisador v2] Serper erro: ${response.status}`);
        return [];
      }

      const data: any = await response.json();
      const resultados = data.organic || [];
      
      console.log(`[Pesquisador v2] 📊 ${resultados.length} resultados`);
      
      return resultados;

    } catch (error) {
      console.error('[Pesquisador v2] Erro na busca:', error);
      return [];
    }
  }

  /**
   * Remove resultados duplicados por URL
   */
  private removerDuplicatas(resultados: any[]): any[] {
    const vistos = new Set<string>();
    return resultados.filter(r => {
      if (vistos.has(r.link)) return false;
      vistos.add(r.link);
      return true;
    });
  }

  /**
   * Filtra resultados por qualidade do domínio
   */
  private filtrarPorQualidade(resultados: any[]): { confiaveis: any[], descartadas: string[] } {
    const confiaveis: any[] = [];
    const descartadas: string[] = [];

    for (const r of resultados) {
      try {
        const hostname = new URL(r.link).hostname.toLowerCase();
        
        // Verificar se deve evitar
        const deveEvitar = DOMINIOS_EVITAR.some(d => hostname.includes(d));
        if (deveEvitar) {
          descartadas.push(hostname);
          continue;
        }
        
        // Verificar se é confiável (prioridade) ou neutro (aceitar)
        const ehConfiavel = DOMINIOS_CONFIAVEIS.some(d => hostname.includes(d));
        
        // Adicionar score de confiabilidade ao resultado
        r._confiabilidade = ehConfiavel ? 0.9 : 0.6;
        r._hostname = hostname;
        
        confiaveis.push(r);
        
      } catch (e) {
        // URL inválida, ignorar
        continue;
      }
    }

    return { confiaveis, descartadas };
  }

  /**
   * Consolida dados com prompt anti-alucinação
   */
  private async consolidarDados(
    dados: DadosEmpreendimento,
    fontesConfiaveis: any[],
    fontesDescartadas: string[],
    dadosZapM2?: any // NOVO: Dados de m² do ZAP Imóveis
  ): Promise<BriefingEstruturado> {
    
    const quantidadeResultados = fontesConfiaveis.length;
    
    // Preparar fontes para o prompt
    const fontesFormatadas = fontesConfiaveis.map(f => ({
      titulo: f.title,
      snippet: f.snippet,
      dominio: f._hostname,
      confiabilidade: f._confiabilidade
    }));

    // NOVO: Formatar dados do ZAP se disponíveis
    let dadosZapFormatados = '';
    if (dadosZapM2) {
      dadosZapFormatados = `
📊 DADOS OFICIAIS DO ZAP IMÓVEIS (ALTA CONFIABILIDADE):
- Bairro: ${dadosZapM2.bairro}, ${dadosZapM2.cidade}
- Valor médio m² VENDA: R$ ${dadosZapM2.valor_m2_venda?.toLocaleString('pt-BR') || 'Não disponível'}
- Valor médio m² ALUGUEL: R$ ${dadosZapM2.valor_m2_aluguel?.toLocaleString('pt-BR') || 'Não disponível'}/mês
${dadosZapM2.por_dormitorio ? `- Valores por dormitório: ${JSON.stringify(dadosZapM2.por_dormitorio)}` : ''}
- Fonte: ${dadosZapM2.url}

⚠️ USE ESTES DADOS do ZAP para calcular estimativas de preço!
Exemplo: Se o imóvel tem 55m² e o m² médio é R$ 6.691, preço estimado = R$ 368.000
`;
    }

    const prompt = `Você é um analista imobiliário especializado. Analise as fontes e extraia TODAS as informações disponíveis.

EMPREENDIMENTO: ${dados.nome}
LOCALIZACAO: ${dados.localizacao}
${dados.cep ? `CEP: ${dados.cep}` : ''}
TIPO: ${dados.tipo || 'Apartamento'}
${dadosZapFormatados}

FONTES (${quantidadeResultados} resultados):
${JSON.stringify(fontesFormatadas, null, 2)}

INSTRUCOES DE EXTRACAO:

1. PRECOS - Extraia TODOS os precos de venda (R$ 200k-500k sao validos para apartamentos):
   - Liste cada preco com fonte e metragem
   - MIN = menor preco, MAX = maior preco
   - IGNORE valores de condominio (R$ 200-600) e IPTU (R$ 50-200)

2. LOCALIZACAO - Extraia detalhes do bairro/regiao:
   - Caracteristicas do bairro (residencial, comercial, nobre, popular)
   - Proximidades importantes (shoppings, supermercados, escolas, hospitais)
   - Vias de acesso (avenidas, BRTs, rodovias)

3. CONDOMINIO - Extraia informacoes da infraestrutura:
   - Valor estimado do condominio mensal
   - Areas de lazer (piscina, academia, churrasqueira, playground, salao de festas)
   - Seguranca (portaria 24h, cameras)
   - Vagas de garagem, torres e andares

4. CARACTERISTICAS DO IMOVEL:
   - Quartos, suites, metragens, varanda

Retorne APENAS JSON valido:

{
  "nome_empreendimento": "${dados.nome}",
  "localizacao_completa": "${dados.localizacao}",
  "tipo_imovel": "${dados.tipo || 'Apartamento'}",
  
  "localizacao_detalhes": {
    "bairro": "Nome do bairro",
    "caracteristica_bairro": "Residencial, comercial, misto, etc",
    "regiao_cidade": "Regiao (norte, sul, leste, oeste, centro)",
    "pontos_referencia": ["Shopping X", "Av. Principal"],
    "vias_acesso": ["BR-153", "Av. T-63"],
    "proximidades": {
      "shoppings": ["Shopping X - 3km"],
      "supermercados": ["Atacadao - 1km"],
      "escolas": ["Colegio X - 500m"],
      "hospitais": ["Hospital Y - 2km"],
      "transporte": ["Terminal de onibus - 800m"]
    }
  },
  
  "condominio": {
    "valor_estimado": 350,
    "areas_lazer": ["Piscina adulto", "Piscina infantil", "Academia", "Churrasqueira", "Salao de festas", "Playground"],
    "seguranca": ["Portaria 24h", "Cameras de seguranca"],
    "vagas_garagem": "1 vaga coberta",
    "torres": 2,
    "andares": 8,
    "elevador": true
  },
  
  "precos_encontrados": [
    {"valor": 230000, "fonte": "site.com.br", "metragem": "54m2"}
  ],
  
  "faixa_preco": {
    "min": 0,
    "max": 0,
    "moeda": "BRL",
    "fonte": "consolidado de X fontes",
    "confianca": 0.0
  },
  
  "metragens": [
    {"area": "54m2", "quartos": 2, "preco_medio": 280000}
  ],
  
  "caracteristicas": [
    { "item": "2 quartos com 1 suite", "verificado": true },
    { "item": "54-59 m2", "verificado": true }
  ],
  
  "diferenciais": ["Apenas diferenciais REAIS encontrados nas fontes"],
  
  "pontos_interesse": [
    { "nome": "Shopping X", "tipo": "shopping", "distancia": "2km" }
  ],
  
  "resumo_sdr": "Escreva 5-6 frases completas incluindo: (1) Nome e localizacao com caracteristicas do bairro; (2) Tipologia e metragens; (3) Faixa de preco de venda; (4) Principais areas de lazer do condominio; (5) Diferenciais de localizacao (proximidades); (6) Por que e um bom investimento.",
  
  "fontes_consultadas": ["dominio1.com.br", "dominio2.com.br"],
  "alertas": [],
  "confiabilidade": 0.0
}

CONFIABILIDADE: 0.8+ para 5+ fontes, 0.6-0.79 para 3-4 fontes, 0.4-0.59 para 1-2 fontes.

IMPORTANTE: O resumo_sdr deve ter 5-6 frases completas mencionando localizacao, bairro, precos, lazer do condominio e diferenciais!`;

    try {
      let briefing: any;

      // Escolher provedor de IA (prioridade: Groq > Gemini > OpenAI)
      if (this.aiProvider === 'groq') {
        console.log('[Pesquisador v2.1] 🚀 Usando Groq Llama-3.1 (gratuito)');
        briefing = await this.getGroqClient().generateJSON(prompt, { temperature: 0.1 });
      } else if (this.aiProvider === 'gemini') {
        console.log('[Pesquisador v2.1] 🤖 Usando Google Gemini (gratuito)');
        briefing = await this.getGeminiClient().generateJSON(prompt, { temperature: 0.1 });
      } else if (this.aiProvider === 'openai') {
        console.log('[Pesquisador v2.1] 🤖 Usando OpenAI GPT-4');
        const completion = await this.getOpenAIClient().chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        });
        briefing = JSON.parse(completion.choices[0].message.content || '{}');
      } else {
        console.log('[Pesquisador v2.1] ⚠️ Nenhum provedor de IA configurado');
        return this.gerarBriefingBasico(dados);
      }
      
      // Adicionar metadados
      briefing.gerado_em = new Date().toISOString();
      briefing.quantidade_resultados = quantidadeResultados;
      briefing.fontes_descartadas = fontesDescartadas;
      briefing.provedor_ia = this.aiProvider; // Registrar qual IA foi usada
      
      // NOVO: Adicionar dados brutos do ZAP se disponíveis
      if (dadosZapM2) {
        briefing.dados_zap_m2 = dadosZapM2;
      }
      
      // Garantir arrays
      briefing.alertas = briefing.alertas || [];
      briefing.caracteristicas = briefing.caracteristicas || [];
      briefing.diferenciais = briefing.diferenciais || [];
      briefing.pontos_interesse = briefing.pontos_interesse || [];
      
      // Forçar baixa confiabilidade se poucos resultados
      if (quantidadeResultados < 3) {
        briefing.confiabilidade = Math.min(briefing.confiabilidade, 0.5);
        briefing.alertas.push(`⚠️ Apenas ${quantidadeResultados} fonte(s) encontrada(s) - validar dados manualmente`);
      }
      
      // Verificar se faixa de preço foi encontrada
      if (!briefing.faixa_preco || briefing.faixa_preco.min === 0) {
        briefing.alertas.push('💰 Faixa de preço não encontrada nas fontes - consultar diretamente');
      }

      return briefing as BriefingEstruturado;

    } catch (error) {
      console.error('[Pesquisador v2.1] Erro ao consolidar com IA:', error);
      return this.gerarBriefingBasico(dados);
    }
  }

  /**
   * Gera briefing básico quando não há dados suficientes
   */
  private gerarBriefingBasico(dados: DadosEmpreendimento): BriefingEstruturado {
    return {
      nome_empreendimento: dados.nome,
      localizacao_completa: dados.localizacao,
      tipo_imovel: dados.tipo || 'Apartamento',
      
      caracteristicas: [
        { item: dados.tipo || 'Imóvel residencial', verificado: false }
      ],
      diferenciais: [],
      pontos_interesse: [],
      
      resumo_sdr: `O ${dados.nome} está localizado em ${dados.localizacao}. Não foi possível obter informações detalhadas sobre preços e características através da pesquisa automática. Recomenda-se validar os dados diretamente com a construtora/incorporadora ou através de visita ao local.`,
      
      fontes_consultadas: [],
      fontes_descartadas: [],
      alertas: [
        '⚠️ Pesquisa automática não retornou dados suficientes',
        '📋 Recomendado: Preencher briefing manualmente com dados oficiais'
      ],
      confiabilidade: 0.2,
      quantidade_resultados: 0,
      gerado_em: new Date().toISOString(),
    };
  }
}

export const pesquisadorEmpreendimento = new PesquisadorEmpreendimento();
