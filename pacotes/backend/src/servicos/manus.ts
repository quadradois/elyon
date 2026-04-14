/**
 * SERVIÇO DE INTEGRAÇÃO COM MANUS API
 * 
 * ⚠️ USO EXCLUSIVO: Pesquisa de informações de empreendimentos imobiliários
 * 
 * Este serviço é utilizado APENAS para:
 * - Pesquisar dados públicos sobre empreendimentos (plantas, preços, localização)
 * - Gerar briefings/RAG para campanhas de prospecção
 * - Alimentar o conhecimento do agente SDR sobre os imóveis
 * 
 * NÃO usar para:
 * - Conversas com leads (usar agentes OpenAI)
 * - Análise de mensagens (usar outros serviços)
 * - Qualquer outro propósito além de pesquisa de empreendimentos
 * 
 * API: https://api.manus.ai/v1
 * Documentação: https://open.manus.im/docs
 */

import axios, { AxiosInstance } from 'axios';

// ============================================
// TIPOS
// ============================================

export type ManusAgentProfile = 'manus-1.5' | 'manus-1.5-lite' | 'speed' | 'quality';
export type ManusTaskMode = 'chat' | 'adaptive' | 'agent';
export type ManusTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ManusCreateTaskRequest {
  prompt: string;
  agentProfile?: ManusAgentProfile;
  taskMode?: ManusTaskMode;
  hideInTaskList?: boolean;
  createShareableLink?: boolean;
  locale?: string;
}

export interface ManusCreateTaskResponse {
  task_id: string;
  task_title: string;
  task_url: string;
  share_url?: string;
}

export interface ManusTaskOutputContent {
  type: 'output_text' | 'file' | string;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
}

export interface ManusTaskOutput {
  id: string;
  status: string;
  role: 'user' | 'assistant';
  type: string;
  content: ManusTaskOutputContent[];
}

export interface ManusTask {
  id: string;
  object: string;
  created_at: number;
  updated_at: number;
  status: ManusTaskStatus;
  error?: string;
  incomplete_details?: string;
  instructions?: string;
  model?: string;
  output: ManusTaskOutput[];
  locale?: string;
  credit_usage?: number;
}

// ============================================
// PROMPTS DE PESQUISA
// ============================================

/**
 * Gera prompt otimizado para pesquisa de empreendimento imobiliário
 */
/**
 * Interface do JSON estruturado que o Manus deve retornar
 */
export interface BriefingEmpreendimentoJSON {
  nome_empreendimento: string;
  tipo_imovel?: string;
  construtora?: string;
  fase_obra?: string;
  previsao_entrega?: string;

  endereco?: {
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  };

  localizacao_detalhes?: {
    caracteristica_bairro?: string;
    regiao_cidade?: string;
    pontos_referencia?: string[];
    vias_acesso?: string[];
    proximidades?: {
      shoppings?: string[];
      supermercados?: string[];
      escolas?: string[];
      hospitais?: string[];
      transporte?: string[];
    };
  };

  condominio?: {
    valor_estimado?: number;
    areas_lazer?: string[];
    seguranca?: string[];
    vagas_garagem?: string;
    torres?: number;
    andares?: number;
    unidades_total?: number;
    elevador?: boolean;
  };

  faixa_preco?: {
    min?: number;
    max?: number;
    moeda?: string;
    valor_m2?: number;
  };

  metragens?: Array<{
    tipo?: string;
    area?: string;
    quartos?: number;
    preco_medio?: number;
  }>;

  caracteristicas?: string[];
  diferenciais?: string[];
  programas?: string[]; // MCMV, etc

  fontes?: string[];
  resumo?: string;
}

