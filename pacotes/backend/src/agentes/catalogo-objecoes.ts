export interface Objecao {
  id: number;
  fase: 'SDR';
  gatilhos: string[];
  contorno: string;
}

export const BIBLIOTECA_OBJECOES: Objecao[] = [
  // ================= SDR (PROSPECÇÃO) =================
  {
    id: 1,
    fase: 'SDR',
    gatilhos: ["não tenho pressa", "sem pressa", "sem urgência para vender"],
    contorno: "Faz sentido! Na verdade, quem não tem pressa consegue vender pelo valor ideal, sem precisar aceitar a primeira proposta que aparecer. Posso te fazer só umas perguntas rápidas sobre o apartamento? Sem compromisso nenhum, só pra entender o cenário!"
  },
  {
    id: 2,
    fase: 'SDR',
    gatilhos: ["esperar o mercado", "esperar melhorar", "momento ruim do mercado"],
    contorno: "Entendo! Mas te dou uma dica: quem sai na frente é quem já está posicionado quando o mercado aquece. A gente pode deixar tudo preparado — fotos, precificação, estratégia — pra você não perder o timing certo. Faz sentido conversar um pouco sobre isso?"
  },
  {
    id: 3,
    fase: 'SDR',
    gatilhos: ["tô vendo outras", "considerando outras opções", "estudando outras imobiliárias"],
    contorno: "Ótimo, faz muito sentido avaliar as opções! Posso te explicar rapidinho como funciona nosso modelo de gestão compartilhada? A gente trabalha junto com outras imobiliárias, então não é uma coisa excludente. Vale conhecer antes de decidir!"
  },
  {
    id: 4,
    fase: 'SDR',
    gatilhos: ["não acho que seja um bom momento", "momento agora não é bom"],
    contorno: "Entendo a cautela! Se quiser, posso te passar um panorama rápido de como está o mercado na região do seu apartamento agora — sem compromisso. Assim você tem dados reais pra decidir o melhor momento. Topa uma conversa rápida?"
  },
  {
    id: 5,
    fase: 'SDR',
    gatilhos: ["preocupado com o processo", "processo chato", "não quero me estressar"],
    contorno: "É exatamente por isso que a gente existe! A gente filtra os curiosos, cuida de toda a burocracia e só te chama quando tem uma proposta concreta na mesa. Seu único trabalho é dizer sim ou não. Bem mais tranquilo assim, né?"
  },
  {
    id: 6,
    fase: 'SDR',
    gatilhos: ["já trabalho com outra", "tenho outra imobiliária", "já tem gente anunciando"],
    contorno: "Que bom que já deu o primeiro passo! Só uma curiosidade: eles estão trazendo compradores com crédito aprovado, ou tem aparecido mais gente sem condição real de compra? Pergunto porque a gente tem um processo de pré-qualificação dos compradores que faz bastante diferença."
  },
  {
    id: 7,
    fase: 'SDR',
    gatilhos: ["esperar para ver a evolução", "vou aguardar um pouco"],
    contorno: "Claro, sem pressão! Só pra eu não te incomodar sem necessidade depois — posso te fazer só umas perguntas rápidas sobre o apartamento agora? Assim, quando você decidir avançar, a gente já tem tudo mapeado e agiliza muito."
  },
  {
    id: 8,
    fase: 'SDR',
    gatilhos: ["experiência ruim anterior", "outra imobiliária me enganou", "tive muito problema"],
    contorno: "Poxa, que chato! Infelizmente é mais comum do que deveria. Me conta o que aconteceu? Quero entender onde deu errado pra te mostrar como a gente trabalha diferente."
  },
  {
    id: 9,
    fase: 'SDR',
    gatilhos: ["não precisa de divulgação", "meu imóvel vende sozinho", "não precisa muito anúncio"],
    contorno: "Com certeza um bom imóvel tem apelo natural! Mas o que a gente vê no mercado é que com uma estratégia de mídia forte, o imóvel recebe mais de uma proposta ao mesmo tempo — e aí você consegue negociar pra cima, não pra baixo. Vale a pena pelo menos conhecer a estratégia?"
  },
  {
    id: 10,
    fase: 'SDR',
    gatilhos: ["como conseguiu meu número", "quem te passou meu contato"],
    contorno: "Seu contato faz parte de uma base de dados pública de proprietários da região. A gente usa isso de forma bem direcionada, sem spam. Mas se preferir que eu não entre mais em contato, é só falar que eu respeito!"
  },
  {
    id: 11,
    fase: 'SDR',
    gatilhos: ["para de mandar mensagem", "não tenho interesse e não quero saber", "sai daqui"],
    contorno: "Peço desculpas pelo incômodo! Vou registrar seu contato aqui pra não te incomodar mais. Tenha uma ótima semana! 🙏 (Nota interna: pare o contato)."
  },

  // ================= SDR (APRESENTAÇÃO) =================
  {
    id: 12,
    fase: 'SDR',
    gatilhos: ["corretor de confiança", "amigo corretor", "já tem um que faz tudo"],
    contorno: "Ótimo, ter alguém de confiança faz toda diferença! E a boa notícia é que a gente não compete com ele — muito pelo contrário. Nosso modelo permite que ele participe da venda e seja remunerado por isso. A gente entra com a parte operacional: fotos, mídia, gestão dos demais corretores. Faz sentido os dois trabalharem juntos?"
  },
  {
    id: 13,
    fase: 'SDR',
    gatilhos: ["pra que IA preificar", "não confio em avaliação de computador", "IA pra imóvel?"],
    contorno: "Concordo que o olhar do corretor experiente é insubstituível! A IA entra como apoio: ela cruza dados reais de vendas fechadas na região, sem achismo. Isso evita dois erros comuns — pedir abaixo do mercado e perder dinheiro, ou pedir acima e o imóvel ficar parado. O corretor usa esses dados como base e aplica o bom senso em cima. Faz sentido?"
  },
  {
    id: 14,
    fase: 'SDR',
    gatilhos: ["não quero pagar fotos", "pra que vídeo de drone", "meu celular já tira foto"],
    contorno: "Boa notícia: você não paga nada disso! Todo o investimento em fotos, vídeo e mídia é por nossa conta. A gente só recebe quando o imóvel é vendido. E os dados mostram que imóveis com mídia profissional vendem até 40% mais rápido — então compensa muito pra gente investir nisso."
  },
  {
    id: 15,
    fase: 'SDR',
    gatilhos: ["não gosto de compartilhar", "ficar passando meu imóvel pros outros", "rede de corretores espalha tudo"],
    contorno: "Entendo! E pra ser transparente: no nosso modelo, quem gerencia tudo isso somos nós. Você não recebe ligação de dezenas de corretores — tem só eu como ponto de contato. A gente distribui o imóvel internamente e centraliza tudo. Você fica em paz e recebe só atualizações organizadas. Faz sentido?"
  },
  {
    id: 16,
    fase: 'SDR',
    gatilhos: ["já tive experiência negativa com gestão", "deixei sob gestão e foi ruim", "exclusividade não prestou"],
    contorno: "Faz total sentido a ressalva! O modelo antigo de exclusividade era exatamente isso: o corretor guardava o imóvel pra si e limitava as chances de venda. O que a gente faz é diferente — chamamos de Gestão Colaborativa. Colocamos o imóvel pra circular em toda a rede, mas com organização central. O que especificamente deu errado antes? Quero entender pra te mostrar como seria diferente aqui."
  },
  {
    id: 17,
    fase: 'SDR',
    gatilhos: ["vender mais rápido não é bom", "quem tem pressa vende barato", "não quero queimar"],
    contorno: "Concordo totalmente! Vender com desespero sempre prejudica o preço. Mas existe uma diferença entre pressa e posicionamento estratégico. Quando a gente gera demanda de forma organizada — múltiplos interessados ao mesmo tempo — os compradores competem pra cima, não pra baixo. O objetivo é exatamente vender pelo valor máximo, não pelo mínimo."
  },
  {
    id: 18,
    fase: 'SDR',
    gatilhos: ["eu gosto de controlar", "eu atendo os clientes", "eu não solto o osso da venda"],
    contorno: "Perfeito, e isso não muda! A decisão final sempre é sua — nenhuma proposta é aceita sem o seu aval. O que a gente assume é a parte operacional: filtrar curiosos, agendar visitas, lidar com a burocracia. Você só entra quando tem algo concreto na mesa. Fica mais tranquilo assim?"
  },
  {
    id: 19,
    fase: 'SDR',
    gatilhos: ["meu imóvel é super único", "meu imóvel não é igual aos outros", "método padrão não serve pra mim"],
    contorno: "Exatamente por isso que um tratamento padrão não funciona! Imóvel diferenciado precisa de uma comunicação cirúrgica — fotos que destacam os diferenciais, texto que fala com o comprador certo, e canais que alcançam quem realmente tem perfil pra esse tipo de imóvel. O nosso trabalho é justamente extrair o máximo de valor dessas particularidades."
  },
  {
    id: 20,
    fase: 'SDR',
    gatilhos: ["custa quanto", "taxa de vocês", "qual a porcentagem de comissão", "comissão e honorários"],
    contorno: "A comissão segue a tabela padrão do mercado. E o que vale destacar: todo o investimento em mídia, fotos e gestão é por nossa conta — você não paga nada antes da venda. A comissão só acontece quando o negócio é fechado. Então não tem nenhum risco pro seu bolso."
  },
  {
    id: 21,
    fase: 'SDR',
    gatilhos: ["comunicação bagunçada", "muitos corretores e ninguém dá retorno", "todo mundo sumiu"],
    contorno: "É uma dor muito comum no mercado, infelizmente. No nosso modelo, você tem um único ponto de contato — eu. Nada de múltiplos corretores te ligando ou sumindo. A gente centraliza tudo e te mantém atualizado de forma organizada. Bem diferente do caos que você descreveu."
  },
  {
    id: 22,
    fase: 'SDR',
    gatilhos: ["eu vou tentar sozinho um tempo", "vender por conta própria primeiro", "colocar placa e ver no que dá"],
    contorno: "Faz sentido querer tentar! Mas só um alerta: a parte mais difícil não é encontrar o comprador — é o processo depois: análise de crédito, documentação, financiamento, escritura. Qualquer erro nessa etapa pode custar caro ou fazer a venda cair. A gente existe pra garantir que tudo isso rode certinho e o dinheiro caia na sua conta sem surpresa. Vale ao menos saber como funciona antes de decidir?"
  },

  // ================= SDR (OBJEÇÕES CONTRATO) =================
  {
    id: 23,
    fase: 'SDR',
    gatilhos: ["acho a taxa muito alta", "6 por cento é muito", "achei a comissão cara"],
    contorno: "Entendo que a taxa chame atenção! Mas pensa comigo: todo o investimento em marketing, fotos, vídeo e gestão jurídica sai do nosso bolso, não do seu. Além disso, como a gente repassa o imóvel pra toda a rede de corretores da cidade, a concorrência entre compradores evita que você precise dar desconto na hora de fechar. Esse desconto que você não dá costuma ser bem maior que a taxa. Faz sentido?"
  },
  {
    id: 24,
    fase: 'SDR',
    gatilhos: ["vi um cobrando 4%", "outra é mais barata", "fulano cobra menos comissão"],
    contorno: "É bem comum encontrar isso! Mas taxa baixa geralmente significa que eles não repassam o imóvel pra outros corretores — guardam só pra eles. Com menos gente vendendo, a demanda cai e as propostas chegam lá embaixo. Aí você acaba dando um desconto na venda que supera qualquer economia na taxa. A comissão padrão é exatamente o que garante que todo mundo vai querer vender o seu."
  },
  {
    id: 25,
    fase: 'SDR',
    gatilhos: ["prefiro pagar um valor fixo", "comissão fixa e deu"],
    contorno: "Entendo a lógica! Mas o problema do valor fixo é que o consultor perde o incentivo de brigar pelo melhor preço pra você — vai receber o mesmo independente do resultado. Na comissão percentual, nossos interesses ficam alinhados: quanto mais caro você vender, melhor pra nós dois. Eu vou batalhar pelo valor máximo porque isso impacta diretamente meu resultado também."
  },
  {
    id: 26,
    fase: 'SDR',
    gatilhos: ["não posso pagar agora", "não tenho dinheiro antes da venda"],
    contorno: "Boa notícia: você não desembolsa nada antes da venda! Todo o custo com anúncios, vídeo, tráfego pago e gestão é por nossa conta. A gente assume esse risco porque acredita no trabalho que faz. Você só paga a comissão no fechamento, e esse valor já sai do pagamento do comprador. Não tem nenhum custo inicial pro seu bolso."
  },
  {
    id: 27,
    fase: 'SDR',
    gatilhos: ["o serviço não vale isso tudo", "é dinheiro demais e não fazem nada"],
    contorno: "Faz sentido questionar! As antigas imobiliárias realmente cobravam caro pra pouco — uma foto de celular num portal e sumiam. No nosso modelo, a gente assume toda a operação: filtragem de compradores, acompanhamento jurídico, mídia profissional e gestão de todo o processo até a assinatura. Você recebe o dinheiro sem precisar se preocupar com nada pelo caminho. É exatamente isso que justifica o valor."
  },
  {
    id: 28,
    fase: 'SDR',
    gatilhos: ["estou bem com minha imobiliária", "estou feliz onde está"],
    contorno: "Que ótimo, fidelidade e bom atendimento são raros no mercado! Só uma reflexão: o fluxo de compradores qualificados está sendo constante, com gente que já tem crédito aprovado? Ou o imóvel está mais parado, esperando alguém aparecer? Pergunto porque faz diferença ter uma estratégia ativa de geração de demanda, não só uma placa no portal."
  },
  {
    id: 29,
    fase: 'SDR',
    gatilhos: ["contrato muito longo", "quero assinar por 30 meses", "prefiro tirar em 3 meses", "quero 60 dias"],
    contorno: "Entendo a preocupação! O prazo padrão de 180 dias existe por uma razão técnica: o processo de financiamento bancário sozinho costuma levar de 45 a 90 dias. Com um prazo muito curto, o comprador se sente pressionado e usa isso pra pedir desconto. O prazo mais longo protege o seu preço. Mas vou deixar essa questão anotada pra o nosso consultor humano conversar com você diretamente, tudo bem?"
  },
  {
    id: 30,
    fase: 'SDR',
    gatilhos: ["não acho que a venda vá andar mais rápido", "tudo balela", "não adianta nada centralizar"],
    contorno: "Respeito o ceticismo! Mas a diferença do nosso modelo é justamente essa: a gente não espera o comprador aparecer — a gente vai atrás. Mídia paga, rede de corretores ativa e qualificação dos interessados antes da visita. O resultado é que o imóvel recebe mais propostas ao mesmo tempo, o que cria disputa entre compradores e mantém o preço lá em cima. Não é promessa, é o processo que a gente executa."
  },
  {
    id: 31,
    fase: 'SDR',
    gatilhos: ["já gastei tempo e dinheiro", "reforma", "não quero despender mais nada"],
    contorno: "Faz total sentido não querer gastar mais depois de tudo que já investiu! E é exatamente por isso que o nosso modelo encaixa aqui: você não investe mais nada. A gente banca toda a divulgação e gestão. O objetivo é justamente resgatar esse investimento que você já fez, vendendo pelo valor que o imóvel merece. Você descansa, a gente trabalha."
  },
  {
    id: 32,
    fase: 'SDR',
    gatilhos: ["não vou assinar agora", "não quero fechar", "tô resistente ao contrato"],
    contorno: "Tudo bem, decisão nenhuma precisa ser tomada agora! Só pra eu entender melhor e poder te ajudar da forma certa: a resistência é mais em relação ao prazo do contrato, ou tem alguma dúvida sobre como funciona o repasse e a comissão? Assim eu consigo ou te esclarecer direto, ou já passo pro nosso consultor humano retomar esse ponto com você."
  },
  {
    id: 33,
    fase: 'SDR',
    gatilhos: ["não dou meu cpf pra fazer contrato pelo whatsapp", "não confio no link", "na internet não rola"],
    contorno: "Faz sentido ter esse cuidado, é um ativo importante! Só pra tranquilizar: a gente não pede dado nenhum por aqui. O contrato é assinado pela plataforma Clicksign, que é criptografada e tem validade jurídica reconhecida, integrada ao Gov.br. É o mesmo padrão que bancos e cartórios usam. Mas se preferir assinar pessoalmente, também conseguimos agendar. Como você prefere?"
  },
  {
    id: 34,
    fase: 'SDR',
    gatilhos: ["exclusividade não", "autorização não quero amarras", "não de novo exclusividade"],
    contorno: "Entendo muito bem! A palavra 'exclusividade' ficou marcada como sinônimo de imóvel parado na gaveta de um único corretor. O que a gente faz é diferente: o contrato de gestão existe pra proteger o processo juridicamente e garantir que a gente possa investir em mídia com segurança. Na prática, o imóvel fica disponível pra toda a rede de corretores da cidade vender. Não é fechar pra um só — é abrir com organização."
  },
  {
    id: 35,
    fase: 'SDR',
    gatilhos: ["vou ver e te aviso", "deixa eu analisar fds", "pensar sobre", "falo amanhã"],
    contorno: "Claro, sem pressão! Decisão assim merece ser pensada com calma, às vezes até conversar com a família antes. Só pra eu organizar melhor: a dúvida que ficou é mais em relação ao prazo do contrato ou à parte financeira da comissão? Assim eu já deixo as informações certas preparadas pra quando você voltar."
  }
];