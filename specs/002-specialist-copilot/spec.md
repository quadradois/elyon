# Especificação da Feature: Copilot de Agenda do Especialista

**Branch**: `codex/specialist-copilot`
**Criada em**: 2026-08-03
**Status**: Em especificação
**Entrada**: Transformar o convite de confirmação enviado ao especialista em uma conversa de WhatsApp com o Elyon, preservando o link atual como fallback e cobrindo confirmação, recusa, contraproposta, substituição, cancelamento e lembretes.

## Objetivo de negócio

Permitir que o especialista administre solicitações de atendimento pelo próprio WhatsApp, em linguagem natural, com o Elyon atuando como concierge. O fluxo deve reduzir o tempo de confirmação para o lead, evitar páginas externas como caminho principal e manter toda mudança de agenda determinística, autorizada e auditável.

## Escopo

### Incluído

- Convite contextual e personalizado para o especialista pelo WhatsApp.
- Identificação segura do especialista pelo telefone cadastrado e pelo tenant da sessão.
- Consulta de detalhes necessários da solicitação: lead, data, horário, modalidade, imóvel e resumo do atendimento.
- Confirmação, recusa, indicação de indisponibilidade e contraproposta de data/horário.
- Negociação da contraproposta com o lead antes de alterar o compromisso.
- Encaminhamento ao especialista fallback quando o principal recusar ou não responder no prazo.
- Cancelamento da participação do especialista com tentativa de substituição antes de cancelar o atendimento do lead.
- Consulta, pelo especialista, de suas solicitações e compromissos acionáveis.
- Lembretes próximos do horário para especialista e lead.
- Manutenção do link de confirmação como fallback operacional.
- Auditoria, idempotência, isolamento por tenant e observabilidade do fluxo.

### Fora do escopo

- Sincronização com a agenda pessoal de cada especialista.
- Substituição da conta central `quadradoisgo@gmail.com` por calendários individuais.
- Atendimento inbound comercial geral de leads; o canal inbound do especialista é restrito à operação de agenda.
- Exposição de CPF, dados completos de proprietário ou outras informações sensíveis no convite.
- Um Copilot geral para atividades não relacionadas à agenda.

## Atores

- **Lead**: solicita, aceita ou recusa horários e recebe confirmações e lembretes.
- **Especialista principal**: recebe a primeira solicitação e pode confirmar, recusar ou propor alternativa.
- **Especialista fallback**: recebe a solicitação quando a regra de substituição for acionada.
- **Administrador do tenant**: cadastra responsáveis, fallback, telefones e políticas aplicáveis.
- **Elyon**: interpreta a intenção, consulta o estado atual e executa somente comandos determinísticos permitidos.

## Jornadas e testes de aceitação

### História 1 — Responder ao convite pelo WhatsApp (Prioridade P1)

Como especialista, quero responder naturalmente ao convite recebido para confirmar ou recusar sem abrir uma página externa.

**Valor independente**: elimina a principal fricção da experiência atual e reduz o tempo até a confirmação do lead.

**Cenários de aceitação**:

1. **Dado** um especialista ativo, com telefone cadastrado no mesmo tenant e uma solicitação pendente, **quando** ele responder “pode confirmar”, **então** o Elyon confirma exatamente essa solicitação, registra autoria e horário e notifica o lead.
2. **Dado** o mesmo contexto, **quando** ele responder “não consigo atender”, **então** o Elyon registra a recusa e aciona a regra de fallback sem afirmar ao lead que o atendimento foi cancelado.
3. **Dado** um convite, **quando** ele for enviado, **então** contém nome do especialista, nome do lead, data, horário, modalidade, imóvel quando conhecido, resumo útil da conversa e instruções naturais; o link aparece apenas como alternativa.
4. **Dado** um remetente não cadastrado como especialista naquele tenant, **quando** tentar confirmar uma solicitação, **então** nenhuma informação privilegiada é exposta e nenhum estado é alterado.

### História 2 — Contrapropor um horário (Prioridade P1)

Como especialista indisponível no horário solicitado, quero sugerir outra data ou horário para que o Elyon negocie com o lead sem perder o atendimento.

**Valor independente**: transforma recusas em alternativas e reduz abandono.

