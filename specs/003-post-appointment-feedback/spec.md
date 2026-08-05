# Feature Specification: Feedback Pós-Atendimento

**Feature Branch**: `codex/post-appointment-feedback`

**Created**: 2026-08-05

**Status**: Draft

**Input**: Após um atendimento agendado, solicitar ao especialista pelo WhatsApp a confirmação do desfecho e um breve resumo, registrando os dados na Agenda e na ficha do lead sem presumir ausência automaticamente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar o desfecho pelo WhatsApp (Priority: P1)

Como especialista, quero receber uma pergunta objetiva após o horário do compromisso e responder em linguagem natural se o atendimento ocorreu, se alguém não compareceu ou se é necessário reagendar.

**Why this priority**: O retorno do especialista transforma uma presunção operacional em um desfecho declarado e auditável, eliminando baixas incorretas.

**Independent Test**: Agendar uma ligação, avançar o relógio até vinte minutos depois, receber a pergunta e responder que o atendimento ocorreu; a Agenda deve ser concluída sem interação manual no painel.

**Acceptance Scenarios**:

1. **Given** uma ligação confirmada cujo horário passou há vinte minutos, **When** o especialista ainda não informou o resultado, **Then** ele recebe uma única solicitação de feedback com lead, horário, imóvel e opções de resposta.
2. **Given** uma solicitação pendente, **When** o especialista responde que o atendimento ocorreu, **Then** o compromisso é marcado como realizado e o autor e horário da resposta ficam auditados.
3. **Given** uma solicitação pendente, **When** o especialista informa que o lead não atendeu, **Then** o compromisso é encerrado como não comparecimento do lead, sem atribuir ausência ao especialista.
4. **Given** uma solicitação pendente, **When** o especialista informa que ele próprio não conseguiu atender, **Then** o sistema registra o motivo correto e oferece encaminhamento para reagendamento.

---

### User Story 2 - Alimentar a ficha do lead (Priority: P1)

Como gestor ou corretor, quero encontrar na ficha do lead o resumo declarado pelo especialista, o desfecho e o próximo passo, para continuar o atendimento sem reconstruir o contexto do WhatsApp.

**Why this priority**: O valor do feedback depende de transformar a conversa em memória operacional reutilizável, preservando autoria e rastreabilidade.

**Independent Test**: Responder ao feedback com um resumo e verificar que a ficha do lead mostra uma entrada cronológica contendo desfecho, resumo, especialista, data e origem.

**Acceptance Scenarios**:

1. **Given** um atendimento realizado, **When** o especialista envia uma breve descrição, **Then** a descrição é adicionada à timeline do lead sem sobrescrever dados anteriores.
2. **Given** uma resposta que menciona interesse, prazo, objeção ou próximo passo, **When** o sistema identifica esses elementos, **Then** eles são armazenados como sugestões vinculadas à entrada, sem alterar automaticamente campos críticos.
3. **Given** uma resposta que contém dado sensível, **When** ela é processada, **Then** o conteúdo é limitado ao contexto necessário e não aparece em logs operacionais.

---

### User Story 3 - Tratar ausência de resposta (Priority: P2)

Como gestor, quero que feedbacks não respondidos gerem lembrete e pendência operacional, para que nenhum compromisso fique indefinidamente sem desfecho.

**Why this priority**: O fluxo precisa falhar de forma visível e segura, sem transformar silêncio do especialista em ausência do lead.

**Independent Test**: Não responder à primeira solicitação, avançar o prazo e verificar um único lembrete seguido de uma pendência visível ao gestor, mantendo o compromisso como aguardando desfecho.

**Acceptance Scenarios**:

1. **Given** uma solicitação sem resposta, **When** decorrem duas horas do primeiro envio, **Then** o especialista recebe um único lembrete idempotente.
2. **Given** uma solicitação ainda sem resposta após vinte e quatro horas, **When** o prazo final expira, **Then** ela entra na fila operacional do gestor e não é marcada automaticamente como não comparecimento.
3. **Given** uma resposta recebida depois do lembrete, **When** ela é válida, **Then** a pendência é concluída e novos lembretes não são enviados.

### Edge Cases

