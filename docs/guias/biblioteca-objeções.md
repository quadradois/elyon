# Biblioteca de Objeções — ELYON
> Formato padronizado para integração nos agentes Opener, Presenter e Closer  
> Total: 35 objeções mapeadas

---

## Como usar este documento

Cada objeção segue o padrão:
- **Objeção** — o que o proprietário diz (ou sinaliza)
- **Contorno** — como o agente deve responder (tom WhatsApp, direto, sem jargão)
- **Fase** — em qual agente essa objeção aparece

> ⚠️ **Nota para o dev:** estas objeções devem ser divididas por agente na hora de popular o `buscarTaticaCaptacaoTool`. O campo `fase` indica exatamente qual agente deve ter acesso a cada objeção.

---

## OPENER — Objeções de Abertura e Prioridade

Estas objeções aparecem antes ou durante o meio campo, quando o proprietário ainda está decidindo se quer conversar.

---

**Objeção 1**
> *"Não tenho pressa para vender."*

**Contorno:**
Faz sentido! Sem pressa dá pra fazer isso do jeito certo e garantir um valor melhor. Posso só entender melhor o seu imóvel pra ver se faz sentido conversarmos?

**Fase:** Opener — Meio Campo

---

**Objeção 2**
> *"Quero esperar o mercado melhorar."*

**Contorno:**
Entendo! A gente pode deixar tudo preparado enquanto espera — quando o mercado virar, você já tá na frente. Faz sentido?

**Fase:** Opener — Meio Campo

---

**Objeção 3**
> *"Estou considerando outras opções."*

**Contorno:**
Claro, faz sentido avaliar tudo. Posso te mostrar em 2 minutos como a gente trabalha diferente? Aí você decide com mais informação.

**Fase:** Opener — Meio Campo

---

**Objeção 4**
> *"Não acho que agora seja um bom momento."*

**Contorno:**
Entendo! Posso fazer uma análise rápida do mercado pra você ver se faz sentido agora ou planejar pro futuro. Te ajuda?

**Fase:** Opener — Meio Campo

---

**Objeção 5**
> *"Estou preocupado com o processo de venda."*

**Contorno:**
Faz total sentido essa preocupação. A gente cuida de tudo — avaliação, fotos, visitas, negociação. Você não precisa se preocupar com nada. Posso te explicar como funciona?

**Fase:** Opener — Meio Campo

---

**Objeção 6**
> *"Já estou trabalhando com outra imobiliária."*

**Contorno:**
Que ótimo que já tá movimentando! Há quanto tempo tá anunciado? Tá recebendo visitas?

> 💡 **Nota:** não confrontar diretamente. Usar a resposta para identificar insatisfação e abrir caminho para o Presenter.

**Fase:** Opener — Descoberta

---

**Objeção 7**
> *"Prefiro esperar para ver como o mercado evolui."*

**Contorno:**
Com certeza! Posso te mandar análises periódicas do mercado pra você acompanhar. Enquanto isso, você toparia a gente só entender melhor o seu imóvel?

**Fase:** Opener — Meio Campo

---

**Objeção 8**
> *"Já tive uma experiência ruim com outra imobiliária."*

**Contorno:**
Sinto muito, isso é frustrante demais. O que aconteceu? Ficou sem retorno, sem visitas?

> 💡 **Nota:** usar a resposta como dor para o SPIN do Presenter. Não fazer pitch ainda.

**Fase:** Opener — Descoberta

---

**Objeção 9**
> *"Não acho que meu imóvel precise de tanta divulgação."*

**Contorno:**
Entendo! Mas imóvel bem apresentado e com mais visibilidade vende mais rápido e por um valor melhor. Posso te mostrar um exemplo rápido?

**Fase:** Opener — Descoberta

---

**Objeção 10**
> *"Como você conseguiu meu número?"*

**Contorno:**
Seu contato chegou por uma lista de proprietários da região. Sem compromisso nenhum! Posso continuar? 😊