**Cenários de aceitação**:

1. **Dado** um convite pendente, **quando** o especialista disser “posso amanhã às 10h”, **então** o Elyon valida disponibilidade e envia a proposta ao lead, mantendo o agendamento original inalterado enquanto aguarda resposta.
2. **Dado** que o lead aceita a contraproposta, **quando** a aceitação for registrada, **então** o sistema substitui o horário de forma atômica, invalida convites antigos e envia a confirmação adequada às partes.
3. **Dado** que o lead recusa a contraproposta, **quando** a recusa for registrada, **então** o Elyon mantém o estado anterior válido e busca nova alternativa ou fallback, sem confirmar horário inexistente.
4. **Dado** um horário indisponível, **quando** o especialista o propuser, **então** o Elyon informa a indisponibilidade e oferece opções válidas, sem criar conflito.

### História 3 — Tratar ambiguidade e múltiplas solicitações (Prioridade P1)

Como especialista com mais de uma solicitação, quero que o Elyon identifique a correta antes de executar minha resposta.

**Valor independente**: impede alterações no lead ou horário errado.

**Cenários de aceitação**:

1. **Dado** apenas um convite acionável no contexto do especialista, **quando** ele responder, **então** essa solicitação é selecionada sem pergunta redundante.
2. **Dado** mais de um convite acionável, **quando** a resposta não identificar um deles, **então** o Elyon apresenta opções mínimas para desambiguação e não altera nenhuma solicitação.
3. **Dado** um telefone que também existe como lead, **quando** houver contexto ativo de convite de especialista, **então** a mensagem é tratada no contexto de especialista; sem contexto suficiente, o sistema pede desambiguação e não assume o papel.
4. **Dado** um convite expirado, cancelado, substituído ou concluído, **quando** chegar uma resposta tardia, **então** o Elyon consulta o estado real, explica que a ação não é mais válida e não reabre o compromisso silenciosamente.

### História 4 — Substituir especialista sem criar gargalo (Prioridade P2)

Como administrador, quero que recusas, silêncio e cancelamentos do especialista acionem o fallback para preservar o compromisso do lead.

**Valor independente**: assegura continuidade operacional sem depender de intervenção manual imediata.

**Cenários de aceitação**:

1. **Dado** que o principal não responde dentro do prazo configurado, **quando** o prazo expira, **então** o convite do principal deixa de ser acionável e uma nova tentativa é enviada ao fallback.
2. **Dado** que o principal recusa, **quando** existe fallback elegível, **então** o fallback recebe novo convite com novo prazo e o lead não recebe mensagem de cancelamento prematura.
3. **Dado** que um especialista já confirmado cancela sua participação, **quando** há substituto elegível, **então** o sistema tenta a substituição e informa o lead apenas na medida necessária.
4. **Dado** que nenhum especialista aceita, **quando** as opções se esgotam, **então** o lead é informado com semântica correta e recebe uma proposta de novo horário ou encaminhamento humano.

### História 5 — Lembrar as partes no momento adequado (Prioridade P2)

Como participante, quero receber lembrete antes do atendimento para reduzir faltas.

**Valor independente**: melhora comparecimento mesmo sem integração com calendários pessoais.

**Cenários de aceitação**:

1. **Dado** um atendimento confirmado e ainda futuro, **quando** faltar aproximadamente 60 minutos, **então** especialista e lead recebem um único lembrete com modalidade e horário corretos.
2. **Dado** um atendimento cancelado, substituído ou reagendado, **quando** chegar o momento do lembrete antigo, **então** nenhuma mensagem obsoleta é enviada.
3. **Dado** atraso ou repetição do job, **quando** o lembrete for processado novamente, **então** a deduplicação impede mensagem duplicada.
4. **Dado** que o canal está desconectado, **quando** o envio falhar, **então** a falha é registrada de modo acionável sem marcar o lembrete como entregue.

### História 6 — Consultar e operar a própria agenda (Prioridade P3)

Como especialista, quero perguntar “quais atendimentos tenho amanhã?” ou “qual é o imóvel da Ivonet?” para obter contexto sem acessar outra tela.

**Valor independente**: consolida o Elyon como Copilot cotidiano do especialista.