export function gerarPromptPesquisaEmpreendimento(dados: {
  nomeEmpreendimento: string;
  construtora?: string;
  endereco?: string;
  bairro?: string;
  cidade: string;
  estado?: string;
}): string {
  const localizacao = [
    dados.bairro,
    dados.cidade,
    dados.estado
  ].filter(Boolean).join(', ');

  const instrucoes = `
TAREFA: Pesquisar o empreendimento imobiliário "${dados.nomeEmpreendimento}" em ${localizacao}.
${dados.construtora ? `Construtora: ${dados.construtora}` : ''}
${dados.endereco ? `Endereço: ${dados.endereco}` : ''}

INSTRUÇÕES IMPORTANTES:
1. Pesquise informações sobre este empreendimento na internet
2. Compile os dados em formato JSON
3. ESCREVA O JSON DIRETAMENTE NESTA CONVERSA - NÃO CRIE ARQUIVOS
4. NÃO use ferramentas de criação de arquivo
5. O JSON deve aparecer AQUI no chat, não em arquivo separado

INFORMAÇÕES PARA BUSCAR:
- Nome, construtora, endereço, fase da obra
- Torres, andares, tipos de unidades
- Áreas de lazer, segurança, vagas
- Faixa de preços, valor m²
- Localização e proximidades

FORMATO DE RESPOSTA (copie e preencha):

{
  "nome_empreendimento": "${dados.nomeEmpreendimento}",
  "tipo_imovel": "Apartamento",
  "construtora": "Nome da Construtora",
  "fase_obra": "Em construção ou Pronto",
  "previsao_entrega": "Data ou Pronto",
  "endereco": {
    "logradouro": "Rua",
    "bairro": "${dados.bairro || 'Bairro'}",
    "cidade": "${dados.cidade}",
    "estado": "${dados.estado || 'GO'}",
    "cep": null
  },
  "condominio": {
    "areas_lazer": [],
    "vagas_garagem": "1-2",
    "torres": null,
    "andares": null
  },
  "faixa_preco": {
    "min": null,
    "max": null,
    "valor_m2": null
  },
  "caracteristicas": [],
  "diferenciais": [],
  "fontes": [],
  "resumo": "Breve descrição do empreendimento"
}

REGRAS:
- Responda APENAS com o JSON acima preenchido
- NÃO crie arquivos .json ou .txt
- NÃO gere documentos separados
- O JSON deve estar NESTA mensagem
- Use null para campos sem informação
`;

  return instrucoes.trim();
}


/**
 * Extrai texto de resposta do output do Manus
 */
export function extrairTextoResposta(task: ManusTask): string {
  const textos: string[] = [];

  for (const output of task.output) {
    if (output.role === 'assistant') {
      for (const content of output.content) {
        if (content.type === 'output_text' && content.text) {
          textos.push(content.text);
        } else if (content.type === 'file' || content.fileUrl) {
          // Se o agente gerou um arquivo, incluímos o link no texto
          const url = content.fileUrl || (content as any).url;
          const nome = content.fileName || (content as any).name || 'Arquivo gerado';
          textos.push(`\n[ARQUIVO GERADO: ${nome}](${url})\n`);
        }
      }
    }
  }

  return textos.join('\n\n');
}

/**
 * Extrai e valida JSON estruturado da resposta do Manus
 * Tenta encontrar e parsear o JSON mesmo se vier com texto adicional
 */
