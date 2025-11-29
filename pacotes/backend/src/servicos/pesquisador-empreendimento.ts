import OpenAI from 'openai';

/**
 * Serviço de Pesquisa Automática de Empreendimentos
 * 
 * Estratégia Multi-Fonte:
 * 1. Serper API (Google Search) - Snippets de todos os portais
 * 2. Scraping direto em portais menores (62imóveis, imovelweb)
 * 3. GPT-4 consolida e estrutura os dados
 * 
 * Custo: ~$0.01 por briefing
 */

interface DadosEmpreendimento {
  nome: string;
  localizacao: string;
  cep?: string; // NOVO: CEP para precisão
  tipo?: string;
  perfil?: string;
}

interface BriefingEstruturado {
  faixa_preco?: {
    min: number;
    max: number;
    moeda: string;
    observacao?: string; // "Valores com variação alta - validar"
  };
  caracteristicas: string[];
  diferenciais: string[];
  pontos_interesse: string[];
  resumo_sdr: string;
  fontes_consultadas: string[];
  confiabilidade: number; // 0-1
  alertas?: string[]; // NOVO: Alertas de inconsistências
  quantidade_resultados: number; // NOVO: Quantos resultados foram encontrados
  gerado_em: string;
}

export class PesquisadorEmpreendimento {
  private openai: OpenAI | null = null;

  /**
   * Lazy loading do cliente OpenAI
   * Garante que as variáveis de ambiente já foram carregadas
   */
  private getClient(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }

  /**
   * Pesquisa automática de dados do empreendimento
   */
  async pesquisar(dados: DadosEmpreendimento): Promise<BriefingEstruturado> {
    console.log(`[Pesquisador] Iniciando pesquisa: ${dados.nome} - ${dados.localizacao}`);

    const fontes: any = {};

    try {
      // 1. Buscar snippets no Google via Serper API
      if (process.env.SERPER_API_KEY) {
        console.log('[Pesquisador] Consultando Google Search...');
        fontes.google = await this.buscarGoogle(dados);
      } else {
        console.log('[Pesquisador] SERPER_API_KEY não configurada. Pulando Google Search.');
      }

      // 2. TODO (v1.5): Scraping portais menores
      // fontes.portais = await this.scrapePortaisMenores(dados);

      // 3. Consolidar dados com GPT-4
      console.log('[Pesquisador] Consolidando dados com GPT-4...');
      const briefing = await this.consolidarDados(dados, fontes);

      console.log('[Pesquisador] Briefing gerado com sucesso!');
      return briefing;

    } catch (error) {
      console.error('[Pesquisador] Erro durante pesquisa:', error);
      // Fallback: gerar briefing básico
      return this.gerarBriefingBasico(dados);
    }
  }