**Cenários de aceitação**:

1. **Dado** um especialista autenticado pelo telefone e tenant, **quando** consultar sua agenda, **então** recebe apenas solicitações e compromissos em que é responsável atual.
2. **Dado** uma consulta de detalhes, **quando** o imóvel ou resumo não estiver disponível, **então** o Elyon informa a ausência sem inventar dados.
3. **Dado** uma tentativa de consultar agenda de outro especialista, **quando** não houver autorização administrativa explícita, **então** o acesso é negado e auditado.

## Requisitos funcionais

- **RF-001**: O sistema deve reconhecer uma mensagem de especialista somente após resolver sessão, tenant, usuário ativo e telefone normalizado no servidor.
- **RF-002**: O roteamento do especialista deve ocorrer antes do roteamento de lead quando existir contexto operacional acionável, sem permitir colisão silenciosa de papéis.
- **RF-003**: Toda mensagem deve ser associada a uma solicitação específica antes de qualquer alteração de estado.
- **RF-004**: O convite deve apresentar apenas os dados necessários: especialista, lead, data, horário, modalidade, identificação do imóvel disponível e resumo operacional da conversa.
- **RF-005**: O convite não deve incluir CPF, credenciais, segredos ou dados pessoais desnecessários; o único token permitido é o opaco já contido no link público de fallback exigido pelo RF-006.
- **RF-006**: O link público atual deve permanecer disponível como fallback durante o rollout e produzir o mesmo estado final das respostas pelo WhatsApp.
- **RF-007**: O especialista deve poder confirmar, recusar, indicar indisponibilidade, sugerir horário, cancelar sua participação e consultar solicitações por linguagem natural.
- **RF-008**: A interpretação em linguagem natural não deve alterar dados diretamente; toda mutação deve passar por comandos determinísticos com validação de estado, autorização e tenant.
- **RF-009**: Respostas duplicadas, reentregas de webhook e cliques concorrentes no link devem ser idempotentes.
- **RF-010**: Uma contraproposta do especialista deve ser validada quanto à disponibilidade e aceita explicitamente pelo lead antes de substituir data ou horário.
- **RF-011**: Enquanto uma contraproposta aguarda o lead, o sistema deve preservar o compromisso anterior e identificar claramente os estados de proposta e confirmação.
- **RF-012**: Recusa, expiração ou cancelamento de participação deve acionar o próximo especialista elegível conforme a campanha antes de cancelar o atendimento do lead.
- **RF-013**: Cada novo convite deve invalidar tokens e contextos substituídos para impedir ações tardias sobre versões antigas.
- **RF-014**: Se houver múltiplas solicitações acionáveis, o sistema deve desambiguar usando lead, data e horário antes de executar a ação.
- **RF-015**: O sistema deve enviar notificações ao lead com semântica coerente com o estado: solicitação registrada, proposta, confirmação, substituição, cancelamento ou falha de alocação.
- **RF-016**: O sistema deve enviar lembrete único ao lead e ao especialista aproximadamente 60 minutos antes de atendimento confirmado.
- **RF-017**: Lembretes devem ser cancelados ou recalculados automaticamente após cancelamento, reagendamento ou substituição.
- **RF-018**: Toda decisão e efeito deve registrar tenant, solicitação, ator, canal, intenção reconhecida, comando executado, resultado e correlação, sem registrar conteúdo sensível desnecessário.
- **RF-019**: O sistema deve possuir estados terminais e política de retry para mensagens, convites, propostas e lembretes.
- **RF-020**: O administrador deve continuar definindo especialista principal e fallback na campanha; a feature não deve introduzir responsável global hardcoded.
- **RF-021**: Consultas do especialista devem retornar apenas compromissos atribuídos a ele no tenant corrente.
- **RF-022**: A indisponibilidade do modelo de linguagem não deve impedir confirmações simples; intenções essenciais devem possuir tratamento determinístico de contingência.
- **RF-023**: A ativação deve ser controlável por tenant e permitir retorno imediato ao fluxo atual baseado em link.

## Entidades de negócio

