export interface Objecao {
  id: number;
  fase: 'Opener' | 'Presenter' | 'Closer';
  gatilhos: string[];
  contorno: string;
}

export const BIBLIOTECA_OBJECOES: Objecao[] = [
  // ================= OPENER =================
  {
    id: 1,
    fase: 'Opener',
    gatilhos: ["não tenho pressa", "sem pressa", "sem urgência para vender"],
    contorno: "Faz sentido! Sem pressa dá pra fazer isso do jeito certo e garantir um valor melhor. Posso só entender melhor o seu imóvel pra ver se faz sentido conversarmos?"
  },
  {
    id: 2,
    fase: 'Opener',
    gatilhos: ["esperar o mercado", "esperar melhorar", "momento ruim do mercado"],
    contorno: "Entendo! A gente pode deixar tudo preparado enquanto espera — quando o mercado virar, você já tá na frente. Faz sentido?"
  },
  {
    id: 3,
    fase: 'Opener',
    gatilhos: ["tô vendo outras", "considerando outras opções", "estudando outras imobiliárias"],
    contorno: "Claro, faz sentido avaliar tudo. Posso te mostrar em 2 minutos como a gente trabalha diferente? Aí você decide com mais informação."
  },
  {
    id: 4,
    fase: 'Opener',
    gatilhos: ["não acho que seja um bom momento", "momento agora não é bom"],
    contorno: "Entendo! Posso fazer uma análise rápida do mercado pra você ver se faz sentido agora ou planejar pro futuro. Te ajuda?"
  },
  {
    id: 5,
    fase: 'Opener',
    gatilhos: ["preocupado com o processo", "processo chato", "não quero me estressar"],
    contorno: "Faz total sentido essa preocupação. A gente cuida de tudo — avaliação, fotos, visitas, negociação. Você não precisa se preocupar com nada. Posso te explicar como funciona?"
  },
  {
    id: 6,
    fase: 'Opener',
    gatilhos: ["já trabalho com outra", "tenho outra imobiliária", "já tem gente anunciando"],
    contorno: "Que ótimo que já tá movimentando! Há quanto tempo tá anunciado? Tá recebendo visitas? (Nota interna ao agente: identifique a dor e tente redirecionar sem bater de frente)"
  },
  {
    id: 7,
    fase: 'Opener',
    gatilhos: ["esperar para ver a evolução", "vou aguardar um pouco"],
    contorno: "Com certeza! Posso te mandar análises periódicas do mercado pra você acompanhar. Enquanto isso, você toparia a gente só entender melhor o seu imóvel?"
  },
  {
    id: 8,
    fase: 'Opener',
    gatilhos: ["experiência ruim anterior", "outra imobiliária me enganou", "tive muito problema"],
    contorno: "Sinto muito, isso é frustrante demais. O que aconteceu? Ficou sem retorno, sem visitas? (Nota interna ao agente: colete a dor e valide o sentimento.)"
  },
  {
    id: 9,
    fase: 'Opener',
    gatilhos: ["não precisa de divulgação", "meu imóvel vende sozinho", "não precisa muito anúncio"],
    contorno: "Entendo! Mas imóvel bem apresentado e com mais visibilidade vende mais rápido e por um valor melhor. Posso te mostrar um exemplo rápido?"
  },
  {
    id: 10,
    fase: 'Opener',
    gatilhos: ["como conseguiu meu número", "quem te passou meu contato"],
    contorno: "Seu contato chegou por uma base pública de inteligência da região. Tudo sem compromisso nenhum! Posso continuar? 😊"
  },
  {
    id: 11,
    fase: 'Opener',
    gatilhos: ["para de mandar mensagem", "não tenho interesse e não quero saber", "sai daqui"],
    contorno: "Desculpa o incômodo! Não vou mais entrar em contato. Boa semana! 🙏 (Nota interna ao agente: pare completamente o contato)."
  },

  // ================= PRESENTER =================
  {
    id: 12,
    fase: 'Presenter',
    gatilhos: ["corretor de confiança", "amigo corretor", "já tem um que faz tudo"],
    contorno: "Faz sentido ter alguém de confiança! Me conta: esse corretor tá anunciando em quantos portais? Tá tendo retorno frequente pra você? (Nota: identifique gargalos logísticos sem atacar a índole do corretor.)"
  },
  {
    id: 13,
    fase: 'Presenter',
    gatilhos: ["pra que IA preificar", "não confio em avaliação de computador", "IA pra imóvel?"],
    contorno: "Faz sentido questionar! A IA não substitui a experiência humana — ela garante que o preço que a gente sugere tá ancorado em dados matemáticos do mercado real, protegendo o valor do seu imóvel contra 'achismos'. Faz diferença isso na prática?"
  },
  {
    id: 14,
    fase: 'Presenter',
    gatilhos: ["não quero pagar fotos", "pra que vídeo de drone", "meu celular já tira foto"],
    contorno: "Entendo! E o melhor: esses serviços profissionais já estão INCLUSOS na nossa operação da gestão, você não paga nada a mais antes. Imóvel com foto profissional e drone vende em média 40% mais rápido. Vale a pena usarmos as nossas câmeras, né?"
  },
  {
    id: 15,
    fase: 'Presenter',
    gatilhos: ["não gosto de compartilhar", "ficar passando meu imóvel pros outros", "rede de corretores espalha tudo"],
    contorno: "Entendo a preocupação! A diferença é que com a gente não tem bagunça solta no mercado — é uma rede organizada e coordenada pelo nosso contrato de gestão central. Preço fixado, material limpo e padronizado, mas multiplicado em alcance. Faz sentido?"
  },
  {
    id: 16,
    fase: 'Presenter',
    gatilhos: ["já tive experiência negativa com gestão", "deixei sob gestão e foi ruim"],
    contorno: "Que situação chata, sinto muito. O que aconteceu na época? Ficou sem receber feedback, ou o imóvel ficou totalmente parado? (Nota: faça a escuta ativa para usar as dores antigas no nosso roteiro.)"
  },
  {
    id: 17,
    fase: 'Presenter',
    gatilhos: ["vender mais rápido não é bom", "quem tem pressa vende barato", "não quero queimar"],
    contorno: "Faz total sentido! Mas vender rápido não significa leiloar pra baixo — pelo contrário. Imóvel que empaca por meses no portal é que queima o preço no mercado porque os compradores desabam as propostas. A ideia da agilidade é garantir que todo mundo veja no pico do lançamento, vendendo rápido e pelo melhor valor."
  },
  {
    id: 18,
    fase: 'Presenter',
    gatilhos: ["eu gosto de controlar", "eu atendo os clientes", "eu não solto o osso da venda"],
    contorno: "Com certeza, e você vai continuar 100% no controle! A gente só blinda você do cansaço operacional — tirar as fotos, bater na porta pra visitar, filtrar as documentações furadas. Mas você só decide aceitar e bater o martelo na hora certa. Como soa isso pra você?"
  },
  {
    id: 19,
    fase: 'Presenter',
    gatilhos: ["meu imóvel é super único", "meu imóvel não é igual aos outros", "método padrão não serve pra mim"],
    contorno: "Concordo 100%! Exatamente por ser tão único é que a gente faz um diagnóstico detalhado. Cada estratégia de anúncio e direcionamento que usamos é montada do zero pra combinar só com a cara do seu imóvel. Posso te mostrar como traçamos esse alvo na prática?"
  },
  {
    id: 20,
    fase: 'Presenter',
    gatilhos: ["custa quanto", "taxa de vocês", "qual a porcentagem de comissão", "comissão e honorários"],
    contorno: "Trabalhamos com a media de mercado padrão de 6%. E a mágica: você só paga quando a gente fechar o dinheiro na sua conta. Zero custo antes. Posso continuar te explicando a montanha de serviços inclusos pra justificar o seu ROI?"
  },
  {
    id: 21,
    fase: 'Presenter',
    gatilhos: ["comunicação bagunçada", "muitos corretores e ninguém dá retorno", "todo mundo sumiu"],
    contorno: "Isso é exatamente a doença que nós curamos. Com a Gestão da Venda da Quadra Dois você tem um único ponto de contato: nós mesmos. A gente cobra todos os nossos parceiros da cidade que visitaram, consolida os dados e te manda a atualização filtrada direto no seu WhatsApp. Gestão técnica de verdade."
  },
  {
    id: 22,
    fase: 'Presenter',
    gatilhos: ["eu vou tentar sozinho um tempo", "vender por conta própria primeiro", "colocar placa e ver no que dá"],
    contorno: "Faz muito sentido querer testar sozinho! Só me diz algo importante: quando aparecer um cara dizendo que quer pagar à vista, você tem a estrutura pra qualificar o crédito dele e a documentação na Receita antes de perder um final de semana? Tem muita dor de cabeça solta na negociação direta que te fazemos pular."
  },

  // ================= CLOSER =================
  {
    id: 23,
    fase: 'Closer',
    gatilhos: ["acho a taxa muito alta", "6 por cento é muito", "achei a comissão cara"],
    contorno: "Entendo! Mas olha pelo prisma do que cobrimos: fotos, drone, portais vitrine (ZAP, VivaReal), setor jurídico robusto nas costas e o ecossistema inteiro engajado no seu imóvel. Tudo isso sairia do seu bolso antes da venda se fosse solto. A gente paga essa fatura, vende até mais caro pro repasse compensar, e você só paga na festa do sucesso!"
  },
  {
    id: 24,
    fase: 'Closer',
    gatilhos: ["vi um cobrando 4%", "outra é mais barata", "fulano cobra menos comissão"],
    contorno: "Sempre faça a conta do barato que custa meses. Imobiliária com taxa baixa só joga no portal e reza pra vender. A gente compartilha ganhos com os parceiros ativamente (daí a sustentação da comissão de 6%) e bota dinheiro de verdade em tráfego focado pros clientes certos. Custo baixo é economia na etapa da vitrine, que depois custa caríssimo em rebaixamento no preço final de negociação."
  },
  {
    id: 25,
    fase: 'Closer',
    gatilhos: ["prefiro pagar um valor fixo", "comissão fixa e deu"],
    contorno: "Compreendo, mas valor fixo tira o nosso 'sangue no olho' de brigar com os compradores pelo preço MÁXIMO da venda (já que a gente ganharia o mesmo se baixar, né?). Com a base de %, nós mesmos viramos os 'donos ansiosos' tentando subir as propostas pra garantir também que nossos honorários rendam."
  },
  {
    id: 26,
    fase: 'Closer',
    gatilhos: ["não posso pagar agora", "não tenho dinheiro antes da venda"],
    contorno: "Excelente notícia: NENHUM real sai do seu bolso agora. A taxa sai 100% da verba final depositada pelo comprador lá na assinatura da escritura. O aceite no contrato inicial é de R$ 0,00."
  },
  {
    id: 27,
    fase: 'Closer',
    gatilhos: ["o serviço não vale isso tudo", "é dinheiro demais e não fazem nada"],
    contorno: "É extremamente plausível sua dúvida. Se fossemos separar: uma filmagem e fotos com drone de mercado = R$400, portais em Destaque Alto pra não cair no buraco do Zap = R$ 1.200 todo mês. Minutas no Jurídico = + de R$1k de consultoria. Isso fora o tempo, ligações chatas e canceladas. Com o contrato ativado agora, a pressão inteira vai pras nossas costas, por 0 reais iniciais."
  },
  {
    id: 28,
    fase: 'Closer',
    gatilhos: ["estou bem com minha imobiliária", "estou feliz onde está"],
    contorno: "Que espetáculo, fico feliz por você. Só curiosidade técnica: está tendo retorno bom de visitas qualificadas com crédito pré-aprovado da parte deles? (Nota tática: tente cavar apenas uma fissura nessa proteção, se tiver fissura aponte a Gestão, se não, não force fechamento)."
  },
  {
    id: 29,
    fase: 'Closer',
    gatilhos: ["contrato muito longo", "quero assinar por 30 meses", "prefiro tirar em 3 meses"],
    contorno: "Tempo de exclusividade assusta mesmo! O modelo padrão técnico no mercado aponta 180 dias porque o processo de financiamento da Caixa, visitas e cartório come boa parte da janela. Porém, pra você me provar, vamos levar pra coordenação e calibrar isso pra nos sentirmos mais confortáveis. Qual limite você sugere ser um teste justo pra gente provar a tese de venda?"
  },
  {
    id: 30,
    fase: 'Closer',
    gatilhos: ["não acho que a venda vá andar mais rápido", "tudo balela", "não adianta nada centralizar"],
    contorno: "Complicado acreditar em discursos no imóvel solto. Mas se você observar matemática seca: o fato matemático de ter fotos/filmes melhores e uma Gestão abrindo as chaves até finais de semana pra toda a base vizinha parceira é o que faz o cronômetro do seu imóvel rodar x5 mais rápido do que anúncios amadores no marketplace."
  },
  {
    id: 31,
    fase: 'Closer',
    gatilhos: ["já gastei tempo e dinheiro", "reforma", "não quero despender mais nada"],
    contorno: "Então somos o parceiro que blinda exatamente essa dor. A gente vem pra segurar 100% da linha de investimento em marketing nas nossas contas e recuperar a margem dessa reforma sem dores de cabeça nas negociações picadas. Perca zero e garanta só o estorno final."
  },
  {
    id: 32,
    fase: 'Closer',
    gatilhos: ["não vou assinar agora", "não quero fechar", "tô resistente ao contrato"],
    contorno: "Eu escuto isso todo dia, não se preocupe! Mas de curiosidade genuína: o que te freia agora mesmo sabendo das fotos profissionais a 0 reais pro seu bolso? É o pânico do prazo de fidelidade de 180 dias, o número % da comissão, ou ainda precisa pensar em alguma burocracia do papel?"
  },
  {
    id: 33,
    fase: 'Closer',
    gatilhos: ["não dou meu cpf pra fazer contrato pelo whatsapp", "não confio no zang zang", "na internet não rola"],
    contorno: "Eu estaria igualzinho a você. Fique absolutamente tranquilo, a assinatura não precisa e nem deve ser mandada pelo WhatsApp. Tem segurança biométrica! A gente te solta um link oficial do portal ClickSign blindado nas diretrizes do Gov.Br pra você abrir da sua máquina criptografado e validado formalmente."
  },
  {
    id: 34,
    fase: 'Closer',
    gatilhos: ["exclusividade não", "autorização não quero amarras", "não de novo exclusividade"],
    contorno: "A gente sabe, a palavra tá suja no mercado! Mas me diz a quente: dos tantos outros corretores com quem seu imóvel deve estar sem documento na gaveta, quantos ligaram sábado pra agendar lead com aprovação na Caixa? No Gestão você concentra, organiza, exige nossa prestação de contas judicial e distribui na mesma. Não feche as portas, coloque a tranca pra ser sua."
  },
  {
    id: 35,
    fase: 'Closer',
    gatilhos: ["vou ver e te aviso", "deixa eu analisar fds", "pensar sobre", "falo amanhã"],
    contorno: "Super em paz, casa e imóvel exigem reflexão. Posso te fazer uma pergunta pontual rapidinho? Como 90% dos proprietários que me respondem 'vou pensar' acabaram perdendo ótimas ondas de liquidez, me responde franco para eu não pecar de omissão com você: o ponto que pesa agora é taxa de serviço %, os prazos do documento comercial, ou puramente conversas com a sua família e donos também?"
  }
];
