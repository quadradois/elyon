/**
 * SDR AGENT - OpenAI Agents SDK
 * 
 * Agente SDR (Sales Development Representative) usando o framework @openai/agents.
 * Substitui o sdr-worker.ts manual com uma implementação mais limpa e poderosa.
 * 
 * @version 1.0
 * @date 16/12/2025
 */

import { Agent, run } from '@openai/agents';
import {
    qualificarLeadTool,
    registrarOptoutTool,
    converterParaLeadTool,
    agendarAvaliacaoTool,
    agendarFollowupTool,
    buscarImovelTool,
    encaminharCorretorTool,
    todasToolsSDR
} from '../ferramentas/sdr-tools-agents';

// ====================================
// CONFIGURATION
// ====================================

export interface ConfiguracaoSdrAgent {
    nome: string;
    imobiliaria: string;
    empreendimento?: string;
    tom: 'formal' | 'amigavel' | 'entusiasta';
    usarEmojis: boolean;
    briefingEmpreendimento?: string;
}

const configPadrao: ConfiguracaoSdrAgent = {
    nome: 'Sofia',
    imobiliaria: 'Nossa Imobiliária',
    tom: 'amigavel',
    usarEmojis: true
};

// ====================================
// SYSTEM PROMPT GENERATOR
// ====================================

function gerarSystemPrompt(config: ConfiguracaoSdrAgent): string {
    const { nome, imobiliaria, empreendimento, tom, usarEmojis, briefingEmpreendimento } = config;

    // Tom de voz
    let instrucaoTom = '';
    switch (tom) {
        case 'formal':
            instrucaoTom = 'Use linguagem formal e profissional. Trate por "senhor(a)".';
            break;
        case 'entusiasta':
            instrucaoTom = 'Seja animado e positivo. Use energia na comunicação!';
            break;
        default:
            instrucaoTom = 'Seja natural e próximo. Crie conexão genuína.';
    }

    // Briefing do empreendimento
    let secaoBriefing = '';
    if (briefingEmpreendimento) {
        secaoBriefing = `
# 📚 CONHECIMENTO DO EMPREENDIMENTO

${briefingEmpreendimento}

⚠️ USE esses dados! NÃO pergunte coisas que você já sabe!
`;
    }

    return `
# 🎯 IDENTIDADE

Você é ${nome}, CLOSER DIGITAL da ${imobiliaria}.
Seu objetivo: FECHAR NEGÓCIOS (não apenas conversar).

${empreendimento ? `Você está trabalhando o empreendimento: **${empreendimento}**` : ''}

# 📋 CONTEXTO

Você enviou uma mensagem usando a "Técnica do Idoso Confuso":
- "Tenho uma família interessada no ${empreendimento || 'empreendimento'}"
- "Você conhece alguém vendendo?"

Agora você está recebendo as respostas. MANTENHA COERÊNCIA!

${secaoBriefing}

# 🔧 FERRAMENTAS - USE IMEDIATAMENTE!

| GATILHO | FERRAMENTA |
|---------|------------|
| "sim", "pode", "ok", "pode anunciar" | converter_para_lead |
| "dia 15", "às 14h", "pode ser amanhã" | agendar_avaliacao |
| "talvez depois", "mês que vem" | agendar_followup |
| "para", "spam", "não me ligue" | registrar_optout |

⚠️ REGRA DE OURO: Detectou gatilho? CHAME A FERRAMENTA PRIMEIRO!

# 📋 FLUXO DE CONVERSÃO

1️⃣ INTERPRETAR - Qualquer resposta = oportunidade
2️⃣ QUALIFICAR - Máximo 2-3 perguntas (andar? ocupado? valor?)
3️⃣ PROPOR - "Posso incluir na nossa carteira?"
4️⃣ FECHAR - Chamar ferramenta + confirmar

# 🛡️ OBJEÇÕES (respostas curtas!)

| OBJEÇÃO | RESPOSTA |
|---------|----------|
| "Já tenho imobiliária" | "Posso ampliar alcance! Se eu vender, você ganha." |
| "Vou pensar" | "O que te preocupa? Comissão, prazo?" |
| "Quanto vale?" | "Entre R$ X-Y. Posso avaliar grátis!" |
| "Não tenho tempo" | "Cuido de tudo! Você só assina." |

# ❌ RESTRIÇÕES

- NUNCA assuma autorização sem "sim/pode/ok" explícito
- NUNCA faça mais de 3 perguntas antes de propor
- NUNCA aceite "vou pensar" sem entender objeção
- NUNCA diga "base de dados" ou "prefeitura"
- Máximo 200 caracteres por mensagem
- ${usarEmojis ? 'Use emojis moderadamente (máx 2)' : 'NÃO use emojis'}

# 🎭 TOM DE VOZ

${instrucaoTom}

# 🎯 SUCESSO

✅ converter_para_lead ou agendar_avaliacao = SUCESSO
✅ agendar_followup = ACEITÁVEL
❌ Conversa sem ferramenta = INCOMPLETO

CADA CONVERSA DEVE TERMINAR COM UMA FERRAMENTA CHAMADA!
`;
}

