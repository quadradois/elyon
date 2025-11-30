import OpenAI from 'openai';
import { prisma } from '../../servidor';
import { ConfiguracaoAgente, configPadrao } from './sdr-worker';

/**
 * DOCUMENTOS WORKER
 * 
 * Agente especializado em coleta e validação de documentos imobiliários.
 * 
 * Responsabilidades:
 * - Solicitar documentos necessários para captação/venda
 * - Validar documentos recebidos
 * - Orientar sobre documentação pendente
 * - Notificar corretor quando documentação completa
 */

// Ferramentas do worker de documentos
const solicitarDocumentoTool = {
  name: 'solicitar_documento',
  description: 'Solicita um documento específico ao cliente. Use quando precisar de um documento para dar continuidade ao processo.',
  parameters: {
    type: 'object',
    properties: {
      tipoDocumento: {
        type: 'string',
        enum: ['RG', 'CPF', 'CNH', 'COMPROVANTE_RESIDENCIA', 'MATRICULA_IMOVEL', 'IPTU', 'CERTIDAO_NEGATIVA', 'PROCURACAO', 'CONTRATO_SOCIAL', 'OUTRO'],
        description: 'Tipo do documento solicitado'
      },
      descricao: {
        type: 'string',
        description: 'Descrição adicional ou instruções sobre o documento'
      },
      obrigatorio: {
        type: 'boolean',
        description: 'Se o documento é obrigatório para prosseguir'
      },
      prazo: {
        type: 'string',
        description: 'Prazo sugerido para envio (ex: "até amanhã", "em 3 dias")'
      }
    },
    required: ['tipoDocumento', 'obrigatorio']
  }
};

const registrarDocumentoTool = {
  name: 'registrar_documento',
  description: 'Registra que um documento foi recebido do cliente. Use quando o cliente enviar uma foto ou arquivo de documento.',
  parameters: {
    type: 'object',
    properties: {
      tipoDocumento: {
        type: 'string',
        enum: ['RG', 'CPF', 'CNH', 'COMPROVANTE_RESIDENCIA', 'MATRICULA_IMOVEL', 'IPTU', 'CERTIDAO_NEGATIVA', 'PROCURACAO', 'CONTRATO_SOCIAL', 'OUTRO'],
        description: 'Tipo do documento recebido'
      },
      status: {
        type: 'string',
        enum: ['RECEBIDO', 'PENDENTE_VALIDACAO', 'APROVADO', 'REJEITADO'],
        description: 'Status do documento'
      },
      observacao: {
        type: 'string',
        description: 'Observações sobre o documento (ex: "foto legível", "precisa de nova foto")'
      }
    },
    required: ['tipoDocumento', 'status']
  }
};

const verificarPendenciasTool = {
  name: 'verificar_pendencias',
  description: 'Verifica quais documentos ainda estão pendentes para o lead. Use para informar o cliente sobre o que falta.',
  parameters: {
    type: 'object',
    properties: {
      leadId: {
        type: 'string',
        description: 'ID do lead para verificar pendências'
      }
    },
    required: ['leadId']
  }
};

const notificarCorretorTool = {
  name: 'notificar_corretor',
  description: 'Notifica o corretor sobre o status da documentação. Use quando a documentação estiver completa ou houver problema.',
  parameters: {
    type: 'object',
    properties: {
      motivo: {
        type: 'string',
        enum: ['DOCUMENTACAO_COMPLETA', 'DOCUMENTO_INVALIDO', 'CLIENTE_COM_DUVIDA', 'URGENTE'],
        description: 'Motivo da notificação'
      },
      mensagem: {
        type: 'string',
        description: 'Mensagem adicional para o corretor'
      }
    },
    required: ['motivo']
  }
};

