/**
 * TEMPLATES DE PROSPECÇÃO ATIVA
 * 
 * Sistema de mensagens para abordagem fria usando a "Técnica do Idoso Confuso":
 * - Pedir ajuda ao invés de oferecer algo
 * - Storytelling para criar conexão
 * - Auto-seleção do lead (quem quer vender se identifica)
 * - Opt-out respeitoso em todas as mensagens
 * 
 * @version 1.0.0
 * @date 02/12/2025
 */

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface VariaveisTemplate {
  nome: string;           // Nome do contato
  agente: string;         // Nome do agente IA
  empreendimento: string; // Nome do empreendimento/condomínio
  bairro: string;         // Bairro do imóvel
  tipo?: string;          // Tipo do imóvel (apartamento, casa, etc)
  quartos?: string;       // Quantidade de quartos buscados
  andar?: string;         // Preferência de andar
}

export interface TemplateProspeccao {
  id: string;
  nome: string;
  descricao: string;
  tipo: 'PRIMEIRA_MENSAGEM' | 'FOLLOWUP_1' | 'FOLLOWUP_2' | 'RESPOSTA';
  mensagem: string;
  variaveis: string[];    // Lista de variáveis usadas
  storytelling: boolean;  // Se usa storytelling
}

export interface RespostaTemplate {
  gatilho: string[];      // Palavras/frases que ativam esta resposta
  resposta: string;
  acao?: 'QUALIFICAR' | 'OPTOUT' | 'INDICACAO' | 'ENCERRAR' | 'AGENDAR';
}

// ============================================
// TEMPLATES DE PRIMEIRA MENSAGEM
// ============================================

export const PRIMEIRA_MENSAGEM_STORYTELLING: TemplateProspeccao = {
  id: 'pm_storytelling_v1',
  nome: 'Storytelling - Família Buscando',
  descricao: 'Abordagem com história de uma família procurando imóvel',
  tipo: 'PRIMEIRA_MENSAGEM',
  storytelling: true,
  variaveis: ['nome', 'agente', 'empreendimento', 'bairro'],
  mensagem: `Oi {nome}! 😊

Deixa eu te contar rapidinho...

Estou ajudando uma família que quer muito morar no {empreendimento}. Eles adoraram a localização no {bairro}!

Mas tá difícil achar alguém vendendo por lá...

Você conhece algum vizinho que esteja pensando em vender? 🙏

Ah, me chamo {agente}, trabalho com imóveis aqui na região.

(Se você mesmo tiver interesse, me conta também! 😊)`
};

export const PRIMEIRA_MENSAGEM_DIRETA: TemplateProspeccao = {
  id: 'pm_direta_v1',
  nome: 'Direta - Cliente Interessado',
  descricao: 'Abordagem mais direta pedindo indicação',
  tipo: 'PRIMEIRA_MENSAGEM',
  storytelling: false,
  variaveis: ['nome', 'agente', 'empreendimento'],
  mensagem: `Oi {nome}! 😊

Você conhece alguém vendendo apartamento no {empreendimento}?

Tenho um cliente super interessado e não consigo achar nada disponível!

Se souber de alguém (ou você mesmo tiver interesse), me avisa? 🙏

Me chamo {agente}, trabalho com imóveis aqui na região.`
};

export const PRIMEIRA_MENSAGEM_INVESTIDOR: TemplateProspeccao = {
  id: 'pm_investidor_v1',
  nome: 'Storytelling - Investidor',
  descricao: 'Para empreendimentos com perfil de investimento',
  tipo: 'PRIMEIRA_MENSAGEM',
  storytelling: true,
  variaveis: ['nome', 'agente', 'empreendimento', 'bairro'],
  mensagem: `Oi {nome}! 😊

Estou com um investidor querendo comprar unidades no {empreendimento}. 

Ele gostou muito do potencial de valorização do {bairro} e quer fechar negócio rápido!

Você conhece alguém no prédio que esteja querendo vender?

Qualquer indicação ajuda muito! 🙏

Sou {agente}, trabalho com imóveis na região.`
};

