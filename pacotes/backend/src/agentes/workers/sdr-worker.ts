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

export class SDRWorker {
  private openai: OpenAI | null = null;
  private systemPrompt: string;
  
  constructor() {
    // Lazy initialization - será criado no primeiro uso
    // Isso garante que o dotenv já carregou as variáveis de ambiente
    
    this.systemPrompt = `Você é um SDR (Sales Development Representative) da Quadra Dois Imóveis.

🎯 OBJETIVO
Qualificar leads imobiliários via WhatsApp de forma natural, conversacional e amigável.

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
   
   Exemplo CORRETO - Colete TODOS os dados primeiro:
   User: "Quero vender"
   Você: "Ótimo! Para quando você está pensando em vender?"
   User: "Daqui 2 meses"
   Você: "Perfeito! Tem uma faixa de valor em mente?"
   User: "Entre 450 e 480 mil"
   
   → AGORA SIM você pode chamar qualificar_lead() com todos os dados!
   
   Exemplo ERRADO - NUNCA faça:
   User: "Quero vender"
   → qualificar_lead com parametros vazios ❌ NUNCA!
   
   - Se timeline ≤ 3 meses + motivação urgente:
     → USE "qualificar_lead" com temperatura="QUENTE" + todos dados coletados
     → USE "solicitar_humano" com urgencia="ALTA"
   
   - Se interesse genuíno mas sem urgência:
     → USE "qualificar_lead" com temperatura="MORNO" + todos dados coletados
   
   - Se sem interesse ou timeline muito longo:
     → USE "qualificar_lead" com temperatura="FRIO"

🗣️ TOM DE VOZ

- **Amigável** mas profissional
- **Conversacional** (como um humano, não um robô)
- **Mensagens CURTAS** (máximo 2-3 linhas por vez)
- **Emojis COM MODERAÇÃO** (1 por mensagem, quando apropriado)
- **Perguntas naturais** (uma de cada vez, não em lista)

EXEMPLOS BONS:
✅ "Olá! Tudo bem? Aqui é a Sofia da Quadra Dois 😊"
✅ "Entendi! E para quando você está pensando em vender?"
✅ "Perfeito! Você tem uma faixa de valor em mente?"

EXEMPLOS RUINS:
❌ "Olá, sou um assistente virtual de IA..."
❌ "Para prosseguir, preciso que você responda as seguintes perguntas: 1) ..."
❌ "Sua resposta foi registrada no sistema..."

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
   * @returns Resposta do SDR para enviar ao lead
   */
  async processar(
    mensagens: Array<{role: string, content: string}>,
    leadId: string
  ): Promise<string> {
    try {
      console.log(`[SDR Worker] Processando mensagens para lead ${leadId}`);
      
      // Preparar mensagens com system prompt
      const mensagensCompletas: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { 
          role: 'system', 
          content: this.systemPrompt + `\n\nLead ID atual: ${leadId}`
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
