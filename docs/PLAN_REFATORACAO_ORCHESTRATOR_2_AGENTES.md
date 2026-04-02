# Plano Técnico Executável — Refatoração para Orchestrator + 2 Agentes

Data: 2026-03-03  
Objetivo: maximizar qualidade conversacional e robustez operacional, removendo o `Closer` do fluxo ativo e concentrando IA em `Opener` + `Presenter`, com contrato no humano e pós-assinatura no `Admin`.

---

## 1) Arquitetura-alvo

### Fluxo alvo
1. **Opener (IA)**
   - Descobrir intenção: venda/locação
   - Coletar dados essenciais do imóvel (tipo/quartos/área/ocupação/valor)
   - Transição para Presenter
2. **Presenter (IA)**
   - Diagnóstico SPIN profundo (Situação → Problema → Implicação → Necessidade)
   - Consolidar dores, impacto, objeções e prontidão
   - Encaminhar para fase humana de documentação/contrato
3. **Humano (Operação Comercial)**
   - Envio e negociação de contrato via WhatsApp
   - Coleta de aceite
4. **Admin (IA)**
   - Pós-assinatura: atualização cadastral, coleta de dados do imóvel, agendamento de fotos/visita, envio ao CRM

### Princípios
- Sem fallback genérico para usuário quando houver execução válida de tool.
- Todas as transições críticas devem deixar evidência em `TOOL_EXEC:*`.
- Status do funil deve refletir responsabilidade real (IA vs Humano).

---

## 2) Matriz de alinhamento (Status × Responsável × Tool)

| Status Lead | Fase Kanban | Responsável | Ação principal | Tools esperadas |
|---|---|---|---|---|
| `NOVO`, `QUALIFICADO` | Fase 1 | Opener | descoberta inicial | `converter_para_lead`, `qualificar_lead` |
| `TENTATIVA_AGENDAMENTO`, `CONTATANDO`, `VISITA_AGENDADA` | Fase 2 | Presenter | SPIN profundo + pitch consultivo | `qualificar_lead`, `mover_para_fase(FASE3)` |
| `DOCUMENTACAO`, `EM_NEGOCIACAO` | Fase 3 | Humano | contrato e formalização | (manual + opcional `atualizar_dados_lead`) |
| `ONBOARDING` | Fase 4 | Admin | pós-assinatura operacional | `atualizar_dados_lead`, `salvar_dados_imovel`, `agendar_avaliacao`, `enviar_para_crm` |
| `CAPTADO` | Fora do Kanban | Sistema/Carteira | cliente ativo | envio CRM concluído |

---

## 3) Backlog executável por épico

## Épico A — Orquestrador sem Closer ativo

### A1. Remover handoff Presenter→Closer da cadeia
- **Arquivos**:
  - `pacotes/backend/src/agentes/orchestrator.ts`
- **Mudanças**:
  - Eliminar criação/uso do `h_presenter_to_closer`.
  - Eliminar dependência de `closerAgent` no roteamento principal.
- **Critério de aceite**:
  - Não existe mais `lastAgent=closer_agent_v5` em logs de produção em fluxos novos.

### A2. Ajustar mapeamento de status no roteamento
- **Arquivos**:
  - `pacotes/backend/src/agentes/orchestrator.ts`
- **Mudanças**:
  - `DOCUMENTACAO` e `EM_NEGOCIACAO` não roteiam para Closer.
  - Definir comportamento explícito para `CAPTADO` (não voltar para Opener).
- **Critério de aceite**:
  - Mensagens em `DOCUMENTACAO` seguem política humana (sem tentativa de fechamento automático).

### A3. Política de fase humana
- **Arquivos**:
  - `pacotes/backend/src/agentes/orchestrator.ts`
- **Mudanças**:
  - Criar guarda para fase humana (`DOCUMENTACAO`/`EM_NEGOCIACAO`) com resposta operacional curta (ou encaminhamento interno) sem simular negociação IA.
- **Critério de aceite**:
  - Em fase humana, IA não dispara scripts de fechamento/objeção de Closer.

---

## Épico B — Presenter SPIN Profundo (núcleo de qualidade)