export const PRIMEIRA_MENSAGEM_ESCASSEZ: TemplateProspeccao = {
  id: 'pm_escassez_v1',
  nome: 'Escassez - Alta Demanda',
  descricao: 'Destaca a dificuldade de encontrar imóveis',
  tipo: 'PRIMEIRA_MENSAGEM',
  storytelling: true,
  variaveis: ['nome', 'agente', 'empreendimento'],
  mensagem: `Oi {nome}! 🙏

Me ajuda? 

Tá super difícil encontrar apartamento à venda no {empreendimento}!

Tenho clientes na fila esperando e não aparece nada...

Você conhece alguém vendendo? (Ou se for você, melhor ainda! 😊)

Sou {agente}, trabalho com imóveis na região.`
};

// ============================================
// TEMPLATES DE FOLLOW-UP
// ============================================

export const FOLLOWUP_1: TemplateProspeccao = {
  id: 'fu1_v1',
  nome: 'Follow-up 24h',
  descricao: 'Enviado 24h após primeira mensagem sem resposta',
  tipo: 'FOLLOWUP_1',
  storytelling: false,
  variaveis: ['nome', 'empreendimento'],
  mensagem: `Oi {nome}! 😊

Só passando de novo sobre o {empreendimento}.

Conseguiu lembrar de alguém que esteja pensando em vender?

Agradeço qualquer dica! 🙏`
};

export const FOLLOWUP_2: TemplateProspeccao = {
  id: 'fu2_v1',
  nome: 'Follow-up Final 48h',
  descricao: 'Última tentativa, 48h após follow-up 1',
  tipo: 'FOLLOWUP_2',
  storytelling: false,
  variaveis: ['nome', 'empreendimento'],
  mensagem: `{nome}, última mensagem sobre isso! 😊

Se souber de alguém vendendo no {empreendimento}, me avisa.

Se não, sem problemas! Não vou mais incomodar.

Obrigado e boa semana! 🙏`
};

// ============================================
// TEMPLATES DE RESPOSTA
// ============================================