**Fase:** Opener — Protocolo de Desconfiança

---

**Objeção 11**
> *"Não tenho interesse."* / *"Para de me mandar mensagem."*

**Contorno:**
Desculpa o incômodo! Não vou mais entrar em contato. Boa semana! 🙏

> 💡 **Nota:** chamar `registrarOptoutTool` imediatamente. Não insistir.

**Fase:** Opener — Protocolo de Recuo

---

## PRESENTER — Objeções de Apresentação e Método

Estas objeções aparecem durante o diagnóstico SPIN ou na apresentação das 5 etapas, quando o proprietário questiona o modelo de trabalho.

---

**Objeção 12**
> *"Eu já tenho um corretor de confiança."*

**Contorno:**
Faz sentido ter alguém de confiança! Me conta: esse corretor tá anunciando em quantos portais? Tá tendo retorno frequente pra você?

> 💡 **Nota:** não atacar o corretor. Identificar a dor por trás (falta de retorno, pouca visibilidade) e usar no SPIN.

**Fase:** Presenter — Diagnóstico SPIN

---

**Objeção 13**
> *"Não vejo necessidade de usar inteligência artificial para avaliar meu imóvel."*

**Contorno:**
Faz sentido questionar! A IA não substitui a experiência — ela garante que o preço que a gente sugere tá alinhado com o mercado real, sem subvalorizar nem espantar comprador. Faz diferença na prática.

**Fase:** Presenter — Apresentação (Etapa 3)

---

**Objeção 14**
> *"Prefiro não investir em fotos profissionais ou vídeos aéreos."*

**Contorno:**
Entendo! E o melhor: esses serviços já estão inclusos na nossa taxa, você não paga a mais por isso. Imóvel com foto profissional vende em média 40% mais rápido. Vale a pena usar, né?

**Fase:** Presenter — Apresentação (Etapa 3)

---

**Objeção 15**
> *"Não gosto da ideia de compartilhar a venda com tantos corretores."*

**Contorno:**
Entendo a preocupação! A diferença é que com a gente não é bagunça — é uma rede organizada e coordenada pela nossa equipe. Preço único, material padrão, só a gente negocia. Faz sentido?

**Fase:** Presenter — Apresentação (Etapa 3)

---

**Objeção 16**
> *"Já tive experiências negativas com gestão de venda de imóveis."*

**Contorno:**
Que situação chata, sinto muito. O que aconteceu? Ficou sem retorno, o imóvel ficou parado?

> 💡 **Nota:** amplificar a dor para o SPIN. Não defender o setor.

**Fase:** Presenter — Diagnóstico SPIN

---

**Objeção 17**
> *"Não estou convencido de que vender mais rápido é melhor pra mim."*

**Contorno:**
Faz sentido! Vender rápido não significa vender barato — pelo contrário. Imóvel parado por muito tempo queima o preço no mercado. A ideia é vender rápido e pelo melhor valor. Faz diferença pra você?

**Fase:** Presenter — Apresentação (Etapa 4)

---

**Objeção 18**
> *"Prefiro controlar o processo de venda do meu imóvel."*

**Contorno:**
Com certeza, e você vai continuar no controle! A gente cuida do operacional — fotos, visitas, filtragem de propostas. Você só decide na hora certa. Como soa isso pra você?

**Fase:** Presenter — Apresentação (Etapa 4)

---

**Objeção 19**
> *"Meu imóvel é único e precisa de uma abordagem personalizada."*

**Contorno:**
Concordo 100%! Por isso antes de qualquer coisa a gente faz um diagnóstico completo do imóvel. Cada estratégia é montada do zero pro perfil específico do imóvel. Posso te mostrar como isso funciona na prática?

**Fase:** Presenter — Apresentação (Etapa 2)

---

**Objeção 20**
> *"Quanto custa?" / "Qual a taxa de vocês?"* *(perguntado no meio da apresentação)*