### B1. Reestruturar prompt para SPIN orientado a estado
- **Arquivos**:
  - `pacotes/backend/src/agentes/presenter-agent.ts`
- **Mudanças**:
  - Definir checkpoints obrigatórios por etapa:
    - Situação: canal atual, retorno, contexto
    - Problema: 2 dores mínimas
    - Implicação: custo/tempo/risco
    - Necessidade: expectativa e critério de decisão
- **Critério de aceite**:
  - Presenter não avança para conclusão sem 2 dores + 1 implicação válida.

### B2. Checkpoints de persistência (tool discipline)
- **Arquivos**:
  - `pacotes/backend/src/agentes/presenter-agent.ts`
- **Mudanças**:
  - Instrução explícita para `qualificar_lead` em marcos intermediários, não apenas no final.
- **Critério de aceite**:
  - Histórico de atividades mostra `TOOL_EXEC:qualificar_lead` em leads que chegam a Fase 3.

### B3. Resumo executivo para humano na transição
- **Arquivos**:
  - `pacotes/backend/src/agentes/presenter-agent.ts`
  - `pacotes/backend/src/agentes/orchestrator.ts` (se necessário para sanitização)
- **Mudanças**:
  - Padronizar saída final antes de `mover_para_fase(FASE3)` com síntese curta: dores, implicação, objeções, urgência.
- **Critério de aceite**:
  - O humano recebe contexto suficiente sem reler conversa inteira.

---

## Épico C — Admin pós-assinatura (sem negociação)

### C1. Reposicionar missão do Admin
- **Arquivos**:
  - `pacotes/backend/src/agentes/admin-agent.ts`
- **Mudanças**:
  - Remover orientações de “gerar/negociar contrato” como papel primário.
  - Focar em: cadastro, dados do imóvel, fotos/visita, CRM.
- **Critério de aceite**:
  - Prompt do Admin não contém etapa de fechamento comercial.

### C2. Fluxo operacional completo pós-assinatura
- **Arquivos**:
  - `pacotes/backend/src/agentes/admin-agent.ts`
  - `pacotes/backend/src/ferramentas/sdr-tools-agents.ts`
- **Mudanças**:
  - Garantir sequência operacional com confirmação de dados mínimos antes de `enviar_para_crm`.
- **Critério de aceite**:
  - Lead `CAPTADO` com dados mínimos consegue completar envio ao CRM sem intervenção técnica.

---

## Épico D — Alinhamento Kanban e LeadDetalhes (100%)

### D1. Kanban refletindo operação real
- **Arquivos**:
  - `pacotes/frontend/src/componentes/KanbanLeads.tsx`
- **Mudanças**:
  - Atualizar texto da Fase 3 de “Closer” para “Documentação (Humano)”.
  - Ajustar descrições de fase sem mudar IDs/colunas.
- **Critério de aceite**:
  - UI não comunica mais agente Closer ativo.

### D2. Checklist da página de lead alinhado ao novo fluxo
- **Arquivos**:
  - `pacotes/frontend/src/paginas/LeadDetalhes/componentes/FaseChecklist.tsx`
- **Mudanças**:
  - Fase 3: tarefas humanas de documentação/contrato.
  - Fase 4: tarefas Admin operacionais (dados do imóvel, fotos, CRM).
- **Critério de aceite**:
  - Checklist corresponde ao comportamento real do processo e tools.

### D3. Campos esperados pela página de lead
- **Arquivos**:
  - `pacotes/backend/src/rotas/leads.ts`
  - `pacotes/frontend/src/paginas/LeadDetalhes/tipos.ts`
- **Mudanças**:
  - Validar consistência de campos SPIN, negociação e contrato.
- **Critério de aceite**:
  - Sem campos “esperados e vazios por design” quando fase correspondente já foi concluída.

---

## Épico E — Observabilidade e qualidade

### E1. Métricas de qualidade por fase
- **Arquivos**:
  - `pacotes/backend/src/agentes/orchestrator.ts`
  - (opcional) `pacotes/backend/src/monitoring/*`
- **Mudanças**:
  - Logar indicadores por turno: fase, tool calls, resposta vazia, fallback aplicado.