export const RESPOSTAS_PADRAO: RespostaTemplate[] = [
  // ⭐ CONFIRMAÇÕES - Lead disse SIM a algo proposto! (V2.0 - ASSERTIVO)
  {
    gatilho: ['pode ser', 'pode sim', 'ok', 'tá bom', 'ta bom', 'beleza', 'fechado', 'combinado', 'certo', 'perfeito', 'bora', 'vamos'],
    acao: 'AGENDAR',
    resposta: `Perfeito! Fechado então! 🎯

{nome}, deixa eu já garantir seu horário:
- Qual o melhor dia: amanhã ou depois de amanhã?
- Período: manhã (9h-12h) ou tarde (14h-17h)?

Confirmo o endereço completo (bloco/apto) e seu nome pra garantir a visita! �`
  },

  // POSITIVAS - Lead quer vender (V2.0 - ANCORAGEM DE VALOR)
  {
    gatilho: ['quero vender', 'eu quero', 'tenho interesse', 'estou vendendo', 'to vendendo', 'vendo sim', 'é meu', 'sou eu', 'vender o meu'],
    acao: 'QUALIFICAR',
    resposta: `Excelente, {nome}! 🎯 Tenho 3 famílias HOJE procurando no {empreendimento}.

Seu apartamento é de quantos quartos?

Só pra ter uma ideia, apartamentos de 2 quartos aqui estão saindo entre R$ 380-450 mil. O seu está nessa faixa ou você quer um valor diferente?

Assim já consigo encaixar com o perfil certo! 💰`
  },

  // ACEITE DE ANÚNCIO - Quer anunciar/divulgar (V2.0 - URGÊNCIA)
  {
    gatilho: ['pode anunciar', 'pode divulgar', 'vou mandar foto', 'mando as fotos', 'te mando', 'vou te mandar', 'quero anunciar'],
    acao: 'AGENDAR',
    resposta: `Perfeito, {nome}! Vamos turbinar seu anúncio! 🚀

Me manda:
1. Fotos do apartamento
2. Valor que você quer anunciar
3. Seu email pra autorização

Dica: apartamentos com fotos profissionais vendem 40% mais rápido. Posso agendar um fotógrafo grátis essa semana! Aceita? �`
  },

  // INDICAÇÃO - Conhece alguém (V2.0 - INCENTIVO)
  {
    gatilho: ['conheço', 'sei de', 'tem um vizinho', 'meu vizinho', 'apartamento do', 'fulano', 'conhece sim'],
    acao: 'INDICACAO',
    resposta: `Show, {nome}! Você é 10! 🙏

Me passa o contato dele que eu ligo hoje mesmo.

E olha: se fechar negócio, você ganha um bônus de indicação (R$ 1.000)! É minha forma de agradecer quem me ajuda! 💵`
  },

  // NEGATIVA EDUCADA - Não conhece (V2.0 - SEMENTE)
  {
    gatilho: ['não conheço', 'nao conheco', 'não sei', 'nao sei', 'não lembro', 'não tenho', 'desconheço'],
    acao: 'ENCERRAR',
    resposta: `Tranquilo, {nome}! Agradeço por responder! 🙏

Só uma última coisa: você já pensou em vender ou alugar seu apartamento? 

Se tiver interesse, posso fazer uma avaliação gratuita (sem compromisso). Muita gente fica surpresa com os valores atuais do {empreendimento}! �`
  },

  // OPT-OUT - Não quer mais contato (V2.0 - RESPEITO IMEDIATO)
  {
    gatilho: ['para', 'não mande', 'não quero', 'não me', 'bloquear', 'spam', 'sai', 'some', 'não incomoda', 'não perturba'],
    acao: 'OPTOUT',
    resposta: `Entendido, {nome}! Desculpa qualquer incômodo.

Não vou mais entrar em contato. Tenha um excelente dia! 🙏`
  },

  // CURIOSO SOBRE ORIGEM (V2.0 - TRANSPARÊNCIA + CONVERSÃO)
  {
    gatilho: ['como conseguiu', 'de onde', 'quem passou', 'meu número', 'meu contato', 'como sabe'],
    acao: undefined, // Continua conversa
    resposta: `Oi {nome}! Entendo a pergunta! 😊

Consegui por indicação de outros proprietários do {empreendimento}. Trabalho com imóveis na região há anos e sempre peço indicações.

Se preferir não receber mensagens, só avisar que tiro na hora! Sem problema nenhum. 🙏

Mas antes: você tem interesse em vender ou conhece alguém que queira?`
  },

  // CURIOSO SOBRE VALOR (V2.0 - ANCORAGEM + CALL TO ACTION)
  {
    gatilho: ['quanto', 'valor', 'preço', 'pagando', 'oferece', 'paga'],
    acao: 'QUALIFICAR',
    resposta: `Boa pergunta, {nome}!

Apartamentos de 2 quartos no {empreendimento} estão entre R$ 380-450 mil (depende de andar, estado, etc).

Posso fazer uma avaliação GRATUITA do seu em 5 minutos:
- Sem compromisso
- Só preciso de 3 fotos e infos básicas

Quer que eu faça agora? É só mandar as fotos! �💰`
  },

  // JÁ TEM IMOBILIÁRIA (V2.0 - REFRAME + OPORTUNIDADE)
  {
    gatilho: ['já tenho', 'outra imobiliária', 'exclusividade', 'com corretor', 'já anunciei'],
    acao: 'ENCERRAR',
    resposta: `Entendo, {nome}!

Mas olha: você sabia que 60% das vendas vêm de CORRETORES trabalhando juntos?

Posso divulgar seu imóvel na minha rede (100+ corretores) sem custo extra. Se eu trouxer o comprador, você ganha. Se não, não paga nada.

Aceita ampliar o alcance? �`
  },

  // TALVEZ / PENSANDO (V2.0 - DESCOMPLICA + URGÊNCIA SOFT)
  {
    gatilho: ['talvez', 'pensando', 'não sei se', 'vou pensar', 'ainda não', 'quem sabe'],
    acao: 'QUALIFICAR',
    resposta: `Te entendo, {nome}! Decisão importante mesmo! 

Deixa eu facilitar: que tal uma avaliação GRATUITA do seu apartamento?

Aí você sabe QUANTO vale e pode decidir com dados reais. Sem compromisso nenhum!

E olha: mercado tá aquecido AGORA. Semana passada vendi 2 no {empreendimento} acima da tabela!

Quer a avaliação? �💰`
  },

  // QUER ALUGAR (não vender) (V2.0 - OPORTUNIDADE + VENDA)
  {
    gatilho: ['alugar', 'locação', 'aluguel', 'inquilino'],
    acao: 'QUALIFICAR',
    resposta: `Ah, locação! Trabalho com isso também, {nome}! 😊

Apartamentos de 2 quartos no {empreendimento} estão alugando por R$ 2.200-2.800/mês.

Mas deixa eu te mostrar uma conta:
- Aluguel: R$ 2.500/mês = R$ 30k/ano
- Venda: R$ 420k investidos = R$ 42k/ano (10% ao ano)

Você já pensou que VENDENDO pode render MAIS que alugando? 🤔💰

Quer que eu te mostre as opções?`
  },

  // OBJEÇÃO: NÃO TENHO TEMPO (V2.0 - DESCOMPLICA)
  {
    gatilho: ['não tenho tempo', 'muito ocupado', 'corrido', 'atarefado', 'sem tempo'],
    acao: 'QUALIFICAR',
    resposta: `Entendo perfeitamente, {nome}! Quem não tá corrido, né? 😅

Por isso mesmo eu facilito TUDO:
- Avaliação: 5 minutos (só 3 fotos)
- Visitas: eu coordeno tudo
- Documentação: eu cuido

Você só ASSINA no final! Nada de dor de cabeça! 

Bora começar com a avaliação grátis? 5 minutos! ⏱️`
  },

  // OBJEÇÃO: VALOR MUITO ALTO (V2.0 - ANCORAGEM)
  {
    gatilho: ['muito caro', 'muito alto', 'acho caro', 'preço alto', 'valor alto'],
    acao: 'QUALIFICAR',
    resposta: `Entendo sua preocupação, {nome}!

Mas olha os números do {empreendimento}:
- Média ATUAL: R$ 420 mil
- Há 12 meses: R$ 380 mil (+10,5%)
- Previsão 12 meses: R$ 460 mil (+9,5%)

Ou seja: quanto mais espera, MAIS sobe! 📈

E tem mais: posso parcelar a entrada em até 6x. Fica só R$ 7 mil/mês!

Quer fazer as contas comigo? 💰`
  }
];