export function extrairJSONBriefing(textoResposta: string): {
  sucesso: boolean;
  dados: BriefingEmpreendimentoJSON | null;
  erro?: string;
  textoOriginal: string;
} {
  try {
    // Primeiro, tenta parsear diretamente (caso ideal)
    const parsed = JSON.parse(textoResposta.trim());
    if (parsed.nome_empreendimento) {
      console.log('[MANUS] ✅ JSON parseado diretamente');
      return { sucesso: true, dados: parsed, textoOriginal: textoResposta };
    }
  } catch {
    // Não é JSON puro, tentar extrair
  }

  // Tentar encontrar JSON no texto (pode ter texto antes/depois)
  const jsonPatterns = [
    /```json\s*([\s\S]*?)\s*```/,  // ```json ... ```
    /```\s*([\s\S]*?)\s*```/,      // ``` ... ```
    /(\{[\s\S]*"nome_empreendimento"[\s\S]*\})/,  // { ... "nome_empreendimento" ... }
  ];

  for (const pattern of jsonPatterns) {
    const match = textoResposta.match(pattern);
    if (match) {
      try {
        const jsonStr = match[1] || match[0];
        const parsed = JSON.parse(jsonStr.trim());
        if (parsed.nome_empreendimento) {
          console.log('[MANUS] ✅ JSON extraído com regex');
          return { sucesso: true, dados: parsed, textoOriginal: textoResposta };
        }
      } catch {
        continue;
      }
    }
  }

  // Última tentativa: encontrar primeiro { e último }
  const primeiroAbre = textoResposta.indexOf('{');
  const ultimoFecha = textoResposta.lastIndexOf('}');

  if (primeiroAbre !== -1 && ultimoFecha > primeiroAbre) {
    try {
      const jsonStr = textoResposta.substring(primeiroAbre, ultimoFecha + 1);
      const parsed = JSON.parse(jsonStr);
      if (parsed.nome_empreendimento) {
        console.log('[MANUS] ✅ JSON extraído por posição');
        return { sucesso: true, dados: parsed, textoOriginal: textoResposta };
      }
    } catch {
      // Falhou
    }
  }

  console.log('[MANUS] ❌ Não foi possível extrair JSON da resposta');
  return {
    sucesso: false,
    dados: null,
    erro: 'Não foi possível extrair JSON estruturado da resposta',
    textoOriginal: textoResposta,
  };
}

/**
 * Converte BriefingEmpreendimentoJSON para o formato do EditorBriefing (BriefingEstruturado)
 */
export function converterParaBriefingEstruturado(dados: BriefingEmpreendimentoJSON): Record<string, any> {
  return {
    nome_empreendimento: dados.nome_empreendimento,
    localizacao_completa: dados.endereco
      ? `${dados.endereco.logradouro || ''}, ${dados.endereco.bairro || ''} - ${dados.endereco.cidade || ''}/${dados.endereco.estado || ''}`
      : null,
    tipo_imovel: dados.tipo_imovel,

    localizacao_detalhes: {
      bairro: dados.endereco?.bairro,
      caracteristica_bairro: dados.localizacao_detalhes?.caracteristica_bairro,
      regiao_cidade: dados.localizacao_detalhes?.regiao_cidade,
      pontos_referencia: dados.localizacao_detalhes?.pontos_referencia || [],
      vias_acesso: dados.localizacao_detalhes?.vias_acesso || [],
      proximidades: dados.localizacao_detalhes?.proximidades || {},
    },

    condominio: {
      valor_estimado: dados.condominio?.valor_estimado,
      areas_lazer: dados.condominio?.areas_lazer || [],
      seguranca: dados.condominio?.seguranca || [],
      vagas_garagem: dados.condominio?.vagas_garagem,
      torres: dados.condominio?.torres,
      andares: dados.condominio?.andares,
      elevador: dados.condominio?.elevador,
    },

    faixa_preco: {
      min: dados.faixa_preco?.min,
      max: dados.faixa_preco?.max,
      moeda: dados.faixa_preco?.moeda || 'BRL',
      fonte: 'Pesquisa Manus AI',
      confianca: 0.7,
    },

    metragens: dados.metragens?.map(m => ({
      area: m.area,
      quartos: m.quartos,
      preco_medio: m.preco_medio,
    })) || [],

    caracteristicas: dados.caracteristicas?.map(c => ({ item: c, verificado: false })) || [],
    diferenciais: dados.diferenciais || [],
    pontos_interesse: dados.localizacao_detalhes?.proximidades
      ? Object.entries(dados.localizacao_detalhes.proximidades).flatMap(([tipo, items]) =>
        (items || []).map(item => ({ nome: item, tipo }))
      )
      : [],

    fontes_consultadas: dados.fontes || [],
    alertas: [],
    confiabilidade: 0.7,
  };
}

