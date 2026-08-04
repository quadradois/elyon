# Checklist de qualidade da especificação — Copilot de Agenda do Especialista

## Conteúdo

- [x] Não contém detalhes de implementação que limitem antecipadamente a solução.
- [x] Está centrada em valor para especialista, lead e operação.
- [x] Todas as seções obrigatórias estão preenchidas.
- [x] Escopo e itens fora do escopo estão explícitos.

## Completude dos requisitos

- [x] Não restam marcadores de esclarecimento.
- [x] Requisitos são testáveis e não ambíguos.
- [x] Critérios de sucesso são mensuráveis e independentes de tecnologia.
- [x] Cenários de aceitação cobrem os fluxos principais.
- [x] Casos-limite e concorrência foram identificados.
- [x] Entidades e diferenças semânticas de estado foram definidas.
- [x] Premissas e dependências estão explícitas.

## Constituição do ELYON

- [x] Isolamento por tenant e testes negativos são obrigatórios.
- [x] Contratos atuais permanecem retrocompatíveis durante o rollout.
- [x] Mutação externa exige comandos determinísticos e idempotência.
- [x] Auditoria e privacidade foram incorporadas aos requisitos.
- [x] Jobs definem retry, deduplicação e estado terminal.
- [x] Rollout e rollback preservam o fluxo atual baseado em link.

## Validação

- [x] O convite conversacional não depende de calendário pessoal do especialista.
- [x] Contraproposta só altera o horário após aceite explícito do lead.
- [x] Cancelamento da participação do especialista não é confundido com cancelamento do lead.
- [x] Múltiplos convites exigem desambiguação antes de qualquer efeito.
- [x] Dados sensíveis não são incluídos no convite.