// ============================================
// FUNÇÃO PARA SUBSTITUIR VARIÁVEIS
// ============================================

export function substituirVariaveis(
  template: string, 
  variaveis: Partial<VariaveisTemplate>
): string {
  let resultado = template;
  
  Object.entries(variaveis).forEach(([chave, valor]) => {
    if (valor) {
      const regex = new RegExp(`\\{${chave}\\}`, 'g');
      resultado = resultado.replace(regex, valor);
    }
  });
  
  return resultado;
}

// ============================================
// FUNÇÃO PARA ENCONTRAR RESPOSTA APROPRIADA
// ============================================

export function encontrarRespostaPadrao(
  mensagemRecebida: string
): RespostaTemplate | null {
  const mensagemLower = mensagemRecebida.toLowerCase();
  
  for (const resposta of RESPOSTAS_PADRAO) {
    const encontrou = resposta.gatilho.some(gatilho => 
      mensagemLower.includes(gatilho.toLowerCase())
    );
    
    if (encontrou) {
      return resposta;
    }
  }
  
  return null;
}

// ============================================
// FUNÇÃO PARA GERAR PRIMEIRA MENSAGEM
// ============================================

export function gerarPrimeiraMensagem(
  variaveis: VariaveisTemplate,
  usarStorytelling: boolean = true
): string {
  const template = usarStorytelling 
    ? PRIMEIRA_MENSAGEM_STORYTELLING 
    : PRIMEIRA_MENSAGEM_DIRETA;
  
  return substituirVariaveis(template.mensagem, variaveis);
}

// ============================================
// FUNÇÃO PARA GERAR FOLLOW-UP
// ============================================

export function gerarFollowUp(
  variaveis: VariaveisTemplate,
  tentativa: number
): string {
  const template = tentativa === 1 ? FOLLOWUP_1 : FOLLOWUP_2;
  return substituirVariaveis(template.mensagem, variaveis);
}

// ============================================
// EXPORTAR TODOS OS TEMPLATES
// ============================================

export const TODOS_TEMPLATES_PRIMEIRA_MENSAGEM = [
  PRIMEIRA_MENSAGEM_STORYTELLING,
  PRIMEIRA_MENSAGEM_DIRETA,
  PRIMEIRA_MENSAGEM_INVESTIDOR,
  PRIMEIRA_MENSAGEM_ESCASSEZ
];

export const TODOS_TEMPLATES_FOLLOWUP = [
  FOLLOWUP_1,
  FOLLOWUP_2
];