- **Critério de aceite**:
  - Painel/log permite identificar gargalo por fase sem inspeção manual extensa.

### E2. Suite de validação conversacional
- **Arquivos**:
  - `pacotes/backend/src/testes/*` (ou pasta equivalente)
- **Cenários mínimos**:
  - Venda já anunciada (SPIN completo)
  - Venda sem anúncio prévio
  - Objeção de exclusividade/comissão
  - Transição Presenter → fase humana
  - Pós-assinatura Admin → CRM
- **Critério de aceite**:
  - Todos cenários executam sem fallback genérico ao usuário.

---

## 4) Sprint sugerida (execução em ordem)

## Sprint 1 (fundação)
- A1, A2, D1
- Resultado esperado: Closer fora da cadeia ativa e UI já refletindo modelo novo.

## Sprint 2 (qualidade do atendimento)
- B1, B2, B3
- Resultado esperado: Presenter mais profundo e consistente para handoff humano.

## Sprint 3 (pós-assinatura e fechamento operacional)
- C1, C2, D2, D3
- Resultado esperado: LeadDetalhes/Kanban totalmente alinhados ao fluxo operacional real.

## Sprint 4 (resiliência e governança)
- E1, E2
- Resultado esperado: monitoramento e regressão confiáveis.

---

## 5) Definição de pronto (Definition of Done)

Uma entrega só é concluída quando:
1. Código builda sem erros.
2. Logs não mostram fallback genérico em cenário nominal.
3. `TOOL_EXEC` reflete o que checklist espera.
4. Kanban e LeadDetalhes exibem a fase coerente com a responsabilidade real.
5. Fluxo de ponta a ponta (Opener → Presenter → Humano → Admin) foi validado em teste real.

---

## 6) Riscos e mitigação

- **Risco**: regressão em leads antigos com status intermediários.
  - **Mitigação**: regra explícita para status legados no orquestrador.
- **Risco**: Presenter ficar longo demais e cansar o lead.
  - **Mitigação**: limites de mensagem + checkpoints SPIN obrigatórios e objetivos.
- **Risco**: desalinhamento entre tools e checklist.
  - **Mitigação**: manter `TOOL_EXEC` como fonte de evidência primária.

---

## 7) Próxima ação imediata

Iniciar **Sprint 1** implementando:
1. remoção do handoff para Closer no orquestrador,
2. novo mapeamento de status sem Closer,
3. atualização de labels/descrições do Kanban para fase humana em documentação.

---

## 8) Andamento real (execução)

### ✅ Sprint 1 — Concluída
- Closer removido da cadeia ativa no orquestrador.
- Roteamento de status ajustado para modelo sem Closer.
- Kanban atualizado para Fase 3 humana (documentação/formalização).

### 🔄 Sprint 2 — Em andamento
- ✅ Prompt do Presenter refatorado para SPIN mais profundo e disciplinado.
- ✅ Removidas referências operacionais ao Closer no Presenter.
- ✅ Regras de checkpoint com qualificar_lead adicionadas.
- ✅ Calibração inicial do checklist/UI da fase 3/4 para refletir o novo comportamento.

### 🔄 Sprint 3 — Em andamento
- ✅ Checklist da página de lead ajustado para Fase 3 humana (documentação) e Fase 4 Admin pós-assinatura.
- ✅ Critérios de conclusão da Fase 4 agora consideram `salvar_dados_imovel` + `agendar_avaliacao` + `enviar_para_crm`.
- ✅ Revisão de textos residuais e deploy do frontend concluídos.

### 🔄 Sprint 4 — Em andamento
- ✅ Telemetria estruturada no orquestrador com log `[ORCH-METRICS]` por turno:
  - fase do fluxo,
  - agente inicial/final,
  - quantidade de tool calls/handoffs,
  - fallback aplicado,
  - duração e sucesso/erro.
- ✅ Suíte inicial de regressão conversacional criada para arquitetura sem Closer:
  - `pacotes/backend/src/testes/sprint4-regressao-conversa.ts`.
- ⏳ Próximo passo: validar esses indicadores em produção com monitoramento dirigido e fechar critérios de aprovação da Sprint 4.