**Contorno:**
Taxa padrão de 6%, só paga quando a gente vender — zero custo antes disso. Posso continuar te explicando o que tá incluso nessa taxa?

> 💡 **Nota:** responder de forma objetiva e pedir para continuar de onde parou. Nunca pedir para esperar.

**Fase:** Presenter — Qualquer etapa da apresentação

---

**Objeção 21**
> *"Comunicação fragmentada — tenho muitos corretores e ninguém me dá retorno."*

**Contorno:**
Isso é exatamente o que a gente resolve. Com a ELYON você tem um único ponto de contato — nossa equipe. A gente coordena todos os parceiros e você recebe atualização direto pelo celular. Faz diferença?

**Fase:** Presenter — Diagnóstico SPIN (Trilha A)

---

**Objeção 22**
> *"Prefiro continuar tentando sozinho antes de contratar alguém."*

**Contorno:**
Faz sentido querer tentar! Me conta: quando aparecer um interessado, você vai qualificar o crédito dele? Acompanhar a documentação? É bastante coisa pra gerenciar sozinho.

**Fase:** Presenter — Diagnóstico SPIN (Trilha B)

---

## CLOSER — Objeções de Fechamento

Estas objeções aparecem quando o proprietário já entendeu o modelo mas resiste a assinar o contrato ou formalizar.

---

**Objeção 23**
> *"Acho 6% muito alto."*

**Contorno:**
Entendo! Essa taxa cobre fotos profissionais, drone, 12+ portais, jurídico e nossa rede inteira de parceiros — tudo sem custo inicial. E só paga se vender. O que costuma acontecer é que o imóvel vende por um valor acima do esperado, o que mais que compensa. Faz sentido?

**Fase:** Closer — Fechamento (Phase 3)

---

**Objeção 24**
> *"Vi outras imobiliárias com taxas mais baixas."*

**Contorno:**
Faz sentido comparar! A diferença é que imobiliária tradicional anuncia e espera. A gente compartilha o imóvel com todos os corretores e imobiliárias parceiras da cidade, produz material profissional e gerencia tudo. A taxa mais baixa geralmente vem com menos serviço e mais tempo parado.

**Fase:** Closer — Fechamento (Phase 3)

---

**Objeção 25**
> *"Prefiro pagar uma taxa fixa."*

**Contorno:**
Entendo! A vantagem da porcentagem é que a gente só ganha se você ganhar — isso nos deixa 100% motivados a vender pelo melhor preço possível. Taxa fixa não tem esse alinhamento.

**Fase:** Closer — Fechamento (Phase 3)

---

**Objeção 26**
> *"Não posso pagar essa taxa agora."*

**Contorno:**
Boa notícia: você não paga nada agora. A taxa só vem na conclusão da venda. Hoje é só assinar o contrato de consultoria — zero custo.

**Fase:** Closer — Fechamento (Phase 3)

---

**Objeção 27**
> *"Não vejo como esses serviços justificam a taxa."*

**Contorno:**
Justo questionar! Quer que eu te mostre o que cada serviço custaria separado? Só as fotos profissionais são R$ 400, os portais R$ 800/mês, o jurídico R$ 600. Na nossa taxa tudo isso já tá incluso, sem pagar antes.

**Fase:** Closer — Fechamento (Phase 3)

---

**Objeção 28**
> *"Estou satisfeito com minha imobiliária atual."*

**Contorno:**
Que ótimo! Há quanto tempo o imóvel tá anunciado com eles? Tá tendo muitas visitas?

> 💡 **Nota:** se o lead revelar insatisfação na resposta (pouco retorno, imóvel parado), usar como dor. Se realmente satisfeito, respeitar e propor acompanhamento futuro.

**Fase:** Closer — Fechamento (Phase 2)

---

**Objeção 29**
> *"Prefiro um contrato mais curto."*