- **Solicitação de atendimento**: compromisso solicitado pelo lead, com data, modalidade, estado e responsável corrente.
- **Convite do especialista**: tentativa versionada de obter decisão de um especialista, com prazo, estado e canal.
- **Contexto de conversa do especialista**: vínculo temporário entre telefone, tenant e solicitações acionáveis.
- **Contraproposta**: alternativa de data/horário proposta por uma parte, aguardando decisão da outra.
- **Participação do especialista**: atribuição atual ou histórica do especialista a uma solicitação.
- **Notificação/Lembrete**: comunicação deduplicada associada a evento e destinatário.
- **Evento de auditoria**: registro imutável da intenção, autorização, transição e resultado.

## Regras de estado

- Confirmação só é válida para convite pendente, dentro do prazo e ainda associado ao responsável corrente.
- Recusa e expiração encerram a tentativa atual; nunca podem encerrar silenciosamente o atendimento enquanto houver fallback elegível.
- Contraproposta não equivale a reagendamento nem a confirmação.
- Reagendamento só ocorre depois da aceitação explícita do lead e de nova validação de disponibilidade.
- Cancelar a participação do especialista é diferente de cancelar o atendimento do lead.
- Eventos terminais não podem ser revertidos por mensagem ou link atrasado sem uma nova solicitação explícita.

## Casos-limite

- Especialista responde apenas “sim”, “não” ou com áudio/transcrição fora da janela do convite.
- Duas mensagens chegam quase simultaneamente pelo WhatsApp e pela página de confirmação.
- Principal e fallback respondem ao mesmo compromisso após uma troca de responsável.
- Mesmo telefone pertence a usuários diferentes em tenants diferentes.
- Telefone do especialista está ausente, duplicado ou inativo.
- Imóvel ou resumo não existe no contexto da campanha.
- Lead aceita contraproposta depois que o horário deixou de estar disponível.
- O atendimento ocorre em menos tempo que o prazo normal de confirmação ou do lembrete.
- WhatsApp fica desconectado durante convite, fallback ou lembrete.
- Alteração de horário ocorre enquanto um job de lembrete está em execução.

## Premissas

- A sessão WhatsApp que recebe a resposta permite identificar de forma confiável o tenant.
- Especialistas principais e fallback possuem telefone único, normalizado e ativo no tenant.
- O resumo já produzido no agendamento pode ser reutilizado, sujeito a limite e sanitização.
- O imóvel é obtido do contexto existente do lead/campanha quando disponível; sua ausência não bloqueia a agenda.
- O prazo inicial de confirmação permanece configurável, com valor piloto de 60 minutos.
- O lembrete inicial do piloto será enviado aproximadamente 60 minutos antes; lembretes adicionais poderão ser calibrados depois.

## Critérios de sucesso mensuráveis

- **CS-001**: Pelo menos 95% das decisões simples do piloto (confirmar ou recusar) podem ser concluídas no WhatsApp sem abrir o link.
- **CS-002**: Uma confirmação válida é refletida no estado e reconhecida às partes em até 10 segundos no percentil 95, descontada indisponibilidade do provedor.
- **CS-003**: 100% das contrapropostas que alteram horário possuem aceite explícito do lead registrado.
- **CS-004**: Testes de reentrega e concorrência não produzem transição duplicada nem notificações finais contraditórias.
- **CS-005**: 100% dos efeitos de agenda possuem trilha de auditoria com tenant, ator, solicitação e resultado.
- **CS-006**: Nenhuma consulta ou ação dos testes negativos atravessa a fronteira do tenant ou expõe agenda de outro especialista.
- **CS-007**: Pelo menos 95% dos lembretes elegíveis são enviados uma única vez dentro de uma janela de 5 minutos do horário planejado quando o canal está conectado.
- **CS-008**: O especialista conclui confirmação, recusa ou contraproposta em no máximo três mensagens após o convite, salvo desambiguação necessária.

## Estratégia de rollout e rollback

- Ativar primeiro no tenant piloto por configuração.
- Manter o link atual funcional e visível como alternativa durante todo o piloto.
- Medir respostas reconhecidas, ambiguidades, tempo de decisão, fallbacks, falhas e ações tardias.
- Permitir desativação do roteamento conversacional sem migrar ou perder solicitações existentes.
- Não remover contratos, rotas ou campos atuais nesta entrega.