// ====================================
// SDR AGENT
// ====================================

export function criarSdrAgent(config: ConfiguracaoSdrAgent = configPadrao): Agent {
    return new Agent({
        name: `SDR ${config.nome}`,
        model: 'gpt-4o-mini',
        instructions: gerarSystemPrompt(config),
        tools: todasToolsSDR
    });
}

// ====================================
// PROCESSAR MENSAGEM
// ====================================

export interface ResultadoProcessamento {
    resposta: string;
    toolsChamadas: string[];
    sucesso: boolean;
}

/**
 * Processa uma mensagem do lead usando o SDK @openai/agents
 * 
 * @param mensagem - Mensagem do lead
 * @param contatoId - ID do contato no banco
 * @param config - Configuração do agente
 * @param historicoMensagens - Histórico de mensagens anteriores (opcional)
 */
export async function processarMensagemSDR(
    mensagem: string,
    contatoId: string,
    config: ConfiguracaoSdrAgent = configPadrao,
    historicoMensagens?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<ResultadoProcessamento> {
    try {
        console.log(`[SDR Agent] Processando mensagem para contato ${contatoId}`);

        // Criar agente com configuração
        const agent = criarSdrAgent(config);

        // Montar input com contexto
        let inputCompleto = mensagem;

        // Se tiver histórico, incluir como contexto
        if (historicoMensagens && historicoMensagens.length > 0) {
            const historicoFormatado = historicoMensagens
                .slice(-10) // Últimas 10 mensagens
                .map(m => `${m.role === 'user' ? 'PROPRIETÁRIO' : 'VOCÊ'}: ${m.content}`)
                .join('\n');

            inputCompleto = `HISTÓRICO DA CONVERSA:
${historicoFormatado}

NOVA MENSAGEM DO PROPRIETÁRIO:
${mensagem}

CONTEXTO:
- ID do contato: ${contatoId}

Responda à nova mensagem considerando o histórico.`;
        } else {
            inputCompleto = `NOVA MENSAGEM DO PROPRIETÁRIO:
${mensagem}

CONTEXTO:
- ID do contato: ${contatoId}

Esta é a primeira mensagem. Inicie a qualificação.`;
        }

        // Executar o agente
        const result = await run(agent, inputCompleto);

        // Extrair resposta
        const resposta = typeof result.finalOutput === 'string'
            ? result.finalOutput
            : JSON.stringify(result.finalOutput);

        // Identificar tools chamadas (simplificado - o SDK gerencia isso internamente)
        const toolsChamadas: string[] = [];

        console.log(`[SDR Agent] Resposta gerada: ${resposta.substring(0, 100)}...`);

        return {
            resposta,
            toolsChamadas,
            sucesso: true
        };

    } catch (error) {
        console.error('[SDR Agent] Erro:', error);

        return {
            resposta: 'Desculpe, tive um problema técnico. Um corretor entrará em contato em breve.',
            toolsChamadas: [],
            sucesso: false
        };
    }
}

// ====================================
// SINGLETON (compatibilidade)
// ====================================

class SdrAgentService {
    private config: ConfiguracaoSdrAgent = configPadrao;

    setConfig(config: Partial<ConfiguracaoSdrAgent>) {
        this.config = { ...this.config, ...config };
    }

    async processar(
        mensagens: Array<{ role: string; content: string }>,
        contatoId: string,
        config?: Partial<ConfiguracaoSdrAgent>,
        contextoRAG?: string
    ): Promise<string> {
        const finalConfig: ConfiguracaoSdrAgent = {
            ...this.config,
            ...config,
            briefingEmpreendimento: contextoRAG
        };

        // Pegar última mensagem do user
        const ultimaMensagem = mensagens
            .filter(m => m.role === 'user')
            .pop()?.content || '';

        // Converter histórico para formato correto
        const historico = mensagens.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
        }));

        const resultado = await processarMensagemSDR(
            ultimaMensagem,
            contatoId,
            finalConfig,
            historico.slice(0, -1) // Excluir a última (que é a mensagem atual)
        );

        return resultado.resposta;
    }

    getInfo() {
        return {
            name: 'SDR_Agent_OpenAI',
            model: 'gpt-4o-mini',
            framework: '@openai/agents'
        };
    }
}

export const sdrAgentService = new SdrAgentService();

// Export default para compatibilidade
export default sdrAgentService;
