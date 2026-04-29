# Checklist de Implementação — Handoff para Especialista por Campanha

## Contexto
- Objetivo: usar a base de corretores do `/dashboard/equipe`, definir responsável por campanha e implementar confirmação com SLA.
- Regras alinhadas:
  - Convite: `T-120`
  - Lembrete: `T-90`
  - Cutoff: `T-60`
  - Sem confirmação até `T-60`: remanejamento automático
  - Confirmação após cutoff: não reassume automaticamente

---

## Fase 0 — Definições e Contratos
- [x] **0.1 Definir estados de confirmação**
  - [x] Fechar estados: `PENDENTE`, `CONFIRMADO`, `EXPIRADO`, `REMANEJADO`, `RECUSADO`
  - [x] Fechar transições válidas entre estados
  - Critério de aceite: tabela de estados aprovada e sem ambiguidades

- [x] **0.2 Definir indisponibilidade operacional**
  - [x] Marcar como indisponível: `inativo`, `ausente manual`, `sem WhatsApp válido`
  - [x] Confirmar que horário/agenda entram na elegibilidade de agendamento
  - Critério de aceite: regras documentadas e aprovadas

### Contrato 0.1 — Estados e Transições
- `PENDENTE`: convite enviado e aguardando ação do corretor.
- `CONFIRMADO`: corretor confirmou dentro da janela válida.
- `RECUSADO`: corretor recusou/indicou ausência explicitamente.
- `EXPIRADO`: prazo de confirmação (`T-60`) passou sem confirmação.
- `REMANEJADO`: reunião atribuída a outro corretor após `RECUSADO` ou `EXPIRADO`.

Transições válidas:
- `PENDENTE -> CONFIRMADO` (confirmação no prazo)
- `PENDENTE -> RECUSADO` (recusa explícita antes do cutoff)
- `PENDENTE -> EXPIRADO` (job de cutoff em `T-60`)
- `RECUSADO -> REMANEJADO` (remanejamento imediato ou assíncrono)
- `EXPIRADO -> REMANEJADO` (remanejamento automático)

Regras complementares:
- Confirmação após `T-60` é registrada como evento tardio e não reverte automaticamente `REMANEJADO`.
- `REMANEJADO` é estado terminal da atribuição original.

### Contrato 0.2 — Indisponibilidade Operacional
Um corretor é considerado indisponível para receber/assumir handoff quando:
- `inativo` no cadastro da equipe;
- `ausente manual` habilitado;
- `sem WhatsApp válido` (campo vazio ou inválido).

Regras de operação:
- Horário comercial e disponibilidade de agenda **não** entram na indisponibilidade base do corretor.
- Horário e agenda entram na etapa de elegibilidade do slot de reunião.
- Remanejamento deve escolher primeiro corretor elegível no fallback que não esteja indisponível.

Critérios operacionais derivados:
- Se responsável da campanha estiver indisponível no momento do handoff, usar fallback imediatamente.
- Se fallback também estiver indisponível, registrar falha operacional com auditoria e alertar time.

---

## Fase 1 — Modelo de Dados
- [x] **1.1 Adicionar responsável/fallback na campanha**
  - [x] Criar `responsavelCorretorId` na `Campanha`
  - [x] Criar `fallbackCorretorId` na `Campanha`
  - [x] Adicionar índices e relações no Prisma
  - [x] Criar e aplicar migration
  - Critério de aceite: leitura/gravação funcionando via Prisma
  - Observação: migration `20260429152000_add_campanha_responsavel_fallback_corretor` aplicada no banco via Docker e marcada no histórico Prisma.

- [x] **1.2 Adicionar trilha de confirmação da reunião**
  - [x] Adicionar campos em `Atividade` (ou tabela dedicada):
    - [x] `statusConfirmacao` (`statusConfirmacaoCorretor`)
    - [x] `confirmacaoToken` (`tokenConfirmacaoCorretor`)
    - [x] `confirmacaoSolicitadaEm` (`confirmacaoCorretorSolicitadaEm`)
    - [x] `confirmadoEm` (`confirmadoCorretorEm`)
    - [x] `expiradoEm` (`expiradoCorretorEm`)
    - [x] `remanejadoEm` (`remanejadoCorretorEm`)
    - [x] `corretorOriginalId`
    - [x] `corretorAtualId`
  - [x] Criar e aplicar migration
  - Critério de aceite: estados persistidos com histórico de troca
  - Observação: migration `20260429154500_add_confirmacao_corretor_atividade` aplicada no banco via Docker e marcada no histórico Prisma.

---

## Fase 2 — Backend (API + Regras)
- [x] **2.1 Resolver especialista por campanha**
  - [x] Implementar serviço com ordem:
    - [x] `responsavelCorretorId` ativo/elegível
    - [x] `fallbackCorretorId`
    - [x] fallback do tenant (pool)
  - [x] Reusar `/dashboard/equipe` como source of truth
  - Critério de aceite: serviço retorna especialista ou erro explícito
  - Observação: serviço implementado em `src/servicos/resolucao-especialista-campanha.ts` e integrado no `encaminhar_corretor`.

- [x] **2.2 Profissionalizar handoff IA -> humano**
  - [x] Ajustar `encaminhar_corretor` para buscar especialista da campanha
  - [x] Informar nome/cargo na mensagem de transferência
  - [x] Enviar card de contato no WhatsApp
  - [x] Fallback em texto com link `wa.me` quando card falhar
  - Critério de aceite: lead recebe identificação + contato do especialista

