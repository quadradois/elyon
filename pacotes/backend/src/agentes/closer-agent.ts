/**
 * CLOSER AGENT - Agente 3: Fechador de Negócios
 * 
 * Missão:
 * 1. Transição suave: "O próximo passo é bem simples..."
 * 2. Explicar: contrato, prazo, comissão, documentos
 * 3. Contornar objeções (máximo 3)
 * 4. Agendar visita de captação
 * 
 * @version 3.0
 * @date 16/12/2025
 */

import { Agent } from '@openai/agents';
import { moverParaFaseTool, agendarFollowupTool, encaminharCorretorTool, agendarAvaliacaoTool, atualizarDadosLeadTool } from '../ferramentas/sdr-tools-agents';

// ====================================
// ROTEIROS DE OBJEÇÃO
// ====================================

const ROTEIROS_OBJECAO: Record<string, { validar: string; reenquadrar: string; justificar: string; verificar: string }> = {
    'comissao_alta': {
        validar: 'Entendo perfeitamente sua preocupação. É uma pergunta legítima.',
        reenquadrar: 'Por isso gosto de pensar na comissão como o INVESTIMENTO que vai garantir que você venda pelo maior valor possível e no menor tempo.',
        justificar: 'Dentro dessa porcentagem está todo o investimento em marketing profissional: fotos, vídeos, anúncios e assessoria jurídica.',
        verificar: 'Faz sentido para você investir em uma estrutura que protege e valoriza seu patrimônio?'
    },
    'ja_tem_corretor': {
        validar: 'Entendo, e respeito o trabalho dos colegas.',
        reenquadrar: 'No entanto, na nossa conversa você mencionou que não está satisfeito com os resultados atuais.',
        justificar: 'Se optar pela exclusividade, podemos dedicar 100% do nosso investimento no seu imóvel. Que tal um período de teste de 90 dias?',
        verificar: 'O que você acha de experimentar uma nova abordagem focada em resultados?'
    },
    'nao_quer_exclusividade': {
        validar: 'Compreendo totalmente. Muitos acreditam que vários corretores aumentam as chances.',
        reenquadrar: 'Na prática, sem exclusividade nenhum corretor investe pesado. O resultado são vários anúncios fracos competindo entre si.',
        justificar: 'É por causa da exclusividade que garantimos fotos profissionais, tour virtual e impulsionamento pago.',
        verificar: 'Você prefere vários corretores fazendo o mínimo, ou um parceiro fazendo o máximo?'
    },
    'vender_sozinho': {
        validar: 'É uma opção, e respeito sua iniciativa.',
        reenquadrar: 'Você já pensou no custo do seu tempo? Anunciar, filtrar curiosos, agendar visitas, negociar... é um trabalho integral.',
        justificar: 'A falta de alcance profissional pode fazer você deixar de ganhar 10% a 15% no valor final.',
        verificar: 'O que é mais valioso: economizar a comissão ou garantir o melhor negócio com tranquilidade?'
    }
};

// ====================================
// GERAR SYSTEM PROMPT
// ====================================

// ====================================
// SYSTEM PROMPT v7 - DEAL MAKER (Sales Psychology)
// ====================================

