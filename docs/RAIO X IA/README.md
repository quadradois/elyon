# RAIO-X IA / Agentes - Backend Elyon

Data: 2026-05-02  
Escopo: `/root/elyon/pacotes/backend/src/agentes` e integrações diretamente usadas pelo módulo de agentes.  
Modo: auditoria e recomendação, sem alteração do backend.

## Objetivo

Centralizar a avaliação de comportamento, arquitetura, prompts, tools, autonomia, memória, handoff humano, segurança, qualidade conversacional e riscos operacionais do agente.

## Documentos

| Arquivo | Conteúdo |
|---|---|
| `01-raio-x-ia-agentes.md` | Relatório executivo completo com os 20 entregáveis solicitados. |
| `02-matriz-riscos.md` | Riscos classificados por severidade, evidência, impacto e mitigação. |
| `03-backlog-priorizado.md` | Backlog P0/P1/P2 por impacto x esforço. |
| `04-plano-evolucao.md` | TO-BE recomendado e plano de evolução por fases. |
| `05-testes-recomendados.md` | Plano de testes, evals e critérios de aceite. |
| `06-tickets-p0.md` | Tickets técnicos P0 prontos para implementação com critérios de aceite. |
| `07-revisao-estado-git.md` | Fotografia do worktree atual e recomendação de isolamento/estabilização. |
| `08-code-review-refatoracao-contato-lead.md` | Code review da refatoração atual `Contato -> Lead` e decisão recomendada. |
| `09-plano-execucao-p0.md` | Plano de execução segura dos P0 com gates de início/conclusão e ordem recomendada. |
| `task_plan.md` | Plano operacional da auditoria e próximos passos. |
| `findings.md` | Achados separados entre fatos e hipóteses. |
| `progress.md` | Log de progresso da análise. |

## Decisão Recomendada

Status recomendado no momento: **No-Go para autonomia plena**.

Pode seguir para piloto controlado somente após resolver os P0:

1. Corrigir contratos de ID (`contatoId` vs `leadId`).
2. Persistir opt-out no fluxo de guardrail.
3. Validar tenant ownership em todas as tools sensíveis.
4. Colocar CRM/contrato/CAPTADO atrás de aprovação humana ou policy engine determinística.

## Regra de Organização

Todos os artefatos desta demanda devem permanecer nesta pasta:

`/root/elyon/docs/RAIO X IA`