- [x] **2.3 Criar endpoint de confirmação por token**
  - [x] Endpoint para `confirmar`
  - [x] Endpoint para `recusar/ausência`
  - [x] Garantir idempotência
  - [x] Registrar auditoria
  - Critério de aceite: link altera estado corretamente e registra trilha
  - Observação: implementado em `leads.ts` nas rotas públicas `/confirmar-corretor/:atividadeId/:token` (GET/POST), com regra de cutoff `T-60` para confirmação.

- [x] **2.4 Implementar cutoff/remanejamento**
  - [x] Expirar em `T-60`
  - [x] Remanejar automaticamente para fallback
  - [x] Marcar confirmação tardia sem reassumir automaticamente
  - Critério de aceite: pendências no cutoff nunca ficam sem dono
  - Observação: implementado em `job-confirmacao-corretor.ts` com rota operacional `/api/jobs/confirmacao-corretor/cutoff`.

---

## Fase 3 — Jobs e Orquestração Temporal
- [x] **3.1 Job de convite (T-120)**
  - [x] Selecionar reuniões elegíveis
  - [x] Enviar convite com token
  - [x] Registrar `confirmacaoSolicitadaEm`
  - Critério de aceite: envio no tempo correto e sem duplicidade

- [x] **3.2 Job de lembrete (T-90)**
  - [x] Enviar lembrete para reuniões `PENDENTE`
  - Critério de aceite: um lembrete por reunião pendente

- [x] **3.3 Job de expiração/remanejamento (T-60)**
  - [x] Expirar reuniões pendentes
  - [x] Remanejar para fallback
  - [x] Notificar corretor novo + lead
  - Critério de aceite: remanejamento automático consistente
  - Observação: rotas de execução manual adicionadas em `/api/jobs/confirmacao-corretor/{convites|lembretes|cutoff}`.

---

## Fase 4 — Frontend Operacional
- [x] **4.1 Campanha: selecionar responsável/fallback**
  - [x] Exibir seleção de responsável
  - [x] Exibir seleção de fallback
  - [x] Validar obrigatoriedade no save
  - Critério de aceite: campanha salva com roteamento válido

- [x] **4.2 Equipe: indicar elegibilidade**
  - [x] Exibir status operacional (`ativo/ausente/sem WhatsApp`)
  - [x] Bloquear ou alertar seleção inelegível
  - Critério de aceite: UI impede configuração inválida

- [x] **4.3 Painel de confirmações**
  - [x] Lista de reuniões pendentes
  - [x] Estados em tempo real (`PENDENTE`, `CONFIRMADO`, `EXPIRADO`, `REMANEJADO`)
  - Critério de aceite: operação consegue agir antes do cutoff

---

## Fase 5 — Mensageria
- [x] **5.1 Template convite**
  - [x] Mensagem com contexto + link de confirmação

- [x] **5.2 Template lembrete**
  - [x] Mensagem curta para `T-90`

- [x] **5.3 Template remanejamento**
  - [x] Mensagem ao lead com novo especialista + contato

- [x] **5.4 Aprovação de conteúdo**
  - [x] Validar tom com operação/comercial
  - Critério de aceite: templates aprovados e versionados

---

## Fase 6 — Auditoria e Métricas
- [x] **6.1 Auditoria completa**
  - [x] Logar convite, lembrete, confirmação, expiração e remanejamento

- [x] **6.2 KPIs mínimos**
  - [x] Taxa de confirmação no prazo
  - [x] Taxa de remanejamento
  - [x] Tempo médio de confirmação

- [x] **6.3 Alertas operacionais**
  - [x] Alerta quando expiração ultrapassar limite definido
  - Critério de aceite: visão mínima de gestão disponível

---

## Fase 7 — Testes e Validação
- [x] **7.1 Testes unitários**
  - [x] Resolução de especialista
  - [x] Regras de cutoff
  - [x] Transição de estados

- [ ] **7.2 Testes de integração**
  - [x] Fluxo completo: handoff -> convite -> confirmação/remanejamento

- [ ] **7.3 Teste de robustez dos jobs**
  - [x] Validar idempotência e ausência de duplicidade
  - Critério de aceite: suíte crítica verde com evidência

---

## Ordem de Execução
- [x] 1) Fase 0
- [x] 2) Fase 1
- [x] 3) Fase 2
- [x] 4) Fase 3
- [x] 5) Fase 5 (parcial: falta aprovação operacional)
- [x] 6) Fase 4
- [x] 7) Fase 6
- [x] 8) Fase 7

Observação:
- Fase 5 pode rodar parcialmente em paralelo com Fase 3, mas deve estar pronta antes da homologação.

---

## MVP (primeiro bloco para iniciar já)
- [x] **MVP.1** Fase 1.1 (responsável/fallback na campanha)
- [x] **MVP.2** Fase 1.2 (trilha de confirmação)
- [x] **MVP.3** Fase 2.1 (resolução de especialista)
- [x] **MVP.4** Fase 2.3 (endpoint de confirmação por token)

Critério de saída do MVP:
- [x] Fluxo mínimo de confirmação operacional disponível, com painel operacional inicial.

---

## Status do Plano
- `Concluído`
  - Fase 0 — Definições e Contratos
  - 0.1 Definir estados de confirmação
  - 0.2 Definir indisponibilidade operacional
  - Fase 1.1 — responsável/fallback na campanha
  - Fase 1.2 — trilha de confirmação na atividade
  - Fase 2.1 — resolver especialista por campanha
  - Fase 2.2 — profissionalizar handoff IA -> humano
  - Fase 2.3 — endpoint de confirmação por token
  - Fase 2.4 — cutoff/remanejamento automático
  - Fase 3 — jobs e orquestração temporal
- `Em andamento`
  - Nenhum
- `Pendente`
  - Nenhum
