/**
 * Seed: Popular ConhecimentoCurado com objeções e cenários do estrategia.md
 * 
 * Uso: npx tsx prisma/seeds/seed-conhecimento-curado.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ConhecimentoItem {
    categoria: string;
    subcategoria: string;
    titulo: string;
    texto: string;
    contextoUso: string;
    exemplo?: string;
    tipoImovel: string[];
    tipoNegocio: string[];
    scoreEficacia: number;
    ordem: number;
    fonte: string;
}

const OBJECOES: ConhecimentoItem[] = [
    // ===== OBJEÇÃO 01 =====
    {
        categoria: 'Captacao_Outbound',
        subcategoria: 'objecao_experiencia_ruim',
        titulo: 'Já tentei imobiliária e não funcionou',
        texto: `MOVIMENTO 1 — Validar e investigar:
"Entendo perfeitamente, e lamento que tenha passado por isso. Pode me contar o que aconteceu? O imóvel ficou parado, as visitas não convertiam, ou os corretores simplesmente sumiram?"

⏸️ Ouvir com atenção. Cada detalhe que ele contar é munição para a solução.

MOVIMENTO 2 — Amplificar a dor:
"Então o senhor ficou meses com o imóvel parado, sem retorno, sem saber se estava sendo bem divulgado, sem controle nenhum do processo — e ainda assim pagaria comissão se alguém aparecesse. Resumindo: todo o risco era seu e o compromisso era zero deles."

MOVIMENTO 3 — Apresentar a solução:
"O que nós fazemos é exatamente o oposto disso. Antes de qualquer divulgação, assinamos um contrato de consultoria — o que significa que temos uma obrigação formal com o senhor. Não somos mais um corretor que some. Somos a empresa responsável pelo processo inteiro, com estratégia, prazo e prestação de contas real."

FECHAMENTO:
"A imobiliária que não funcionou não tinha compromisso com o senhor. Nós temos. Essa é a diferença."`,
        contextoUso: 'Quando o proprietário relata experiência negativa anterior com imobiliárias ou corretores. Sinais: frustração, desconfiança, menção a imóvel que ficou parado.',
        exemplo: 'Proprietário: "Já deixei com duas imobiliárias e ninguém vendeu." → Usar Movimento 1 para investigar o que deu errado.',
        tipoImovel: [],
        tipoNegocio: ['venda', 'captacao'],
        scoreEficacia: 90,
        ordem: 1,
        fonte: 'estrategia.md'
    },

    // ===== OBJEÇÃO 02 =====
    {
        categoria: 'Captacao_Outbound',
        subcategoria: 'objecao_preco_avaliacao',
        titulo: 'O preço que vocês avaliaram está baixo demais',
        texto: `MOVIMENTO 1 — Validar sem ceder:
"Compreendo! O imóvel tem um valor enorme pra você — e faz todo sentido querer receber o máximo por ele. Não estou aqui pra discutir isso."

MOVIMENTO 2 — A pergunta estratégica:
"Mas me diz uma coisa — há quanto tempo o imóvel está à venda com o preço atual?"

⏸️ Deixar ele responder. Se estiver há meses parado, a resposta está na pergunta.

MOVIMENTO 3 — Amplificar o custo da espera:
"Cada mês que o imóvel fica parado tem um custo real: condomínio, IPTU, manutenção, oportunidade perdida. Um imóvel que fica 12 meses a mais no mercado por conta de preço fora da realidade pode custar mais do que o ajuste que estamos sugerindo."

MOVIMENTO 4 — Solução com dados:
"Nossa avaliação é feita com IA, baseada em dados reais de imóveis vendidos na mesma região — não é achismo. E o melhor: a decisão final é sempre sua."

FECHAMENTO:
"Não estamos pedindo pra vender barato. Estamos pedindo pra vender certo — no preço que o mercado vai absorver, no menor tempo possível."`,
        contextoUso: 'Quando o proprietário discorda da avaliação de preço ou acha que o imóvel vale mais. Sinais: apego emocional, comparação com preços de vizinhos, resistência ao ajuste.',
        exemplo: 'Proprietário: "Meu vizinho vendeu por 500 mil, o meu vale mais." → Usar Movimento 2 para perguntar há quanto tempo está à venda.',
        tipoImovel: [],
        tipoNegocio: ['venda', 'captacao'],
        scoreEficacia: 85,
        ordem: 2,
        fonte: 'estrategia.md'
    },

    // ===== OBJEÇÃO 03 =====
    {
        categoria: 'Captacao_Outbound',
        subcategoria: 'objecao_vender_sozinho',
        titulo: 'Prefiro vender por conta própria / sem corretor',
        texto: `MOVIMENTO 1 — Respeitar a decisão:
"Respeito muito isso! O senhor tem todo o direito. Inclusive, muita gente começa assim. Posso te fazer só uma pergunta?"

MOVIMENTO 2 — A pergunta que revela o trabalho:
"Quando um interessado entrar em contato, o senhor vai qualificar se ele realmente tem condição de comprar? Vai negociar a proposta? Vai acompanhar a documentação, o financiamento, o registro em cartório? Vai saber identificar se o comprador está tentando forçar um desconto sem ter base real?"

⏸️ Parar. Deixar o peso da lista cair.

MOVIMENTO 3 — Amplificar o risco:
"Vender um imóvel por conta própria parece simples — mas um erro de avaliação, uma negociação mal conduzida ou um problema documental pode custar muito mais do que qualquer comissão."

MOVIMENTO 4 — Reposicionar o custo:
"Nossa consultoria não é um custo — é um seguro. O senhor paga se vender, e só vende se tiver resultado."

FECHAMENTO:
"A pergunta não é se vale pagar consultoria. A pergunta é: o seu tempo, energia e tranquilidade valem quanto?"`,
        contextoUso: 'Quando o proprietário quer vender sozinho (FSBO), não quer pagar comissão, ou acha que consegue fazer tudo. Sinais: "vou por conta", "não preciso de corretor", "quero economizar a comissão".',
        exemplo: 'Proprietário: "Prefiro anunciar eu mesmo no OLX." → Usar Movimento 2 para listar todo o trabalho envolvido.',
        tipoImovel: [],
        tipoNegocio: ['venda', 'captacao'],
        scoreEficacia: 88,
        ordem: 3,
        fonte: 'estrategia.md'
    },

    // ===== OBJEÇÃO 04 =====
    {
        categoria: 'Captacao_Outbound',
        subcategoria: 'objecao_corretor_confianca',
        titulo: 'Já tenho um corretor de confiança',
        texto: `MOVIMENTO 1 — Valorizar a relação:
"Que ótimo! Ter alguém de confiança é fundamental. Não estou aqui pra substituir ninguém."

MOVIMENTO 2 — A pergunta que abre o espaço:
"Mas me diz — esse corretor trabalha sozinho ou tem uma rede grande de compradores? Ele consegue divulgar o seu imóvel para 80 corretores e 50 imobiliárias ao mesmo tempo, de forma organizada?"

MOVIMENTO 3 — Posicionar sem confrontar:
"O que a Atual faz não concorre com o corretor de confiança do senhor — muito pelo contrário. Ele pode fazer parte da nossa rede de parceiros e trabalhar junto com a gente. A diferença é que agora o imóvel dele vai ter estrutura, material profissional e muito mais alcance."

FECHAMENTO:
"O corretor de confiança do senhor vai continuar sendo parte do processo. A gente só multiplica a força dele."`,
        contextoUso: 'Quando o proprietário tem lealdade a um corretor existente. Sinais: "já tenho alguém", "meu corretor cuida", "tenho um amigo que é corretor".',
        exemplo: 'Proprietário: "Já tenho um corretor há 5 anos." → Usar Movimento 2 para perguntar sobre alcance e rede.',
        tipoImovel: [],
        tipoNegocio: ['venda', 'captacao'],
        scoreEficacia: 85,
        ordem: 4,
        fonte: 'estrategia.md'
    },

    // ===== OBJEÇÃO 05 =====
    {
        categoria: 'Captacao_Outbound',
        subcategoria: 'objecao_comissao',
        titulo: 'Não pago 6% de comissão',
        texto: `MOVIMENTO 1 — Não defender o número imediatamente:
"Entendo! 6% parece muito quando a gente não vê o que está por trás. Me permite te mostrar o que está incluído nesse valor?"

MOVIMENTO 2 — Mostrar o que está sendo comprado:
"Avaliação com IA, produção de material profissional, coordenação de 80+ corretores e 50 imobiliárias, filtro de visitantes, acompanhamento de visitas, negociação de propostas, assessoria até a assinatura do contrato — tudo isso está incluso. O senhor não paga nada disso antes de vender."

MOVIMENTO 3 — Reposicionar o custo:
"Em um imóvel de R$ 500 mil, 6% representa R$ 30 mil. Um erro de negociação, um comprador mal qualificado aceitando financiamento que não aprovam, ou um problema documental resolvido tarde podem custar muito mais do que isso."

FECHAMENTO:
"O senhor não está pagando comissão — está investindo em resultado. E só paga se vender."`,
        contextoUso: 'Quando o proprietário reclama do percentual de comissão. Sinais: "6% é muito", "não pago isso", "comissão alta", "desconto na comissão".',
        exemplo: 'Proprietário: "Nenhuma imobiliária cobra 6%!" → Usar Movimento 2 para detalhar o que está incluído.',
        tipoImovel: [],
        tipoNegocio: ['venda', 'captacao'],
        scoreEficacia: 87,
        ordem: 5,
        fonte: 'estrategia.md'
    },

    // ===== OBJEÇÃO 06 =====
    {
        categoria: 'Captacao_Outbound',
        subcategoria: 'objecao_nao_assina_contrato',
        titulo: 'Se tiver cliente pode trazer — mas não assino nada',
        texto: `MOVIMENTO 1 — Validar o receio:
"Entendo! Assinar algo sem conhecer bem a empresa gera insegurança — e isso é muito justo."

MOVIMENTO 2 — Mostrar o que acontece sem contrato:
"Mas me deixa te mostrar o que acontece quando trabalhamos sem contrato: o imóvel fica sem estratégia definida, qualquer corretor anuncia do jeito que quer, com preço que quer, foto que quer — e quando aparece um comprador, começa a briga de quem fechou, quem apresentou, quem tem direito à comissão. E adivinhe quem fica no meio disso tudo?"

⏸️ Parar. Deixar ele responder ou refletir.

MOVIMENTO 3 — Posicionar o contrato como proteção do proprietário:
"Nosso contrato não é pra nos proteger — é pra proteger o senhor. Com ele, o senhor sabe exatamente o que vamos fazer, em quanto tempo, com que parceiros e em quais condições. É a garantia de que ninguém vai agir no escuro com o seu patrimônio."

FECHAMENTO:
"Trabalhar sem contrato não é liberdade — é justamente o que deixa o senhor vulnerável. O contrato é o que garante que tudo vai ser feito do jeito certo."`,
        contextoUso: 'Quando o proprietário quer receber compradores mas se recusa a assinar qualquer documento. Sinais: "não assino nada", "pode trazer cliente mas sem contrato", "sem exclusividade".',
        exemplo: 'Proprietário: "Manda cliente que eu atendo, mas papel eu não assino." → Usar Movimento 2 para mostrar os riscos.',
        tipoImovel: [],
        tipoNegocio: ['venda', 'captacao'],
        scoreEficacia: 82,
        ordem: 6,
        fonte: 'estrategia.md'
    },

    // ===== OBJEÇÃO 07 =====
    {
        categoria: 'Captacao_Outbound',
        subcategoria: 'objecao_imovel_parado',
        titulo: 'Meu imóvel está anunciado há meses e não vende',
        texto: `⚠️ Essa não é uma objeção — é uma abertura de oportunidade. Use com cuidado e empatia.

MOVIMENTO 1 — Reconhecer a dor:
"Meses esperando e nada — isso cansa, gera ansiedade e dá a sensação de que o imóvel tem algum problema. Mas na maioria dos casos o problema não é o imóvel."

MOVIMENTO 2 — Diagnosticar:
"Me conta: como ele está sendo divulgado hoje? As fotos são profissionais? O preço foi avaliado com dados de mercado? As visitas que aconteceram foram de perfis realmente qualificados ou de curiosos?"

MOVIMENTO 3 — Apresentar o diagnóstico real:
"Na maioria dos imóveis que chegam até nós nessa situação, o problema é sempre um dos três: preço fora da realidade, material de divulgação fraco, ou falta de organização na rede de corretores. Às vezes os três juntos."

FECHAMENTO:
"O senhor já perdeu meses. Quanto tempo mais está disposto a esperar fazendo a mesma coisa? A gente pode mudar isso agora."`,
        contextoUso: 'Quando o proprietário já está com o imóvel há meses no mercado sem sucesso. Sinais: "está parado há muito tempo", "ninguém aparece", "poucas visitas", "desanimado".',
        exemplo: 'Proprietário: "Já tem 8 meses e nada." → Usar Movimento 2 para diagnosticar a causa raiz.',
        tipoImovel: [],
        tipoNegocio: ['venda', 'captacao'],
        scoreEficacia: 92,
        ordem: 7,
        fonte: 'estrategia.md'
    },

    // ===== CENÁRIOS DE ABORDAGEM =====
    {
        categoria: 'Captacao_Outbound',
        subcategoria: 'script_abertura',
        titulo: 'Roteiro de Abordagem WhatsApp — Lista Fria',
        texto: `SAUDAÇÃO INICIAL:
"Olá, [Nome]! Tudo bem? 😊 Aqui é [Agente], da [Imobiliária]. Posso te fazer uma pergunta rápida?"

Se SIM → PORTA 01:
"Que ótimo! Ando em contato com proprietários de [tipo] no [Empreendimento] e tô com dificuldade de encontrar alguém interessado em vender ou alugar por lá. Você mesmo tem algum plano pro seu imóvel, ou conhece alguém que possa estar pensando nisso? 🙏"

Se NÃO → Encerrar com cordialidade:
"Sem problema! Se precisar de algo, pode contar comigo. Abraço!"`,
        contextoUso: 'Primeira mensagem para lista fria de proprietários. Usar quando o contato nunca foi abordado antes.',
        exemplo: 'Início de campanha outbound para empreendimento novo.',
        tipoImovel: [],
        tipoNegocio: ['captacao'],
        scoreEficacia: 80,
        ordem: 0,
        fonte: 'estrategia.md'
    },

    // ===== CENÁRIO: DESCONFIANÇA =====
    {
        categoria: 'Captacao_Outbound',
        subcategoria: 'cenario_desconfianca',
        titulo: 'Como conseguiu meu número? (Desconfiança)',
        texto: `RESPOSTA:
"Boa pergunta! Seu contato chegou até mim por uma lista de proprietários do [Empreendimento]. Trabalho nessa região e procuro conectar proprietários com boas oportunidades. Posso te fazer a pergunta?"

Se pedir para ser removido: respeitar IMEDIATAMENTE e encerrar com cordialidade. Usar tool registrar_optout.`,
        contextoUso: 'Quando o proprietário questiona como conseguiram o telefone. Sinal de desconfiança inicial.',
        exemplo: 'Proprietário: "De onde você tirou meu número?" → Usar resposta transparente sobre mapeamento de região.',
        tipoImovel: [],
        tipoNegocio: ['captacao'],
        scoreEficacia: 75,
        ordem: 8,
        fonte: 'estrategia.md'
    },

    // ===== CENÁRIO: SEM RESPOSTA =====
    {
        categoria: 'Captacao_Outbound',
        subcategoria: 'cenario_followup',
        titulo: 'Follow-up — Proprietário não respondeu (2-3 dias)',
        texto: `MENSAGEM DE FOLLOW-UP:
"Oi, [Nome]! Tudo bem? Vi que minha mensagem pode ter se perdido. Só queria fazer uma pergunta rápida sobre seu imóvel no [Empreendimento] — tem 1 minutinho?"

Se ignorar NOVAMENTE → encerrar o contato. NÃO insistir. Usar agendar_followup para 30 dias.`,
        contextoUso: 'Quando a primeira mensagem foi enviada há 2-3 dias e não houve resposta.',
        exemplo: '2 dias sem resposta após saudação inicial. Enviar UMA vez o follow-up.',
        tipoImovel: [],
        tipoNegocio: ['captacao'],
        scoreEficacia: 70,
        ordem: 9,
        fonte: 'estrategia.md'
    },
];

async function seed() {
    console.log('🌱 Populando ConhecimentoCurado com objeções do estrategia.md...');

    // Limpar dados existentes da mesma fonte
    const deletados = await prisma.conhecimentoCurado.deleteMany({
        where: { fonte: 'estrategia.md' }
    });
    console.log(`🗑️  Removidos ${deletados.count} registros anteriores (fonte: estrategia.md)`);

    // Inserir todos
    for (const item of OBJECOES) {
        const registro = await prisma.conhecimentoCurado.create({
            data: {
                categoria: item.categoria,
                subcategoria: item.subcategoria,
                titulo: item.titulo,
                texto: item.texto,
                contextoUso: item.contextoUso,
                exemplo: item.exemplo,
                tipoImovel: item.tipoImovel,
                tipoNegocio: item.tipoNegocio,
                scoreEficacia: item.scoreEficacia,
                ordem: item.ordem,
                ativo: true,
                fonte: item.fonte,
                criadoPor: 'seed-estrategia',
            }
        });
        console.log(`  ✅ ${item.titulo} (score: ${item.scoreEficacia})`);
    }

    console.log(`\n🎯 Total: ${OBJECOES.length} registros inseridos em ConhecimentoCurado`);
    console.log('   - 7 objeções com 3-4 movimentos cada');
    console.log('   - 3 cenários de abordagem (abertura, desconfiança, follow-up)');
}

seed()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