- O compromisso é cancelado ou reagendado antes do disparo da pesquisa.
- O especialista responde a uma solicitação antiga quando existe outra mais recente.
- A resposta é ambígua, contém apenas saudação ou não permite identificar o desfecho.
- O webhook do WhatsApp é entregue mais de uma vez ou fora de ordem.
- O especialista possui vários compromissos recentes e não menciona qual deles está avaliando.
- O envio falha temporariamente, a instância está desconectada ou o telefone do especialista é inválido.
- O compromisso é uma visita longa e ainda está em andamento no momento em que uma ligação já seria consultada.
- O gestor corrige posteriormente um desfecho informado pelo especialista.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST criar uma solicitação de feedback somente para compromissos confirmados que chegaram ao instante configurado e ainda não possuem desfecho.
- **FR-002**: Para ligação telefônica, o instante padrão MUST ser vinte minutos após o horário inicial; para reunião ou visita, MUST ser quinze minutos após o término previsto.
- **FR-003**: Cada compromisso MUST possuir no máximo uma solicitação ativa e cada disparo ou resposta MUST ser idempotente.
- **FR-004**: A mensagem MUST identificar lead, horário, modalidade e imóvel quando disponível, oferecendo respostas curtas e aceitando linguagem natural.
- **FR-005**: O sistema MUST reconhecer ao menos: realizado, lead ausente, especialista ausente, reagendar e outro motivo.
- **FR-006**: Respostas ambíguas MUST solicitar esclarecimento sem alterar o compromisso.
- **FR-007**: Um desfecho válido MUST atualizar o ciclo de vida da Agenda usando as mesmas regras de autorização, concorrência e auditoria dos comandos atuais.
- **FR-008**: O resumo MUST ser incluído como nova entrada cronológica na ficha do lead, com especialista, data, compromisso e origem, sem sobrescrever histórico.
- **FR-009**: Informações comerciais extraídas MUST ser tratadas como sugestões; campos críticos ou sensíveis MUST exigir validação humana antes de qualquer atualização estrutural.
- **FR-010**: O primeiro lembrete MUST ocorrer duas horas após a solicitação sem resposta e MUST ser enviado no máximo uma vez.
- **FR-011**: Após vinte e quatro horas sem resposta, o sistema MUST encerrar a tentativa automática como pendência operacional visível ao gestor.
- **FR-012**: O silêncio do especialista MUST NOT marcar automaticamente lead ou especialista como não comparecimento.
- **FR-013**: Cancelamento, reagendamento ou desfecho registrado antes do envio MUST invalidar a solicitação pendente.
- **FR-014**: O sistema MUST registrar métricas de solicitações, envios, respostas, ambiguidades, atrasos, falhas e pendências, sem registrar texto integral ou dados sensíveis.
- **FR-015**: A feature MUST possuir ativação controlada por tenant e desligamento seguro sem perder o histórico já registrado.

### Key Entities

- **Solicitação de Feedback**: Acompanhamento pós-atendimento associado a um único compromisso e especialista, com instante elegível, tentativas, prazos, estado e chaves de idempotência.
- **Resposta de Feedback**: Manifestação recebida do especialista, contendo intenção reconhecida, resumo sanitizado, autoria, canal e vínculo com a solicitação.
- **Entrada da Ficha do Lead**: Registro cronológico append-only que apresenta desfecho, resumo, próximo passo sugerido e origem.
- **Pendência Operacional**: Estado terminal da automação quando não há resposta dentro do prazo, disponível para atuação do gestor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pelo menos 90% das solicitações elegíveis são enviadas em até cinco minutos do instante previsto.
- **SC-002**: O especialista consegue registrar um desfecho e um resumo em uma única resposta em pelo menos 85% dos testes de linguagem natural previstos.
- **SC-003**: Nenhum compromisso é marcado como não comparecimento exclusivamente por ausência de resposta à solicitação.
- **SC-004**: Toda resposta processada gera uma entrada auditável na ficha do lead em até um minuto.
- **SC-005**: Reentregas do mesmo webhook ou reexecuções do job não geram mensagens, desfechos ou entradas duplicadas.
- **SC-006**: Gestores conseguem identificar todas as solicitações sem resposta há mais de vinte e quatro horas em uma única fila operacional.

## Assumptions

- O especialista já possui telefone vinculado à conta e recebe mensagens pela instância WhatsApp do tenant.
- A duração existente no compromisso é usada para calcular o término; quando ausente, aplica-se o padrão atual da Agenda.
- O primeiro release reutiliza o Copilot de especialista e a ficha/timeline existentes, sem criar um aplicativo separado.
- Apenas especialistas associados ao compromisso ou gestores autorizados podem registrar ou corrigir o desfecho.
- O resumo integral é armazenado apenas no domínio do lead e não é enviado a modelos ou serviços externos além dos já autorizados pelo tenant.
- A ativação inicial ocorrerá no tenant piloto existente antes da liberação geral.