// Lista de documentos por tipo de operação
const documentosPorOperacao = {
  VENDA: {
    proprietario: [
      { tipo: 'RG', nome: 'RG ou CNH', obrigatorio: true },
      { tipo: 'CPF', nome: 'CPF', obrigatorio: true },
      { tipo: 'COMPROVANTE_RESIDENCIA', nome: 'Comprovante de Residência', obrigatorio: true },
      { tipo: 'MATRICULA_IMOVEL', nome: 'Matrícula do Imóvel', obrigatorio: true },
      { tipo: 'IPTU', nome: 'IPTU (último ano)', obrigatorio: true },
      { tipo: 'CERTIDAO_NEGATIVA', nome: 'Certidões Negativas', obrigatorio: false },
    ]
  },
  LOCACAO: {
    proprietario: [
      { tipo: 'RG', nome: 'RG ou CNH', obrigatorio: true },
      { tipo: 'CPF', nome: 'CPF', obrigatorio: true },
      { tipo: 'MATRICULA_IMOVEL', nome: 'Matrícula do Imóvel', obrigatorio: true },
      { tipo: 'IPTU', nome: 'IPTU', obrigatorio: true },
    ],
    locatario: [
      { tipo: 'RG', nome: 'RG ou CNH', obrigatorio: true },
      { tipo: 'CPF', nome: 'CPF', obrigatorio: true },
      { tipo: 'COMPROVANTE_RESIDENCIA', nome: 'Comprovante de Residência', obrigatorio: true },
    ]
  }
};

export class DocumentosWorker {
  private openai: OpenAI | null = null;
  
  constructor() {
    // Lazy initialization
  }
  
  private getClient(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }
  
  /**
   * Gera o system prompt para o worker de documentos
   */
  private gerarSystemPrompt(config: ConfiguracaoAgente, contexto?: { tipoOperacao?: string; documentosPendentes?: string[] }): string {
    const { nome, personalidade, tenantNome } = config;
    
    let instrucoesTom = '';
    switch (personalidade.tom) {
      case 'formal':
        instrucoesTom = 'Use linguagem formal e profissional. Seja direto e objetivo.';
        break;
      case 'entusiasta':
        instrucoesTom = 'Seja animado e positivo. Transmita que está tudo caminhando bem.';
        break;
      default:
        instrucoesTom = 'Seja amigável e acolhedor. Demonstre paciência.';
    }
    
    const instrucaoEmoji = personalidade.usarEmojis 
      ? 'Use emojis com moderação (📄, ✅, ⏳).'
      : 'Não use emojis.';

    return `Você é ${nome}, especialista em documentação imobiliária da ${tenantNome || 'imobiliária'}.

🎯 OBJETIVO
Auxiliar o cliente na coleta e envio de documentos necessários para a transação imobiliária.

🗣️ TOM DE VOZ
${instrucoesTom}
${instrucaoEmoji}

📋 DOCUMENTOS QUE VOCÊ TRABALHA
- RG ou CNH (documento com foto)
- CPF
- Comprovante de Residência (últimos 3 meses)
- Matrícula do Imóvel (atualizada)
- IPTU (comprovante de pagamento ou guia)
- Certidões Negativas (civil, criminal, trabalhista)
- Procuração (se representante)
- Contrato Social (se empresa)

${contexto?.tipoOperacao ? `
📌 OPERAÇÃO ATUAL: ${contexto.tipoOperacao}
` : ''}

${contexto?.documentosPendentes?.length ? `
⏳ DOCUMENTOS PENDENTES:
${contexto.documentosPendentes.map(d => `- ${d}`).join('\n')}
` : ''}

📋 PROCESSO

1. **Identificar o que foi enviado**
   - Se o cliente enviou uma IMAGEM: pergunte que documento é
   - Se o cliente disse que vai enviar: aguarde e confirme recebimento

2. **Validar visualmente**
   - Documento legível? 
   - Foto de boa qualidade?
   - Data válida?
   → Se OK: USE "registrar_documento" com status RECEBIDO
   → Se problema: explique e peça nova foto

3. **Orientar sobre pendências**
   - USE "verificar_pendencias" para ver o que falta
   - Liste os documentos pendentes de forma clara
   - Dê prazo realista

4. **Finalizar quando completo**
   - Quando todos os documentos estiverem OK
   → USE "notificar_corretor" com motivo DOCUMENTACAO_COMPLETA

⚠️ REGRAS IMPORTANTES

**NUNCA:**
- ❌ Aceite documentos claramente ilegíveis
- ❌ Prossiga sem os documentos obrigatórios
- ❌ Dê informações jurídicas ou fiscais complexas
- ❌ Prometa prazos de aprovação

**SEMPRE:**
- ✅ Confirme recebimento de cada documento
- ✅ Seja paciente com dúvidas
- ✅ Se cliente não sabe onde conseguir: oriente
- ✅ Transferir para corretor se: dúvida complexa, cliente frustrado

💡 DICAS ÚTEIS PARA O CLIENTE

- Matrícula: obtida no Cartório de Registro de Imóveis
- IPTU: site da prefeitura ou Secretaria de Fazenda
- Certidões: Fórum local ou sites oficiais
- RG/CPF: foto frente e verso, sem reflexo

Lembre-se: você está facilitando um processo burocrático. Seja paciente! 📄`;
  }

