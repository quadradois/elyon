# Raio-X: Ecossistema de Leads & Contatos
**Data:** 2026-04-27
**Escopo:** Módulos de Contatos, Leads, Campanhas, Listas, Sidebar e Agente SDR

---

## 0. Governança de execução

Para executar este raio-x com padrão profissional, usar os artefatos abaixo:

- `README.md` (ponto de entrada e ordem de leitura)
- `EXECUCAO_SPRINT.md` (sequência oficial, gates e política de PR)
- `STATUS_EXECUCAO.md` (acompanhamento diário, riscos, evidências)
- `CHECKLIST_QUALIDADE.md` (Definition of Ready/Done e Go/No-Go)

Status de tarefas:
- `TODO` | `IN_PROGRESS` | `BLOCKED` | `DONE`

Regra operacional:
- Não iniciar tarefa nova sem registrar owner/status no `STATUS_EXECUCAO.md`
- Não marcar tarefa como `DONE` sem evidências de validação

---

## 1. Diagnóstico

O ecossistema possui 3 universos paralelos de criação de Leads que não convergem:

| Universo | Caminho | Problema |
|---|---|---|
| **Outbound** | Mineração → Lista → Campanha → Contato → SDR IA → Lead | Fluxo correto, mas Contato escondido dentro da Campanha |
| **Inbound** | WhatsApp → Lead direto | Bypassa Contato e Campanha inteiramente |
| **Manual** | NovoLeadDialog → Lead direto | Dados mínimos, sem campanha, sem histórico de prospecção |

---

## 2. Entidades e papéis reais

### Contato (`tabela: contatos`)
- Proprietário de imóvel identificado via mineração
- **Sempre vinculado a uma Campanha** (hoje `campanhaId` required)
- Possui `statusProspeccao` (AGUARDANDO → CONTATANDO → RESPONDEU → INTERESSADO → LEAD)
- O **agente SDR opera exclusivamente sobre `contatoId`** — todas as 8 tools recebem este campo
- Acesso na UI: apenas via `/campanhas/:id` aba Contatos (3 níveis de profundidade)

### Campanha (`tabela: campanhas`)
- Sempre representa **1 empreendimento específico** (Ed. X, Residencial Y)
- **É a fonte de conhecimento do agente**: webhook resolve `Contato → Campanha → briefingCompleto` e injeta no contexto do SDR como `knowledgeBase`
- Sem briefing da campanha, o agente perde inteligência contextual sobre o imóvel

### Lead (`tabela: leads`)
- Proprietário que **demonstrou interesse** (gerado pelo `converterParaLeadTool` do SDR)
- Vinculado ao Tenant diretamente (não à Campanha)
- Possui `StatusLead`, dados SPIN, negociação, contrato
- Acesso na UI: `/dashboard/leads` — MissionControlLeads (Feed/Kanban/Lista legada)

### Lista (`tabela: listas`)
- Estágio pré-Campanha de contatos minerados
- Fluxo: Lista → importar para Campanha → Contatos dentro da Campanha

---

## 3. Problemas críticos identificados

### P1 — Bug latente: proprietário em 2 campanhas usa briefing errado
**Arquivo:** `pacotes/backend/src/rotas/webhook.ts` — função `buscarContatoProspeccao`
**Linha relevante:** `ORDER BY atualizadoEm DESC LIMIT 1`
**Problema:** Quando o mesmo telefone existe em 2 campanhas ativas, o webhook escolhe pelo campo `atualizadoEm`, não pelo status da conversa. O agente pode usar o briefing do Edifício A para responder sobre o Edifício B.
**Correção:** Priorizar contato com `statusProspeccao IN ('CONTATANDO', 'RESPONDEU', 'INTERESSADO')`, depois desempatar por `atualizadoEm DESC`.

### P2 — campanhaId required impede Proprietários manuais
**Arquivo:** `pacotes/backend/prisma/schema.prisma` — model `Contato`
**Linha relevante:** `campanhaId String` (non-nullable)
**Problema:** Corretor não consegue cadastrar proprietário avulso (indicação, contato direto) sem criar uma campanha primeiro.
**Correção:** `campanhaId String?` — nullable com migration Prisma.

### P3 — Sem guard explícito: Contato sem campanha acionaria o agente
**Arquivo:** `pacotes/backend/src/rotas/webhook.ts` — função `buscarContatoProspeccao`
**Problema:** Após P2 ser corrigido, um Contato sem `campanhaId` não teria briefing. O agente seria acionado sem knowledge base, gerando respostas genéricas/erradas.
**Correção:** Guard explícito: se `contato.campanhaId === null` → `registrarIgnorado(...)` → não acionar agente.

### P4 — Kanban carrega 500 leads sem virtualização
**Arquivo:** `pacotes/frontend/src/paginas/Leads.tsx` — linha com `limit: 500` no modo kanban
**Problema:** Gargalo de performance. A UI não foi projetada para renderizar 500 cards simultâneos.
**Correção:** Paginação por coluna (20 cards por status com scroll infinito por coluna).

