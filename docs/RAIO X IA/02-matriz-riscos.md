# 02 - Matriz De Riscos

Data: 2026-05-02  
Escopo: módulo de agentes e tools relacionadas.

## Legenda

| Severidade | Critério |
|---|---|
| Crítico | Pode gerar dano operacional, compliance, perda de dados, ação irreversível indevida ou bloqueio do funil. |
| Alto | Pode causar falha relevante em atendimento, confiança, handoff ou agenda. |
| Médio | Pode degradar qualidade, métricas ou eficiência. |
| Baixo | Ruído, dívida técnica ou inconsistência com impacto limitado. |

## Riscos Críticos

| ID | Risco | Fato / Evidência | Impacto | Mitigação Recomendada |
|---|---|---|---|---|
| R-CRIT-01 | Contrato inconsistente `contatoId` vs `leadId` em `converter_para_lead`. | Tool define `contatoId`; use case lê `input.leadId`. Evidências: `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:263`, `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/converter-para-lead.usecase.ts:63`. | Conversão pode falhar ou atualizar entidade errada. | Padronizar contrato, adicionar teste unitário e adapter explícito. |
| R-CRIT-02 | `qualificar_lead` usa `db.contato`, mas orquestrador pode trabalhar com IDs vindos de `lead`. | Evidências: `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/qualificar-lead.usecase.ts:121`, `/root/elyon/pacotes/backend/src/agentes/orchestrator-queries.ts:147`. | Qualificação pode falhar em produção ou criar duplicidade. | Unificar entidade ou resolver ID antes da tool. |
| R-CRIT-03 | Opt-out por guardrail pode não persistir. | Guardrail retorna ação `REGISTRAR_OPTOUT`, mas orquestrador retorna fallback imediatamente. Evidências: `/root/elyon/pacotes/backend/src/agentes/guardrails.ts:199`, `/root/elyon/pacotes/backend/src/agentes/orchestrator.ts:292`. | Compliance e reputação: usuário pede parada e sistema pode continuar contatos futuros. | Tornar opt-out transacional no guardrail ou webhook. |
| R-CRIT-04 | Tools sensíveis não validam tenant ownership de forma uniforme. | Use cases buscam por `id`, não necessariamente por `{ id, tenantId }`. Ex.: `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/mover-para-fase.usecase.ts:119`. | Risco cross-tenant se ID for injetado/errado. | Toda tool deve receber contexto e validar tenant. |
| R-CRIT-05 | `enviar_para_crm` integra externo e tenta mover `CAPTADO`. | Evidência: `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:606`. | Publicação/CRM indevida e mudança de status crítica. | Exigir aprovação humana/policy antes de executar. |

## Riscos Altos

| ID | Risco | Evidência | Impacto | Mitigação |
|---|---|---|---|---|
| R-ALTO-01 | Handoff humano pode ser prometido sem execução real em guardrail de comprador. | `/root/elyon/pacotes/backend/src/agentes/guardrails.ts:211`. | Lead recebe promessa sem SLA/tarefa. | Guardrail deve criar tarefa ou retornar mensagem sem promessa operacional. |
| R-ALTO-02 | Agendamento pode confirmar registro local sem Calendar ativo. | `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:843`. | Corretor pode não ver agenda real; conflito de disponibilidade. | Diferenciar “solicitação registrada” de “agendamento confirmado”. |
| R-ALTO-03 | Persona instrui não revelar IA e não revelar handoff. | `/root/elyon/pacotes/backend/src/agentes/skills/compartilhados/anti-injection.md:16`, `/root/elyon/pacotes/backend/src/agentes/shared-behavioral-guardrails.ts:158`. | Risco de confiança/compliance. | Definir política de disclosure aprovada pelo negócio/jurídico. |
| R-ALTO-04 | `gerar_link_contrato` pode gerar contrato via decisão do agente. | `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:425`. | Contrato gerado antes de termos realmente acordados. | Gate determinístico com campos obrigatórios e aprovação. |
| R-ALTO-05 | `registrar_indicacao` cria novo lead com dados fornecidos pelo lead. | `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:647`. | Consentimento/qualidade de dados/duplicidade. | Validar consentimento, telefone e tenant/campanha. |

## Riscos Médios

| ID | Risco | Evidência | Impacto | Mitigação |
|---|---|---|---|---|
| R-MED-01 | Estimativa de preço usa heurística ampla. | `/root/elyon/pacotes/backend/src/ferramentas/consultar-preco-mercado.ts:75`. | Resposta pode soar precisa demais. | Sempre exibir faixa + disclaimer + confiança. |
| R-MED-02 | Structured output de testes ainda contém schemas legados. | `/root/elyon/pacotes/backend/src/agentes/__tests__/structured-output-e2e.test.ts:23`. | Testes podem dar falsa segurança. | Atualizar para `SdrOutputSchema` real. |
| R-MED-03 | CoT/raciocínio é logado e persistido como dado estruturado. | `/root/elyon/pacotes/backend/src/agentes/output-extraction.ts:20`, `/root/elyon/pacotes/backend/src/agentes/orchestrator.ts:621`. | Risco de privacidade/observabilidade excessiva. | Trocar por `justificativaCurta` segura. |
| R-MED-04 | Learning/PAOL pode orientar ações sem baseline robusto. | `/root/elyon/pacotes/backend/src/agentes/paol-policy.ts:86`. | Otimização prematura ou comportamento instável. | Manter em shadow até evals e amostra suficiente. |

## Riscos Baixos

| ID | Risco | Evidência | Impacto | Mitigação |
|---|---|---|---|---|
| R-BAIXO-01 | Aliases legados de skills aumentam ruído. | `/root/elyon/pacotes/backend/src/agentes/skills/SKILLS_REGISTRY.ts:69`. | Manutenção mais difícil. | Planejar limpeza compatível. |
| R-BAIXO-02 | Exemplos do Admin conflitam com “uma pergunta por mensagem”. | `/root/elyon/pacotes/backend/src/agentes/admin-agent.ts:138`. | Conversa menos natural. | Reescrever exemplo em coleta incremental. |

## Ordem Recomendada De Ataque

1. R-CRIT-01.
2. R-CRIT-02.
3. R-CRIT-03.
4. R-CRIT-04.
5. R-CRIT-05.
