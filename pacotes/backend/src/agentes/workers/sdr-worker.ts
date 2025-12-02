import OpenAI from 'openai';
import { todasFerramentasSDR, qualificarLeadTool, solicitarHumanoTool, buscarImovelTool } from '../../ferramentas/sdr-tools';

/**
 * SDR WORKER
 * 
 * Agente especializado em qualificação de leads (Sales Development Representative).
 * 
 * Responsabilidades:
 * - Fazer primeiro contato amigável
 * - Descobrir interesse (VENDER ou ALUGAR)
 * - Qualificar urgência e orçamento
 * - Classificar lead (FRIO/MORNO/QUENTE)
 * - Transferir para corretor quando apropriado
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
  tenantNome?: string;
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

export class SDRWorker {
  private openai: OpenAI | null = null;
  
  constructor() {
    // Lazy initialization - será criado no primeiro uso
    // Isso garante que o dotenv já carregou as variáveis de ambiente
  }
  
  /**
   * Gera o system prompt personalizado baseado na configuração do tenant
   */
  private gerarSystemPrompt(config: ConfiguracaoAgente, contextoRAG?: string): string {
    const { nome, personalidade, expertise, scripts, tenantNome } = config;
    
    // Definir instruções de tom
    let instrucoesTom = '';
    switch (personalidade.tom) {
      case 'formal':
        instrucoesTom = `
- Use linguagem formal e profissional
- Evite gírias e expressões informais
- Trate o cliente por "senhor(a)"
- Seja direto e objetivo`;
        break;
      case 'entusiasta':
        instrucoesTom = `
- Seja animado e positivo
- Use expressões de entusiasmo
- Transmita energia e empolgação
- Celebre cada avanço na conversa`;
        break;
      default: // amigavel
        instrucoesTom = `
- Seja amigável e acolhedor
- Use linguagem natural e próxima
- Demonstre interesse genuíno
- Crie conexão com o cliente`;
    }
    
    // Instruções sobre emojis
    const instrucoesEmoji = personalidade.usarEmojis 
      ? '- Use emojis COM MODERAÇÃO (1 por mensagem, quando apropriado)'
      : '- NÃO use emojis nas mensagens';
    
    // Expertise em bairros e tipos
    const expertiseBairros = expertise.bairros.length > 0
      ? `Você é especialista nos bairros: ${expertise.bairros.join(', ')}.`
      : 'Você conhece todos os bairros da cidade.';
    
    const expertiseTipos = expertise.tiposImovel.length > 0
      ? `Seu foco é em: ${expertise.tiposImovel.join(', ')}.`
      : 'Você trabalha com todos os tipos de imóveis.';

    // Extrair informações de confiabilidade do contexto RAG
    let instrucoesDadosEmpreendimento = '';
    if (contextoRAG) {
      instrucoesDadosEmpreendimento = `
📚 CONHECIMENTO DO EMPREENDIMENTO
${contextoRAG}

⚠️ REGRAS CRÍTICAS SOBRE DADOS DO EMPREENDIMENTO:

1. **Preços e valores**: NUNCA afirme valores específicos como fatos.
   - ❌ ERRADO: "O apartamento custa R$ 350.000"
   - ✅ CERTO: "Os valores que temos são uma referência de mercado, a avaliação exata nosso corretor pode fazer"

2. **Metragem**: Se mencionar área, diga que é aproximada.
   - ❌ ERRADO: "São 54m² privativos"
   - ✅ CERTO: "Pelo que temos aqui, são aproximadamente 54m², mas o corretor pode confirmar o valor exato"

3. **Distâncias e localização**: Use termos genéricos.
   - ❌ ERRADO: "Fica a 500m do shopping"
   - ✅ CERTO: "Fica bem próximo ao shopping, na região da Vila Rosa"

4. **Se não souber uma informação**: Seja honesto!
   - ✅ "Essa informação específica eu não tenho aqui, mas posso verificar com nosso time"
   - ✅ "O corretor vai poder te passar detalhes mais precisos sobre isso"

5. **Foco na qualificação**: Seu trabalho é QUALIFICAR o lead, não vender o imóvel.
   - Use o conhecimento para criar rapport e mostrar que conhece o empreendimento
   - Mas não entre em detalhes técnicos que podem estar desatualizados
`;
    }

    return `Você é ${nome}, SDR (Sales Development Representative) da ${tenantNome || 'imobiliária'}.

🎯 OBJETIVO
Qualificar leads imobiliários via WhatsApp de forma natural, conversacional e amigável.

👤 SUA IDENTIDADE
${expertiseBairros}
${expertiseTipos}

🗣️ TOM DE VOZ
${instrucoesTom}
${instrucoesEmoji}

📋 SCRIPTS
- Saudação: "${scripts.saudacao}"
- Despedida: "${scripts.despedida}"

${instrucoesDadosEmpreendimento}

📋 PROCESSO DE QUALIFICAÇÃO

1. **Primeiro Contato** (se for a primeira mensagem)
   - Cumprimentar de forma amigável e profissional
   - Se apresentar brevemente
   - Confirmar que está falando com o proprietário

2. **Descobrir Interesse**
   - Perguntar se tem interesse em VENDER ou ALUGAR o imóvel
   - Se não tiver interesse, respeitar e oferecer contato futuro
   - Se tiver interesse, avançar para qualificação

3. **Qualificar (Descubra com naturalidade)**
   
   Você DEVE fazer estas perguntas e ESPERAR as respostas:
   
   - **Interesse**: "Você tem interesse em vender ou alugar?" → ESPERE RESPOSTA
   - **Timeline**: "Para quando você está pensando?" → ESPERE RESPOSTA  
   - **Orçamento**: "Tem uma faixa de valor em mente?" → ESPERE RESPOSTA
   - **Motivação**: "Qual o motivo?" (opcional mas bom ter)
   - **Estado**: "O imóvel está ocupado ou vazio?" (opcional)
   
   ⚠️ **IMPORTANTE**: Você NUNCA deve chamar a ferramenta qualificar_lead SEM ter as respostas para:
   - Interesse (VENDER/ALUGAR)
   - Timeline (quando)
   - Temperatura calculada (FRIO/MORNO/QUENTE)

4. **Classificar e Agir**
   
   **SÓ DEPOIS de coletar as informações**, use as ferramentas:
   
   - Se timeline ≤ 3 meses + motivação urgente:
     → USE "qualificar_lead" com temperatura="QUENTE" + todos dados coletados
     → USE "solicitar_humano" com urgencia="ALTA"
   
   - Se interesse genuíno mas sem urgência:
     → USE "qualificar_lead" com temperatura="MORNO" + todos dados coletados
   
   - Se sem interesse ou timeline muito longo:
     → USE "qualificar_lead" com temperatura="FRIO"

⚠️ REGRAS IMPORTANTES

**NUNCA FAÇA:**
- ❌ Prometer valores específicos de venda
- ❌ Negociar comissões ou taxas
- ❌ Dar prazos garantidos de venda
- ❌ Fazer avaliações de mercado (diga que o corretor fará)
- ❌ Discutir documentação complexa
- ❌ Ser insistente se o lead não tiver interesse

**SEMPRE FAÇA:**
- ✅ Respeite se o lead não quiser vender/alugar
- ✅ Se o lead pedir para falar com corretor: USE "solicitar_humano"
- ✅ Se o lead perguntar sobre o imóvel: USE "buscar_imovel"
- ✅ Quando tiver info suficiente: USE "qualificar_lead"
- ✅ Seja educado e profissional sempre

🔄 QUANDO TRANSFERIR PARA HUMANO

Use "solicitar_humano" quando:
- Lead está QUENTE (timeline curto + urgência)
- Lead solicita explicitamente falar com corretor
- Lead pergunta sobre valores específicos/documentação complexa
- Lead demonstra frustração ou insatisfação

📝 DICAS

- Faça UMA pergunta por vez
- Aguarde a resposta antes de avançar
- Seja paciente e empático
- Adapte o tom ao do lead (se formal, seja formal; se casual, seja casual)
- Lembre-se: você está ajudando, não empurrando venda

Boa qualificação! 🚀`;
  }
  
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
   * Processa uma mensagem do lead e retorna a resposta do SDR
   * 
   * @param mensagens - Histórico de mensagens (formato OpenAI)
   * @param leadId - ID do lead no banco de dados
   * @param config - Configuração do agente (opcional, usa padrão se não fornecido)
   * @param contextoRAG - Contexto do empreendimento/campanha (opcional)
   * @returns Resposta do SDR para enviar ao lead
   */
  async processar(
    mensagens: Array<{role: string, content: string}>,
    leadId: string,
    config: ConfiguracaoAgente = configPadrao,
    contextoRAG?: string
  ): Promise<string> {
    try {
      console.log(`[SDR Worker] Processando mensagens para lead ${leadId}`);
      console.log(`[SDR Worker] Usando config: ${config.nome} (${config.personalidade.tom})`);
      
      // Gerar system prompt personalizado
      const systemPrompt = this.gerarSystemPrompt(config, contextoRAG);
      
      // Preparar mensagens com system prompt
      const mensagensCompletas: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { 
          role: 'system', 
          content: systemPrompt + `\n\nLead ID atual: ${leadId}`
        },
        ...mensagens as any[]
      ];
      
      // Preparar tools em formato OpenAI
      const tools: OpenAI.Chat.ChatCompletionTool[] = [
        {
          type: 'function',
          function: {
            name: qualificarLeadTool.name,
            description: qualificarLeadTool.description,
            parameters: (qualificarLeadTool.parameters as any).schema
          }
        },
        {
          type: 'function',
          function: {
            name: solicitarHumanoTool.name,
            description: solicitarHumanoTool.description,
            parameters: (solicitarHumanoTool.parameters as any).schema
          }
        },
        {
          type: 'function',
          function: {
            name: buscarImovelTool.name,
            description: buscarImovelTool.description,
            parameters: (buscarImovelTool.parameters as any).schema
          }
        }
      ];
      
      // Chamar OpenAI com function calling
      let resposta = await this.getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: mensagensCompletas,
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 300
      });
      
      // Loop para executar function calls se houver
      const maxIteracoes = 5; // Evitar loops infinitos
      let iteracoes = 0;
      
      while (resposta.choices[0].message.tool_calls && iteracoes < maxIteracoes) {
        const toolCalls = resposta.choices[0].message.tool_calls;
        
        // Adicionar mensagem do assistente
        mensagensCompletas.push(resposta.choices[0].message as any);
        
        // Executar cada function call
        for (const toolCall of toolCalls) {
          // Type assertion para o tipo correto
          const call = toolCall as any;
          const functionName = call.function.name;
          const functionArgs = JSON.parse(call.function.arguments);
          
          console.log(`[SDR Worker] Executando tool: ${functionName}`, functionArgs);
          
          let resultado: any;
          
          // Adicionar leadId aos argumentos se não estiver presente
          if (!functionArgs.leadId) {
            functionArgs.leadId = leadId;
          }
          
          // Executar a tool apropriada
          if (functionName === 'qualificar_lead') {
            resultado = await qualificarLeadTool.execute(functionArgs);
          } else if (functionName === 'solicitar_humano') {
            resultado = await solicitarHumanoTool.execute(functionArgs);
          } else if (functionName === 'buscar_imovel') {
            resultado = await buscarImovelTool.execute(functionArgs);
          } else {
            resultado = { error: 'Função desconhecida' };
          }
          
          // Adicionar resultado da tool
          mensagensCompletas.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(resultado)
          } as any);
        }
        
        // Chamar OpenAI novamente com os resultados
        resposta = await this.getClient().chat.completions.create({
          model: 'gpt-4o-mini',
          messages: mensagensCompletas,
          tools: tools,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 300
        });
        
        iteracoes++;
      }
      
      // Extrair resposta final
      const respostaFinal = resposta.choices[0].message.content || 'Desculpe, não entendi. Pode reformular?';
      
      console.log(`[SDR Worker] Resposta gerada: ${respostaFinal.substring(0, 100)}...`);
      
      return respostaFinal;
      
    } catch (error) {
      console.error('[SDR Worker] Erro ao processar:', error);
      
      // Resposta de fallback amigável
      return 'Desculpe, tive um problema técnico. Pode repetir sua mensagem? 😊';
    }
  }
  
  /**
   * Verifica status do agente (para debug/monitoring)
   */
  getInfo(): { name: string; model: string } {
    return {
      name: 'SDR_Qualificador',
      model: 'gpt-4o-mini'
    };
  }
}

// Exportar instância única (singleton)
export const sdrWorker = new SDRWorker();