**Contorno:**
Entendo! Nosso contrato padrão é de 180 dias porque é o tempo médio pra uma venda bem feita. Mas posso conversar com a equipe sobre condições. O que te faria se sentir mais confortável?

**Fase:** Closer — Fechamento (Phase 3)

---

**Objeção 30**
> *"Não estou convencido de que vai acelerar a venda."*

**Contorno:**
Faz sentido querer provas! A combinação de rede de parceiros + material profissional + gestão ativa costuma reduzir bastante o tempo médio de venda. Posso te mostrar alguns casos de imóveis com perfil parecido com o seu?

**Fase:** Closer — Fechamento (Phase 2)

---

**Objeção 31**
> *"Já investi bastante no imóvel e não quero gastar mais."*

**Contorno:**
Faz total sentido proteger o que você já investiu! Por isso mesmo a taxa é só no sucesso — você não desembolsa nada antes da venda. E o objetivo é justamente recuperar esse investimento vendendo pelo melhor preço.

**Fase:** Closer — Fechamento (Phase 3)

---

**Objeção 32**
> *"Não quero me comprometer com um contrato agora."*

**Contorno:**
Entendo a resistência! O que te faz hesitar — é o prazo, a exclusividade, ou outra coisa? Me conta pra eu entender melhor.

> 💡 **Nota:** identificar a objeção real antes de tentar contornar. Nunca pressionar.

**Fase:** Closer — Fechamento (Phase 2)

---

**Objeção 33**
> *"Não vou passar meu CPF pelo WhatsApp."*

**Contorno:**
Faz todo sentido ter esse cuidado! Posso te mandar o link do contrato digital — você preenche seus dados diretamente na plataforma segura, sem precisar passar nada por aqui. Te mando agora?

**Fase:** Closer — Fechamento (Phase 3)

---

**Objeção 34**
> *"Não quero dar exclusividade pra ninguém."*

**Contorno:**
Entendo perfeitamente! E não é exclusividade. Me diz: dos corretores que têm seu imóvel hoje, quantos te ligaram essa semana pra dar retorno? Com nosso Contrato de Consultoria sua rede trabalha de forma coordenada — não é bloquear, é organizar. Faz sentido?

**Fase:** Closer — Fechamento (Phase 2)

---

**Objeção 35**
> *"Vou pensar e te retorno."*

**Contorno:**
Tranquilo! Só me ajuda a entender: o que te faz querer pensar? É a comissão, o prazo ou outra coisa? Só pra eu poder te ajudar melhor quando você retornar.

> 💡 **Nota:** se não responder, chamar `agendarFollowupTool` com 5 dias.

**Fase:** Closer — Fechamento (Phase 2 / Phase 3)

---

## Resumo por Agente

| Agente | Qtd. Objeções | IDs |
|--------|--------------|-----|
| Opener | 11 | 1 a 11 |
| Presenter | 11 | 12 a 22 |
| Closer | 13 | 23 a 35 |
| **Total** | **35** | — |

---

## Objeções que transitam entre agentes

Algumas objeções podem aparecer em mais de uma fase. Nesses casos, o contorno muda conforme o contexto:

| Objeção | Opener | Presenter | Closer |
|---------|--------|-----------|--------|
| "Já tenho imobiliária" | Descobrir há quanto tempo, quantas visitas | Identificar dores (retorno, visibilidade) | Reframe: rede organizada vs. desorganizada |
| "Tive experiência ruim" | Abrir escuta, não fazer pitch | Amplificar como dor para o SPIN | Usar como argumento de diferenciação |
| "Não tenho pressa" | Sondar interesse futuro | Criar urgência via custo de espera | Fechar com foco no melhor momento, não na urgência |
| "Prefiro tentar sozinho" | Redirecionar para o processo | Questionar capacidade de gestão solo | Propor teste de 30 dias sem risco |

---

*Biblioteca de Objeções v1.0 | ELYON | 2026*