### P5 — Contato não tem rota própria (3 níveis de profundidade)
**Rota atual:** `/dashboard/campanhas/:campanhaId/contatos/:contatoId`
**Problema:** 5 cliques para acessar 1 proprietário. Sem busca global. Impossível de bookmarkar.
**Correção:** Nova rota `/dashboard/proprietarios/:id` + página `ProprietarioDetalhes.tsx`.

### P6 — MissionControlLeads importa Leads.tsx legado como lazy component
**Arquivo:** `pacotes/frontend/src/paginas/MissionControlLeads.tsx`
**Linha relevante:** `const LeadsLegadoLista = lazy(() => import('./Leads'))`
**Problema:** Componente dentro de componente — estado duplicado, comportamento inconsistente, débito técnico.
**Correção:** Remover após nova página `/proprietarios` estar estável.

### P7 — StatusLead com 5 valores deprecated ainda no banco e no frontend
**Valores:** `QUALIFICADO`, `EM_NEGOCIACAO`, `CONTATANDO`, `CONVERTIDO`, `INATIVO`
**Problema:** Leads com esses status geram badges inconsistentes. Filtros e queries podem retornar dados inesperados.
**Correção:** Migration com UPDATE + remoção do enum após validação.

---

## 4. Decisões arquiteturais (Caminho B)

| # | Decisão | Justificativa |
|---|---|---|
| **D1** | Manter `Contato` e `Lead` como tabelas separadas | O agente SDR opera sobre `contatoId`. O mesmo proprietário pode ter imóveis em 2 campanhas — são 2 oportunidades distintas. |
| **D2** | Campanha mantém papel de knowledge base do agente | `briefingCompleto` da Campanha é injetado no contexto do SDR. Sem ele o agente perde inteligência contextual. `campanhaId` vira nullable (não obrigatório). |
| **D3** | Sidebar reorganizado em funil único, implementado de uma vez | Meia reorganização cria dois modelos mentais conflitantes simultaneamente. |

---

## 5. Nova arquitetura de informação

### Nomenclatura
- `Contato` → **"Proprietário"** na UI (sem alterar nomes de variáveis/tipos no código)

### Novo sidebar
```
CAPTAÇÃO      → Mineração, Campanhas
FUNIL         → Proprietários ⭐, Agenda
GESTÃO        → Carteira, Relatórios, Cockpit IA
CONFIG        → Agentes, WhatsApp, Configurações
```

### Nova rota principal
- `/dashboard/proprietarios` — listagem unificada (Contatos + Leads) com filtro por estágio
- `/dashboard/proprietarios/:id` — detalhe unificado (Contato + Lead vinculado na mesma tela)

### Estágios no funil (calculados, não armazenados)
```
Em Prospecção   → statusProspeccao: AGUARDANDO / CONTATANDO
Respondeu       → statusProspeccao: RESPONDEU / INTERESSADO
Qualificado     → virouLead: true, StatusLead: NOVO → DOCUMENTACAO
Captado         → StatusLead: CAPTADO → Cliente
```

### Redirects necessários
```
/dashboard/leads                              → /dashboard/proprietarios
/dashboard/leads/:id                          → /dashboard/proprietarios/:id
/dashboard/campanhas/:cid/contatos/:ctid      → /dashboard/proprietarios/:ctid
/dashboard/captacao                           → /dashboard/mineracao
```

---

## 6. Arquivos afetados por fase

### Fase 1 — DB & Webhook
- `pacotes/backend/prisma/schema.prisma`
- `pacotes/backend/prisma/migrations/` (nova migration)
- `pacotes/backend/src/rotas/webhook.ts`

### Fase 2 — Backend API
- `pacotes/backend/src/rotas/proprietarios.ts` (novo)
- `pacotes/backend/src/servidor.ts`

### Fase 3 — Frontend Páginas
- `pacotes/frontend/src/paginas/Proprietarios.tsx` (novo)
- `pacotes/frontend/src/paginas/ProprietarioDetalhes/index.tsx` (novo)
- `pacotes/frontend/src/componentes/KanbanLeads.tsx` (virtualização)

### Fase 4 — Sidebar & Rotas
- `pacotes/frontend/src/App.tsx`
- `pacotes/frontend/src/layouts/LayoutDashboard.tsx`
- `pacotes/frontend/src/paginas/detalhes-campanha/CampanhaDetalhes.tsx`

### Fase 5 — Cleanup
- `pacotes/frontend/src/paginas/MissionControlLeads.tsx`
- `pacotes/frontend/src/paginas/Leads.tsx` (deprecar)
- `pacotes/backend/prisma/schema.prisma` (enum cleanup)
- Todos os `.tsx` com string "Contato" visível ao usuário

---

## 7. O que NÃO mudar

- Nomes de variáveis TypeScript (`contatoId`, `campanha`, `lead`) no código
- Lógica interna do agente SDR (`sdr-agent.ts`, `sdr-tools-agents.ts`)
- Estrutura das tools de IA (`converterParaLeadTool`, `qualificarLeadTool`, etc.)
- Endpoints existentes (`/api/leads`, `/api/campanhas`, `/api/contatos`) — manter funcionando
- Relação `Contato → Campanha → EmpreendimentoConhecimento` no webhook