/**
 * Gera resumo textual a partir do JSON estruturado
 */
export function gerarResumoTextual(dados: BriefingEmpreendimentoJSON): string {
  const partes: string[] = [];

  partes.push(`# ${dados.nome_empreendimento}`);

  if (dados.construtora) {
    partes.push(`**Construtora:** ${dados.construtora}`);
  }

  if (dados.endereco) {
    const end = dados.endereco;
    partes.push(`**Localização:** ${end.bairro || ''}, ${end.cidade || ''} - ${end.estado || ''}`);
  }

  if (dados.fase_obra) {
    partes.push(`**Status:** ${dados.fase_obra}${dados.previsao_entrega ? ` (Entrega: ${dados.previsao_entrega})` : ''}`);
  }

  if (dados.faixa_preco) {
    const fp = dados.faixa_preco;
    if (fp.min && fp.max) {
      partes.push(`**Preços:** R$ ${fp.min.toLocaleString('pt-BR')} a R$ ${fp.max.toLocaleString('pt-BR')}`);
    }
  }

  if (dados.condominio) {
    const cond = dados.condominio;
    if (cond.torres || cond.andares) {
      partes.push(`**Estrutura:** ${cond.torres || '?'} torres, ${cond.andares || '?'} andares`);
    }
    if (cond.areas_lazer?.length) {
      partes.push(`**Lazer:** ${cond.areas_lazer.join(', ')}`);
    }
  }

  if (dados.metragens?.length) {
    partes.push(`**Opções:** ${dados.metragens.map(m => `${m.tipo || m.quartos + 'Q'} (${m.area})`).join(', ')}`);
  }

  if (dados.diferenciais?.length) {
    partes.push(`**Diferenciais:** ${dados.diferenciais.join(', ')}`);
  }

  if (dados.resumo) {
    partes.push(`\n${dados.resumo}`);
  }

  return partes.join('\n');
}

// ============================================
// SERVIÇO PRINCIPAL
// ============================================

class ManusService {
  private client: AxiosInstance;
  private apiKey: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.manus.ai/v1',
      timeout: 60000, // 60s timeout
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Configura a API Key
   */
  configurar(apiKey: string): void {
    this.apiKey = apiKey;
    this.client.defaults.headers['API_KEY'] = apiKey;
    console.log('[MANUS] ✅ API configurada');
  }

  /**
   * Verifica se o serviço está configurado
   */
  estaConfigurado(): boolean {
    return !!this.apiKey;
  }