  /**
   * Busca snippets no Google usando Serper API
   */
  private async buscarGoogle(dados: DadosEmpreendimento): Promise<any> {
    // Melhora a query com CEP se disponível
    const localizacaoCompleta = dados.cep 
      ? `${dados.localizacao} CEP ${dados.cep}`
      : dados.localizacao;
    
    const query = `${dados.nome} ${localizacaoCompleta} ${dados.tipo || 'apartamento'} venda preço características`;
    
    console.log(`[Pesquisador] Query de busca: "${query}"`);

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: 10, // Top 10 resultados
          gl: 'br', // Geolocalização Brasil
          hl: 'pt-br', // Idioma português
        }),
      });

      if (!response.ok) {
        console.error(`[Pesquisador] Serper API retornou status ${response.status}`);
        const errorText = await response.text();
        console.error(`[Pesquisador] Resposta de erro: ${errorText}`);
        throw new Error(`Serper API error: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();
      const resultados = data.organic || [];
      
      console.log(`[Pesquisador] Serper retornou ${resultados.length} resultados`);
      
      // VALIDAÇÃO CRÍTICA: Quantidade mínima de resultados
      if (resultados.length === 0) {
        console.warn('[Pesquisador] ⚠️ NENHUM resultado encontrado!');
        return [];
      }
      
      if (resultados.length < 3) {
        console.warn(`[Pesquisador] ⚠️ Apenas ${resultados.length} resultados (mínimo recomendado: 3)`);
      }
      
      // Log dos domínios encontrados
      const dominios = resultados.map((r: any) => new URL(r.link).hostname);
      console.log(`[Pesquisador] Fontes encontradas:`, dominios);
      
      return resultados;

    } catch (error) {
      console.error('[Pesquisador] Erro ao buscar no Google:', error);
      if(error instanceof Error) {
        console.error('[Pesquisador] Stack:', error.stack);
      }
      return [];
    }
  }

  /**
   * Consolida dados de múltiplas fontes usando GPT-4
   */
  private async consolidarDados(
    dados: DadosEmpreendimento,
    fontes: any
  ): Promise<BriefingEstruturado> {
    
    const quantidadeResultados = fontes.google?.length || 0;
    
    const prompt = `Você é um analista imobiliário CRÍTICO e PRECISO especializado no Brasil.

TAREFA: Analise as informações abaixo e crie um briefing estruturado sobre o empreendimento.

EMPREENDIMENTO:
- Nome: ${dados.nome}
- Localização: ${dados.localizacao}
${dados.cep ? `- CEP: ${dados.cep}` : ''}
- Tipo: ${dados.tipo || 'Apartamento'}
- Perfil: ${dados.perfil || 'Residencial'}

DADOS COLETADOS (${quantidadeResultados} fontes):
${fontes.google ? `\nGoogle Search:\n${JSON.stringify(fontes.google, null, 2)}` : 'Nenhum dado disponível'}

⚠️ VALIDAÇÕES CRÍTICAS (MUITO IMPORTANTE):

1. **Preços**: Se houver variação >30% entre valores, adicione alerta de "Alta variação de preços"
2. **Metragem**: SEMPRE especifique se é área privativa ou total. Se ambos aparecerem, separe claramente.
3. **Localização**: Valide se pontos de interesse fazem sentido geograficamente. Ex: "Shopping Flamboyant a 3km" só se realmente estiver próximo.
4. **Inconsistências**: Se dados conflitantes (ex: diferentes tamanhos, preços muito díspares), liste nos alertas.
5. **Quantidade de dados**: Se menos de 3 resultados, reduza confiabilidade para ≤0.6

INSTRUÇÕES:
1. Calcule faixa de preço usando VALORES MÉDIOS (descarte outliers muito discrepantes)
2. Liste características mais citadas (quartos, área, vagas)
3. Liste apenas diferenciais CONFIRMADOS em múltiplas fontes
4. Pontos de interesse: SOMENTE se mencionados e geograficamente coerentes
5. Confiabilidade: 0.8-1.0 se 5+ fontes consistentes; 0.5-0.7 se 3-4 fontes; <0.5 se <3 fontes

🎯 RESUMO PARA SDR (CRÍTICO - CONTEXTO DO EMPREENDIMENTO):

O resumo deve conter INFORMAÇÕES SOBRE O EMPREENDIMENTO para o SDR usar como contexto nas conversas.

NÃO CRIE UM SCRIPT DE VENDAS! Apenas descreva o empreendimento objetivamente.

Exemplo de um BOM resumo:
"O Reserva Buriti é um empreendimento econômico localizado na Vila Rosa, Goiânia. 
Oferece apartamentos de 2 quartos com 54m² de área privativa, com valores entre R$ 330k e R$ 380k. 
O condomínio conta com área de lazer completa incluindo piscina e varanda gourmet. 
Fica próximo ao Buriti Shopping (500m) e ao Parque Vaca Brava (2km)."

Estrutura do resumo:
1. Nome e perfil do empreendimento
2. Tipo e características dos imóveis
3. Faixa de preço observada
4. Principais diferenciais
5. Localização e pontos de interesse

Retorne APENAS um JSON válido no formato:
{
  "faixa_preco": { 
    "min": 450000, 
    "max": 550000, 
    "moeda": "BRL",
    "observacao": "Valores de anúncios encontrados - valor real depende do mercado e necessidade" 
  },
  "caracteristicas": ["3 quartos", "2 vagas", "120m² área total (95m² privativa)"],
  "diferenciais": ["Área de lazer completa", "Localização privilegiada"],
  "pontos_interesse": ["Buriti Shopping (500m)", "Parque Areião (1km)"],
  "resumo_sdr": "O [Empreendimento] é um condomínio [perfil] localizado em [bairro], [cidade]. Oferece apartamentos de [X] quartos com [Y]m² de área [privativa/total], com valores entre R$ [min] e R$ [max]. O condomínio conta com [diferenciais principais]. Fica próximo a [pontos de interesse relevantes].",
  "fontes_consultadas": ["portal1.com.br", "portal2.com.br"],
  "alertas": ["Preços são de anúncios - valor real varia conforme mercado"], 
  "confiabilidade": 0.75
}`;

    try {
      const completion = await this.getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2, // Mais conservador para evitar alucinações
      });

      const briefing = JSON.parse(completion.choices[0].message.content || '{}');
      briefing.gerado_em = new Date().toISOString();
      briefing.quantidade_resultados = quantidadeResultados;
      
      // Se menos de 3 resultados, forçar baixa confiabilidade
      if (quantidadeResultados < 3 && briefing.confiabilidade > 0.6) {
        briefing.confiabilidade = 0.5;
        briefing.alertas = briefing.alertas || [];
        briefing.alertas.push(`Apenas ${quantidadeResultados} resultado(s) encontrado(s) - validar manualmente`);
      }

      return briefing as BriefingEstruturado;

    } catch (error) {
      console.error('[Pesquisador] Erro ao consolidar com GPT:', error);
      return this.gerarBriefingBasico(dados);
    }
  }

  /**
   * Gera briefing básico quando não há dados suficientes
   */
  private gerarBriefingBasico(dados: DadosEmpreendimento): BriefingEstruturado {
    return {
      caracteristicas: [dados.tipo || 'Imóvel residencial'],
      diferenciais: [],
      pontos_interesse: [],
      resumo_sdr: `Estamos prospectando proprietários no ${dados.nome}, localizado em ${dados.localizacao}. Para informações mais detalhadas sobre valores e características, nosso time pode fornecer uma avaliação personalizada do seu imóvel.`,
      fontes_consultadas: ['Dados básicos fornecidos'],
      confiabilidade: 0.3,
      alertas: ['Dados insuficientes - pesquisa não retornou resultados'],
      quantidade_resultados: 0,
      gerado_em: new Date().toISOString(),
    };
  }
}

export const pesquisadorEmpreendimento = new PesquisadorEmpreendimento();

/*
 * TODO v1.5 - FONTES ESPECIALIZADAS:
 * 
 * Adicionar scraping/integração com portais especializados:
 * - https://myside.com.br/ - Blogs sobre regiões (contexto local)
 * - https://apto.vc/ - Preços atualizados
 * - https://www.wimoveis.com.br/ - Preços e informações
 * - https://www.imovelguide.com.br/ - Avaliação m² por região
 * 
 * TODO v2.0 - APRENDIZADO SUPERVISIONADO:
 * 
 * Usar conversas reais com proprietários como feedback:
 * - Salvar observações do corretor sobre precisão dos dados
 * - Ajustar pesos de fontes baseado em feedback
 * - Fine-tuning do modelo com dados validados
 */
