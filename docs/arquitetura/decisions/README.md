# Architecture Decision Records

| ADR | Estado | Decisao |
|---|---|---|
| [0001](0001-entrega-protegida-por-sha.md) | Aceita | Entrega versionada e deploy pelo SHA de `main` |
| [0002](0002-lead-entidade-canonica.md) | Aceita | `Lead` e `leadId` como identidade unica do prospecto em toda a jornada |
| [0003](0003-estados-canonicos-agente.md) | Proposta | Estados ortogonais e transicoes explicitas para a jornada do Lead |

Use o formato: contexto, decisao, consequencias, rollout e rollback. Estados
permitidos: proposta, aceita, substituida ou rejeitada.