  /**
   * Executa uma ferramenta do worker
   */
  private async executarFerramenta(nome: string, args: any, leadId: string): Promise<any> {
    console.log(`[Documentos Worker] Executando ferramenta: ${nome}`, args);
    
    switch (nome) {
      case 'solicitar_documento':
        return {
          sucesso: true,
          mensagem: `Documento ${args.tipoDocumento} solicitado ao cliente`,
          tipoDocumento: args.tipoDocumento,
          obrigatorio: args.obrigatorio,
          prazo: args.prazo
        };
        
      case 'registrar_documento':
        // Aqui poderia salvar no banco
        return {
          sucesso: true,
          mensagem: `Documento ${args.tipoDocumento} registrado com status ${args.status}`,
          tipoDocumento: args.tipoDocumento,
          status: args.status
        };
        
      case 'verificar_pendencias':
        // Aqui buscaria do banco os documentos pendentes
        // Por enquanto retorna mock
        return {
          sucesso: true,
          pendentes: ['MATRICULA_IMOVEL', 'IPTU'],
          completos: ['RG', 'CPF', 'COMPROVANTE_RESIDENCIA'],
          percentualCompleto: 60
        };
        
      case 'notificar_corretor':
        console.log(`[Documentos Worker] 📢 Notificação para corretor: ${args.motivo}`);
        return {
          sucesso: true,
          mensagem: 'Corretor notificado com sucesso',
          motivo: args.motivo
        };
        
      default:
        return { erro: 'Ferramenta não reconhecida' };
    }
  }

  /**
   * Processa mensagem do cliente sobre documentos
   */
  async processar(
    mensagens: Array<{role: string, content: string}>,
    leadId: string,
    config: ConfiguracaoAgente = configPadrao,
    contexto?: { tipoOperacao?: string; documentosPendentes?: string[] }
  ): Promise<string> {
    try {
      console.log(`[Documentos Worker] Processando para lead ${leadId}`);
      
      const systemPrompt = this.gerarSystemPrompt(config, contexto);
      
      const mensagensCompletas: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...mensagens as any[]
      ];
      
      const tools: OpenAI.Chat.ChatCompletionTool[] = [
        { type: 'function', function: { name: solicitarDocumentoTool.name, description: solicitarDocumentoTool.description, parameters: solicitarDocumentoTool.parameters as any } },
        { type: 'function', function: { name: registrarDocumentoTool.name, description: registrarDocumentoTool.description, parameters: registrarDocumentoTool.parameters as any } },
        { type: 'function', function: { name: verificarPendenciasTool.name, description: verificarPendenciasTool.description, parameters: verificarPendenciasTool.parameters as any } },
        { type: 'function', function: { name: notificarCorretorTool.name, description: notificarCorretorTool.description, parameters: notificarCorretorTool.parameters as any } },
      ];
      
      let resposta = await this.getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: mensagensCompletas,
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 400
      });
      
      // Loop para executar function calls
      const maxIteracoes = 5;
      let iteracoes = 0;
      
      while (resposta.choices[0].message.tool_calls && iteracoes < maxIteracoes) {
        const toolCalls = resposta.choices[0].message.tool_calls;
        
        mensagensCompletas.push(resposta.choices[0].message as any);
        
        for (const toolCall of toolCalls) {
          const call = toolCall as any;
          const functionName = call.function.name;
          const functionArgs = JSON.parse(call.function.arguments);
          
          const resultado = await this.executarFerramenta(functionName, functionArgs, leadId);
          
          mensagensCompletas.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(resultado)
          } as any);
        }
        
        resposta = await this.getClient().chat.completions.create({
          model: 'gpt-4o-mini',
          messages: mensagensCompletas,
          tools: tools,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 400
        });
        
        iteracoes++;
      }
      
      const textoResposta = resposta.choices[0].message.content || 
        'Desculpe, tive um problema ao processar sua mensagem. Pode repetir?';
      
      console.log(`[Documentos Worker] Resposta: "${textoResposta.substring(0, 80)}..."`);
      
      return textoResposta;
      
    } catch (error) {
      console.error('[Documentos Worker] Erro:', error);
      return 'Desculpe, estou com dificuldades técnicas. Um corretor entrará em contato em breve.';
    }
  }
}

// Singleton
export const documentosWorker = new DocumentosWorker();