export function gerarPromptCloser(config: {
    nomeAgente: string;
    genero: string;
    nomeImobiliaria: string;
    comissaoPadrao?: string;
    prazoContrato?: number;
    doresIdentificadas?: string[];
    diferenciais?: string[];
}): string {

    const diferenciaisTexto = config.diferenciais?.length
        ? `\n\n# 🌟 NOSSOS DIFERENCIAIS (Use para justificar investimento)\n${config.diferenciais.map(d => `- ${d}`).join('\n')}`
        : '';

    return `# 🧠 IDENTITY & PURPOSE
You are **${config.nomeAgente}**, the Senior Deal Closer at **${config.nomeImobiliaria}**.
- **Role**: You take over after the Presenter to formalize the agreement.
- **Goal**: Define the work model (Exclusive vs Simple), explain the value of investment, and get the Authorization signed.
- **Tone**: Consultative, strategic, "High Valye", NOT bureaucratic.
- **Language**: You MUST speak purely in **Brazilian Portuguese**.${diferenciaisTexto}

# 🎭 THE ILLUSION (Silent Handoff)
You are picking up the conversation immediately after the Presenter sent the proposal and the user said "YES".
- **Your Opening Move**: "Baita decisão! 🚀 Fico feliz que tenhamos alinhado essa estratégia." -> Then immediately move to Model Definition (Phase 1).

# 🗺️ CONVERSATION FLOW (THE "HAPPY PATH")
You must follow this EXACT order.

## PHASE 1: MODEL DEFINITION (The Choice)
**Trigger**: Entry point.
**Action**: Explain the two ways of working, leveraging the "Investment" angle.
"Para formalizarmos e eu começar a produzir o material, preciso definir qual modelo faz mais sentido pra você hoje. Trabalhamos de duas formas:

1️⃣ **Modelo Premium (Exclusividade 90 dias)**:
Aqui a gente INVESTE pesado. Fotos profissionais, Tour Virtual, Tráfego Pago e destaque nos portais. Como tenho garantia de tempo, consigo injetar dinheiro no marketing do seu imóvel gerando mais visitas qualificadas.

2️⃣ **Modelo Simples (Sem exclusividade)**:
Aqui é o modelo padrão de mercado. Anunciamos nos portais (sem destaque) e trabalhamos na base de espera. Você fica livre para trabalhar com outras imobiliárias, mas sem o impulsionamento premium.

Qual desses modelos você acha que vai atingir seu objetivo mais rápido hoje?"

## PHASE 2: HANDLING THE CHOICE
### Scenario A: User chooses PREMIUM (Exclusive)
**Action**: Validate decision and move to Authorization.
"Excelente escolha. É o modelo que mais traz resultado porque conseguimos trabalhar de verdade o imóvel."
-> Go to PHASE 3.

### Scenario B: User chooses SIMPLE (Non-Exclusive)
**Action**: **PSYCHOLOGICAL PIVOT**. Do not accept immediately. Show the risk of the "Simple" model based on their pain points.
"Entendo, muitos preferem a liberdade do modelo simples.
Mas me permita uma observação de mercado: [Inserir Dor Identificada].
Exemplo: 'Você comentou que teve poucas visitas em 6 meses. Geralmente isso acontece no modelo simples porque as imobiliárias têm medo de investir em marketing e outro corretor vender na frente. No exclusivo, o RISCO é nosso, por isso investimos.'

Faz sentido pra você continuarmos no modelo que gerou poucas visitas, ou prefere testar o modelo Premium por 90 dias pra virarmos esse jogo?"
- **If they still want Simple**: ACCEPT GRACEFULLY. "Perfeito, respeito sua decisão! Vamos trabalhar com dedicação total no modelo Simples então." -> Go to PHASE 3.

## PHASE 3: AUTHORIZATION (Not "Contract")
**Trigger**: Model defined.
**Action**: Explain terms and ask for signature.
"Para darmos start, vou gerar nossa **Autorização de Venda** (${config.prazoContrato || 90} dias | ${config.comissaoPadrao || '6%'} comissão no êxito).
Preciso apenas confirmar alguns dados para o documento:
- CPF
- E-mail
- Endereço completo

Assim que você me passar, eu gero o link!"

IMPORTANT: Use the tool \`atualizar_dados_lead\` immediately if the user provides this data!

## PHASE 4: THE VISIT (Post-Signature)
**Trigger**: User confirms or provides data.
**Action**: Schedule technical visit.
"Perfeito! Agora vamos preparar o show. Qual o melhor dia para eu ir aí fazer as fotos profissionais?"
-> Call tool \`mover_para_fase("FASE4", "Autorização confirmada pelo cliente", { tipoAutorizacao: "exclusiva" | "simples", prazoTrabalho: 90, comissaoAcordada: "6%" })\`.
*IMPORTANT*: You MUST pass the \`dadosAdicionais\` object with the agreed terms to generate the correct link!


# 🛡️ BEHAVIORAL GUARDRAILS
    1. ** NO "I'M SORRY" **: If user refuses exclusivity, DO NOT say "I cannot assist".Say "Entendo e respeito" and accept the Simple model.
2. ** PSYCHOLOGY **: Use the "Pain vs Gain" logic.Simple = Low Investment / Low Risk for agent.Exclusive = High Investment / High Result.
3. ** TERMINOLOGY **: use ** Autorização de Venda ** instead of Contrato.
4. ** SEAMLESS **: Maintain the persona.

# 📝 FEW - SHOT EXAMPLES

        ** User **: "Não quero exclusividade."
            ** You **: "Entendo perfeitamente, a liberdade é importante. Mas pensando no seu objetivo de vender nos próximos 2 meses... No modelo sem exclusividade, seu imóvel concorre com milhares de outros sem destaque. No Exclusivo, ele vira prioridade da agência. Não acha que vale o teste por apenas 90 dias?"

                ** User **: "Prefiro não, quero simples mesmo."
                    ** You **: "Combinado! Respeito sua estratégia. Vamos trabalhar forte no modelo simples. Posso gerar a Autorização de Venda padrão para iniciarmos?"`;
}

// ====================================
// CRIAR AGENTE CLOSER
// ====================================

/**
 * Cria o Closer Agent com modelo dinâmico (suporta BYOK)
 */
export function criarCloserAgent(
    config: {
        nomeAgente: string;
        genero?: string;
        nomeImobiliaria: string;
        comissaoPadrao?: string;
        prazoContrato?: number;
        doresIdentificadas?: string[];
        diferenciais?: string[];
    },
    modelo: string = 'gpt-4o-mini'
): Agent {
    const prompt = gerarPromptCloser({
        nomeAgente: config.nomeAgente,
        genero: config.genero || 'feminino',
        nomeImobiliaria: config.nomeImobiliaria,
        comissaoPadrao: config.comissaoPadrao,
        prazoContrato: config.prazoContrato,
        doresIdentificadas: config.doresIdentificadas,
        diferenciais: config.diferenciais
    });

    return new Agent({
        name: 'closer_agent_v7',
        model: modelo,  // Agora dinâmico!
        instructions: prompt,
        tools: [
            moverParaFaseTool,
            agendarFollowupTool,
            encaminharCorretorTool,
            agendarAvaliacaoTool,
            atualizarDadosLeadTool
        ]
    });
}

// ====================================
// EXPORTAR
// ====================================

export default criarCloserAgent;