  /**
   * Cria uma nova tarefa de pesquisa
   * 
   * NOTA: Verifica se a tarefa foi realmente criada fazendo um GET após a criação.
   * Se a tarefa não for encontrada imediatamente, indica problema com a API key.
   */
  async criarTarefa(request: ManusCreateTaskRequest): Promise<ManusCreateTaskResponse> {
    if (!this.apiKey) {
      throw new Error('Manus API não configurada. Configure MANUS_API_KEY no .env');
    }

    try {
      console.log('[MANUS] 🚀 Criando tarefa...');
      console.log('[MANUS] Prompt:', request.prompt.substring(0, 100) + '...');

      const response = await this.client.post<ManusCreateTaskResponse>('/tasks', {
        prompt: request.prompt,
        agentProfile: request.agentProfile || 'manus-1.5',
        taskMode: request.taskMode || 'agent',
        hideInTaskList: request.hideInTaskList ?? false,
        createShareableLink: request.createShareableLink ?? true,
        locale: request.locale || 'pt-BR',
      });

      console.log('[MANUS] ✅ Resposta de criação:', response.data.task_id);

      // Verificar se a tarefa foi realmente criada (aguardar 2s e tentar obter)
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        await this.client.get(`/tasks/${response.data.task_id}`);
        console.log('[MANUS] ✅ Tarefa verificada e acessível!');
      } catch (verifyError: any) {
        if (verifyError.response?.status === 404) {
          console.error('[MANUS] ❌ PROBLEMA CRÍTICO: Tarefa criada mas não acessível!');
          console.error('[MANUS] A API key pode não ter permissões corretas ou pertencer a outra conta.');
          console.error('[MANUS] Acesse https://manus.im/app?show_settings=integrations&app_name=api');
          console.error('[MANUS] para verificar sua API key e gerar uma nova se necessário.');

          throw new Error(
            'API Manus com problema: tarefas são criadas mas não ficam acessíveis. ' +
            'Verifique sua API key em manus.im/app (Configurações > Integrações > API). ' +
            'Pode ser necessário gerar uma nova chave ou verificar os créditos da conta.'
          );
        }
        // Outros erros de verificação não são críticos, a tarefa pode ainda estar inicializando
        console.log('[MANUS] ⚠️ Verificação inconclusa, mas tarefa foi criada');
      }

      return response.data;

    } catch (error: any) {
      console.error('[MANUS] ❌ Erro ao criar tarefa:', error.response?.data || error.message);
      throw new Error(`Erro ao criar tarefa Manus: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Obtém status e resultado de uma tarefa
   */
  async obterTarefa(taskId: string): Promise<ManusTask> {
    if (!this.apiKey) {
      throw new Error('Manus API não configurada');
    }

    try {
      const response = await this.client.get<ManusTask>(`/tasks/${taskId}`);
      return response.data;

    } catch (error: any) {
      console.error('[MANUS] ❌ Erro ao obter tarefa:', error.response?.data || error.message);
      throw new Error(`Erro ao obter tarefa: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Aguarda conclusão de uma tarefa (polling)
   */
  async aguardarConclusao(
    taskId: string,
    options: {
      intervalo?: number;      // ms entre verificações (default: 10s)
      timeout?: number;        // timeout total em ms (default: 5min)
      onProgresso?: (task: ManusTask) => void;
    } = {}
  ): Promise<ManusTask> {
    const intervalo = options.intervalo || 10000;
    const timeout = options.timeout || 300000;
    const inicio = Date.now();

    console.log(`[MANUS] ⏳ Aguardando conclusão da tarefa ${taskId}...`);

    while (true) {
      const task = await this.obterTarefa(taskId);

      if (options.onProgresso) {
        options.onProgresso(task);
      }

      if (task.status === 'completed') {
        console.log(`[MANUS] ✅ Tarefa concluída em ${Math.round((Date.now() - inicio) / 1000)}s`);
        return task;
      }

      if (task.status === 'failed') {
        console.error('[MANUS] ❌ Tarefa falhou:', task.error);
        throw new Error(`Tarefa falhou: ${task.error || 'Erro desconhecido'}`);
      }

      if (Date.now() - inicio > timeout) {
        throw new Error(`Timeout: tarefa não concluiu em ${timeout / 1000}s`);
      }

      console.log(`[MANUS] 🔄 Status: ${task.status}. Verificando novamente em ${intervalo / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, intervalo));
    }
  }

  /**
   * Pesquisa um empreendimento e retorna resultado formatado
   */
  async pesquisarEmpreendimento(dados: {
    nomeEmpreendimento: string;
    construtora?: string;
    endereco?: string;
    bairro?: string;
    cidade: string;
    estado?: string;
  }): Promise<{
    taskId: string;
    taskUrl: string;
    shareUrl?: string;
    status: ManusTaskStatus;
    resultado?: string;
    creditosUsados?: number;
  }> {
    // Gerar prompt
    const prompt = gerarPromptPesquisaEmpreendimento(dados);

    // Criar tarefa
    // Usar 'chat' em vez de 'agent' para evitar criação de arquivos
    // O modo 'chat' força resposta direta no texto
    const taskResponse = await this.criarTarefa({
      prompt,
      agentProfile: 'manus-1.5',
      taskMode: 'chat', // Mudado de 'agent' para 'chat' - resposta direta
      createShareableLink: true,
      locale: 'pt-BR',
    });

    return {
      taskId: taskResponse.task_id,
      taskUrl: taskResponse.task_url,
      shareUrl: taskResponse.share_url,
      status: 'pending',
    };
  }

  /**
   * Pesquisa empreendimento e aguarda resultado (síncrono)
   */
  async pesquisarEmpreendimentoSincrono(dados: {
    nomeEmpreendimento: string;
    construtora?: string;
    endereco?: string;
    bairro?: string;
    cidade: string;
    estado?: string;
  }, timeout?: number): Promise<{
    taskId: string;
    taskUrl: string;
    shareUrl?: string;
    status: ManusTaskStatus;
    resultado: string;
    creditosUsados?: number;
  }> {
    // Iniciar pesquisa
    const inicial = await this.pesquisarEmpreendimento(dados);

    // Aguardar conclusão
    const task = await this.aguardarConclusao(inicial.taskId, { timeout });

    // Extrair resultado
    const resultado = extrairTextoResposta(task);

    return {
      taskId: task.id,
      taskUrl: inicial.taskUrl,
      shareUrl: inicial.shareUrl,
      status: task.status,
      resultado,
      creditosUsados: task.credit_usage,
    };
  }

  // ============================================
  // WEBHOOKS
  // ============================================

  /**
   * Registra um webhook para receber notificações de tarefas
   */
  async registrarWebhook(url: string): Promise<{ webhookId: string }> {
    if (!this.apiKey) {
      throw new Error('Manus API não configurada');
    }

    try {
      console.log(`[MANUS] 🔗 Registrando webhook: ${url}`);

      const response = await this.client.post<{ webhook_id: string }>('/webhooks', {
        webhook: { url }
      });

      console.log(`[MANUS] ✅ Webhook registrado: ${response.data.webhook_id}`);
      return { webhookId: response.data.webhook_id };

    } catch (error: any) {
      console.error('[MANUS] ❌ Erro ao registrar webhook:', error.response?.data || error.message);
      throw new Error(`Erro ao registrar webhook: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Remove um webhook registrado
   */
  async removerWebhook(webhookId: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Manus API não configurada');
    }

    try {
      console.log(`[MANUS] 🗑️ Removendo webhook: ${webhookId}`);
      await this.client.delete(`/webhooks/${webhookId}`);
      console.log(`[MANUS] ✅ Webhook removido`);

    } catch (error: any) {
      console.error('[MANUS] ❌ Erro ao remover webhook:', error.response?.data || error.message);
      throw new Error(`Erro ao remover webhook: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Testa a conectividade com a API criando e obtendo uma tarefa simples
   */
  async testarConectividade(): Promise<{ sucesso: boolean; mensagem: string; detalhes?: any }> {
    if (!this.apiKey) {
      return { sucesso: false, mensagem: 'API key não configurada' };
    }

    try {
      // Tentar listar tarefas existentes
      const listResponse = await this.client.get('/tasks?limit=1');

      if (listResponse.data?.data) {
        return {
          sucesso: true,
          mensagem: 'Conectividade OK - consegue listar tarefas',
          detalhes: {
            totalTarefas: listResponse.data.data.length,
            hasMore: listResponse.data.has_more
          }
        };
      }

      return { sucesso: true, mensagem: 'Conectividade OK' };

    } catch (error: any) {
      return {
        sucesso: false,
        mensagem: 'Falha na conectividade',
        detalhes: error.response?.data || error.message
      };
    }
  }
}

// Singleton
export const manusService = new ManusService();

// Auto-configurar se API Key disponível
if (process.env.MANUS_API_KEY) {
  manusService.configurar(process.env.MANUS_API_KEY);
}
