# Findings - RAIO-X IA / Agentes

## Fatos Comprovados

| Tema | Achado | Evidência |
|---|---|---|
| Arquitetura | Existem dois agentes principais: SDR e ADMIN. | `/root/elyon/pacotes/backend/src/agentes/agent-chain.ts:30` |
| Handoff | Há handoff nativo SDR -> ADMIN. | `/root/elyon/pacotes/backend/src/agentes/agent-chain.ts:304` |
| SDR | O SDR unifica prospecção, diagnóstico, pitch e agendamento. | `/root/elyon/pacotes/backend/src/agentes/sdr-agent.ts:2` |
| ADMIN | O ADMIN atua em onboarding, contrato, dados do imóvel e CRM. | `/root/elyon/pacotes/backend/src/agentes/admin-agent.ts:2` |
| Memória | Histórico SDK usa Redis com fallback em memória e TTL. | `/root/elyon/pacotes/backend/src/agentes/conversation-cache.ts:1` |
| Guardrails | Guardrails cobrem blacklist, spam, opt-out e comprador. | `/root/elyon/pacotes/backend/src/agentes/guardrails.ts:174` |
| Output | SDR usa structured output com resposta, raciocínio, fase, PVAM e SPIN. | `/root/elyon/pacotes/backend/src/agentes/sdr-agent.ts:434` |
| Tools | Tools alteram lead, fase, CRM, contrato, agenda, opt-out e indicação. | `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:98` |
| Segurança de tools | Há pré-validação para algumas tools. | `/root/elyon/pacotes/backend/src/ferramentas/tool-wrapper.ts:344` |
| Filtros | Há sanitização contra vazamento técnico e narração de handoff. | `/root/elyon/pacotes/backend/src/agentes/response-filters.ts:75` |

## Hipóteses / Inferências

| Hipótese | Base da inferência | Confiança |
|---|---|---|
| O agente é essencialmente um SDR imobiliário outbound, não um assistente genérico. | Persona, templates, funil, SPIN e tools comerciais. | Alta |
| Há risco real de falha por confusão `contatoId` vs `leadId`. | Contratos de tools e use cases divergem. | Alta |
| Opt-out via guardrail pode não persistir. | Guardrail retorna ação, mas orquestrador encerra cedo com fallback. | Alta |
| Handoff humano pode ser prometido sem tarefa real em alguns caminhos. | Guardrail de comprador retorna mensagem, não tool de handoff. | Média/Alta |
| PAOL/Learning Bank ainda deve ficar em shadow/control até baseline robusto. | Flags desligadas por padrão e ação pode influenciar tool choice. | Média |

## Ponto Mais Importante

O sistema é mais maduro que um agente prompt-only, mas as decisões críticas ainda precisam sair da dependência exclusiva do LLM e passar por contratos determinísticos: autorização, ownership, idempotência, opt-out e ações irreversíveis.