// ============================================
// CONTEXTO PARA SDR WORKER (PROSPECÇÃO ATIVA)
// ============================================

export const CONTEXTO_PROSPECCAO_ATIVA = `
🎯 CONTEXTO CRÍTICO: PROSPECÇÃO ATIVA V2.0 - CLOSER DIGITAL

═══════════════════════════════════════════════════════════
🔥 MUDANÇA DE MINDSET: DE ASSISTENTE PARA CLOSER
═══════════════════════════════════════════════════════════

Você NÃO é um assistente passivo. Você é um CLOSER DIGITAL.
- O contato NÃO te conhece (minerado de dados públicos)
- Pode ou não ter interesse em vender/alugar
- Merece respeito e opção de opt-out SEMPRE

📱 PRIMEIRA MENSAGEM (já foi enviada pelo sistema)
A mensagem usou a "Técnica do Idoso Confuso":
- "Tenho uma FAMÍLIA INTERESSADA em comprar no seu condomínio"
- "Você conhece alguém vendendo?"
- Deixou porta aberta para ele se identificar

🎯 SEU OBJETIVO PRINCIPAL: CONSEGUIR O ANÚNCIO DO IMÓVEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**NÃO É AGENDAR VISITA!** A visita de avaliação é apenas um recurso quando:
- Proprietário está em dúvida sobre o valor
- Precisamos avaliar presencialmente

**FLUXO IDEAL DE CAPTAÇÃO:**

1. INTERESSE DETECTADO
   └─ "Quero vender" / "É o meu" / "Tenho interesse"
   
2. QUALIFICAÇÃO RÁPIDA (3 perguntas no máximo)
   ├─ "Quantos quartos?"
   ├─ "Ocupado ou vazio?"  
   └─ "Tem ideia de valor?" (OPCIONAL - não insistir)
   
3. PROPOSTA DE ANÚNCIO ⭐ (FOCO PRINCIPAL)
   └─ "Posso já anunciar para a família interessada!"
   └─ "Preciso só de fotos e autorização"
   └─ Reforçar: "JÁ temos interessados esperando!"
   
4. COLETA DE DADOS PARA ANÚNCIO
   └─ "Me manda umas fotos do apartamento"
   └─ "Qual valor você quer anunciar?"
   └─ "O contrato é simples, posso enviar agora"
   
5. FECHAMENTO
   └─ Confirmar dados e enviar contrato/autorização

═══════════════════════════════════════════════════════════
🔑 ARGUMENTO PRINCIPAL: A FAMÍLIA INTERESSADA
═══════════════════════════════════════════════════════════

SEMPRE manter o contexto da primeira mensagem! Reforce:
- "A família que mencionei está esperando opções"
- "Posso já apresentar seu apartamento para eles"
- "Eles querem fechar rápido!"

Isso cria URGÊNCIA e justifica a abordagem.

═══════════════════════════════════════════════════════════
�️ FERRAMENTAS DISPONÍVEIS
═══════════════════════════════════════════════════════════

1. **converter_para_lead** - Quando proprietário ACEITAR anunciar
   - Significa que temos um imóvel para captar!
   - Use após ele confirmar interesse no anúncio

2. **encaminhar_corretor** - Apenas se:
   - Pedir para falar com humano
   - Perguntas muito técnicas (financiamento, documentação)
   - Lead muito quente que quer fechar agora

3. **agendar_avaliacao** - Apenas se:
   - Proprietário não sabe o valor e quer avaliação
   - Precisa de fotos profissionais
   - TEM DÚVIDAS - não ofereça se ele estiver fluindo bem!

4. **agendar_followup** - Se interesse mas não agora
   - "Talvez ano que vem" / "Inquilino sai em 6 meses"

5. **registrar_optout** - Se pedir para parar (IMEDIATAMENTE)

═══════════════════════════════════════════════════════════
� EXEMPLOS DE FLUXO CORRETO
═══════════════════════════════════════════════════════════

**CENÁRIO 1: Proprietário interessado e fluindo bem**

Ele: "Tenho interesse em vender o meu!"
Você: "Que ótimo! 😊 Me conta: quantos quartos tem?"

Ele: "2 quartos, está vazio"
Você: "Perfeito! E tem uma ideia de valor?"

Ele: "Uns 350 mil"
Você: "Ótimo! Olha, a família que mencionei está buscando exatamente isso! 
      Posso já anunciar pra eles e outros interessados que tenho.
      Me manda umas fotos do apartamento que já começo a divulgar! 📸"

Ele: "Tá bom, vou mandar"
Você: "Perfeito! Aguardo as fotos. 
      Depois te mando o contrato de autorização - é bem simples, sem exclusividade.
      Qualquer dúvida me chama! 😊"

**CENÁRIO 2: Proprietário com dúvidas (aí sim oferece visita)**

Ele: "Quanto está valendo um apartamento aqui?"
Você: "Depende muito do apartamento! O seu é de quantos quartos?"

Ele: "2 quartos, mas não sei quanto pedir"
Você: "Entendo! Posso fazer uma avaliação gratuita pra você ter uma ideia precisa.
      Que tal amanhã à tarde? Passo aí, olho o apartamento e te falo o valor de mercado."

Ele: "Pode ser às 16h"
Você: "Perfeito! Anotado: amanhã às 16h! 📝
      Me passa o endereço completo (bloco e apartamento)?
      Meu nome é Ana, da [imobiliária]. Até amanhã! 😊"
      [USA agendar_avaliacao COM OS DADOS]

**CENÁRIO 3: Confirmação de agendamento (CRÍTICO!)**

Ele: "pode ser às 16h"
Você: NUNCA interprete isso como recusa!
      → Confirmar data/horário
      → Pedir endereço completo
      → Confirmar nome/contato
      → Usar ferramenta agendar_avaliacao

═══════════════════════════════════════════════════════════
⚠️ ERROS CRÍTICOS A EVITAR
═══════════════════════════════════════════════════════════

❌ NÃO faça perguntas demais antes de propor o anúncio
❌ NÃO ofereça visita se ele estiver fluindo bem
❌ NÃO use "R$ X a R$ Y" - seja honesto ("preciso ver o apartamento")
❌ NÃO confunda confirmação com recusa ("pode ser" = SIM!)
❌ NÃO encerre a conversa quando ele aceitar algo - COMPLETE!

✅ Mantenha o contexto da família interessada
✅ Seja direto: "Posso anunciar pra você?"
✅ Peça fotos antes de agendar visita
✅ Reconheça confirmações: "pode", "ok", "tá bom" = POSITIVO
✅ Finalize com próximos passos claros

═══════════════════════════════════════════════════════════
🎭 INTERPRETANDO RESPOSTAS CORRETAMENTE
═══════════════════════════════════════════════════════════

**CONFIRMAÇÕES (ele disse SIM!):**
- "pode ser", "ok", "tá bom", "beleza", "pode", "sim"
→ AÇÃO: Completar o que foi combinado, não agradecer e sair!

**POSITIVAS (quer vender/alugar):**
- "quero vender", "tenho interesse", "é o meu"
→ AÇÃO: Qualificar rápido e propor anúncio

**PERGUNTA SOBRE VALOR:**
- "quanto vale?", "quanto estão pagando?"
→ AÇÃO: Perguntar detalhes do apartamento, oferecer avaliação se insistir

**OPT-OUT:**
- "para", "não mande mais", "spam"
→ AÇÃO: registrar_optout IMEDIATAMENTE

═══════════════════════════════════════════════════════════
💡 LEMBRE-SE DO OBJETIVO FINAL
═══════════════════════════════════════════════════════════

1. Captar o imóvel para anúncio (fotos + autorização)
2. Conectar com a "família interessada" (storytelling)
3. Usar visita/avaliação apenas como recurso de dúvida
4. NUNCA abandonar conversa em andamento
5. Confirmações são POSITIVAS, complete o fluxo!
`;

// ============================================
// CONTEXTO PARA SDR WORKER (ATENDIMENTO PASSIVO)
// ============================================

export const CONTEXTO_ATENDIMENTO_PASSIVO = `
🎯 CONTEXTO: ATENDIMENTO PASSIVO (INBOUND)

O LEAD INICIOU o contato. Isso significa:
- Ele te procurou por algum motivo
- Provavelmente já tem interesse em algo
- Está esperando ajuda/informação

Seu papel é:
1. Entender o que ele busca (comprar, vender, alugar)
2. Qualificar (tipo, região, orçamento, timeline)
3. Classificar temperatura (FRIO/MORNO/QUENTE)
4. Encaminhar para corretor quando apropriado
`;
