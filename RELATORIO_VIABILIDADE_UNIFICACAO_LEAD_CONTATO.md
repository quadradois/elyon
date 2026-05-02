# Relatório de Viabilidade — Unificação Lead/Contato no Elyon

**Data:** 30/04/2026  
**Escopo:** Análise técnica completa do impacto de eliminar o modelo `Contato` e tratar tudo como `Lead` desde a mineração  
**Status:** Análise — NÃO implementar sem aprovação

---

## 1. Contexto e Motivação

O sistema atual opera com dois modelos distintos:

| Dimensão | `Contato` | `Lead` |
|---|---|---|
| **Criado por** | Mineração / importação CSV | Qualificação SDR ou entrada manual |
| **Representa** | Proprietário prospectado (raw) | Oportunidade qualificada no CRM |
| **Volume esperado** | 100–10.000 por campanha | 1–500 por campanha |
| **Ciclo de vida** | Prospecto → (vira Lead ou descartado) | Qualificado → Negociando → Captado |
| **Principal consumidor** | Engine de disparo / SDR-IA | Corretor humano / CRM externo |

A motivação do pedido é eliminar o "salto" entre Contato e Lead — quando a mineração já acontece, o dado poderia entrar direto como Lead, sem uma entidade intermediária.

---

## 2. Mapeamento do Ecossistema Impactado

### 2.1 Banco de Dados — Schema

**Tabelas diretamente envolvidas:**

| Tabela | Linhas de schema | Relação com Contato |
|---|---|---|
| `contatos` | linhas 599–722 | Entidade raiz do impacto |
| `mensagens_prospeccao` | linhas 730–758 | FK `contatoId` com CASCADE DELETE |
| `campanhas` | linhas 527–592 | FK `campanhaId` + contadores `totalContatos` / `totalLeads` |
| `leads` | linhas 764–935 | FK `contatoOrigem` (1:1 único) |
| `cache Redis` | chave `contatoId` | Histórico de conversa por chave = contatoId |

**Campos exclusivos do `Contato` sem equivalente no `Lead`:**

```
Controle de prospecção ativa:
  tentativasContato          Int      — contador de disparos feitos
  ultimaTentativa            DateTime — data do último disparo (lógica de retry)
  dataRecontato              DateTime — agendamento de recontato futuro
  motivoRecontato            String

Controle de atendimento:
  modoAtendimento            String   — IA | HUMANO | PAUSADO
  atendidoPor                String   — quem assumiu o atendimento
  pausadoEm                  DateTime
  motivoPausa                String

Dados IPTU/Assertiva brutos (sem equivalente no Lead):
  apartamento, bloco, unidade, box, quadra, lote
  areaTerreno (Decimal)
  areaConstruida (Decimal)
  anoConstituicao

Status de prospecção granular:
  statusProspeccao            — AGUARDANDO | CONTATANDO | RESPONDEU |
                                SEM_INTERESSE | INTERESSADO | LEAD | OPTOUT | FALHA

Dados de enriquecimento (alguns já foram migrados parcialmente):
  participacoesEmpresas (Json)
  redesSociais (Json)
  perfilInvestidor
  scoreQualificacao
  nomeMae, cpfMae, situacaoCadastral, obitoProvavel, ppe, signo
  cidade, estado, cep (endereço pessoal do proprietário)
  telefonesJson, emailsJson (arrays completos com metadata WhatsApp)
  telefone4, telefone5, email3, email4, email5
```

**Constraints de banco que precisariam ser redesenhadas:**
- `contatos.leadId @unique` — garante 1 Lead por Contato; ao unificar, esta restrição desaparece
- `leads.@@unique([tenantId, cpf])` — colide com Contatos do mesmo CPF em campanhas diferentes
- Índices compostos de Contato: `[campanhaId, telefone]`, `[campanhaId, cpf]`, `[statusProspeccao]`, `[dataRecontato]`, `[virouLead]`

---

### 2.2 Backend — Serviços e Rotas

**Volume total de referências ao modelo Contato no backend:**  
`697 referências` em `32 arquivos` de produção (excluindo testes e backup).

**Arquivos de maior impacto (por criticidade):**

#### `disparo-campanha.ts` — 813 linhas — BLOQUEADOR CRÍTICO

Este é o motor central de prospecção. Toda a lógica de retry e elegibilidade é estrutural ao Contato:

```typescript
// Lógica de retry (linhas 245-272) — 100% dependente de campos do Contato
function podeEnviarFollowUp(contato: Contato): boolean {
  if (contato.tentativasContato >= maxTentativas) return false;
  if (contato.tentativasContato === 1) { /* espera 2h */ }
  if (contato.tentativasContato === 2) { /* espera 24h */ }
  /* tentativas >= 3: espera N dias configurados */
}

// Query de elegíveis (linhas 362–413) — WHERE em campos exclusivos do Contato
prisma.contato.findMany({
  where: {
    statusProspeccao: { in: ['AGUARDANDO', 'CONTATANDO', 'RESPONDEU'] },
    modoAtendimento: 'IA',
    tentativasContato: { lt: maxTentativas },
    ultimaTentativa: { lt: dataLimiteFollowup },
    virouLead: false,
  }
})

// Após disparo: atualização atômica do estado
prisma.contato.update({ data: {
  statusProspeccao: 'CONTATANDO',
  tentativasContato: { increment: 1 },
  ultimaTentativa: new Date(),
}})
```

**Impacto**: sem `tentativasContato`, `ultimaTentativa` e `statusProspeccao` no Lead, o engine de disparo para completamente.

---

#### `webhook.ts` — 2.212 linhas — CRÍTICO

O webhook de entrada WhatsApp usa `contatoId` como chave de roteamento em toda a cadeia:

```typescript
// Raw SQL otimizado que ordena por prioridade de status do Contato
WHERE c."statusProspeccao" IN ('CONTATANDO', 'RESPONDEU', 'INTERESSADO', 'LEAD')
ORDER BY CASE WHEN c."statusProspeccao" IN ('CONTATANDO', 'RESPONDEU') THEN 0 ELSE 1 END

// Sistema anti-duplicata de respostas (linha 591–629)
async function jaRespondemosMensagem(contatoId, timestamp): Promise<boolean>

// Fila de debounce por contatoId (linhas 730–816)
const filasDebounce = new Map<string, FilaContato>()  // key = contatoId
```

**Impacto**: sistema de debounce, anti-duplicata e deduplicação de mensagens usa `contatoId` como chave. Trocar por `leadId` é viável, mas exige refactor em ~40 pontos do arquivo.

---

#### `orchestrator.ts` — 929 linhas — CRÍTICO

O orquestrador usa `contatoId` para determinar qual agente rotear E para toda a persistência de histórico de conversa:

```typescript
// Determinação de agente (linha 314)
const tipoAgente = determinarAgente(contexto.statusLead, contexto.contatoId, agentePersistido)
// → se contatoId presente = SDR
// → se só leadId = agente por fase SPIN

// Cache de histórico: chave = contatoId (Redis)
const cachedHistory = contexto.contatoId
  ? await getHistory(contexto.contatoId) : undefined;

// Persistência pós-conversa
await persistirHistoricoSdk(contexto.contatoId, result)
await setSchemaState(contexto.contatoId, schemaFinal)
```

**Impacto**: toda a camada de cache Redis e histórico de conversa usa `contatoId` como chave primária. Cache existente de conversas em andamento seria invalidado na migração.

---

#### `contatos.rotas.ts` — 1.910 linhas — BLOQUEADOR

O arquivo mais extenso do sistema. Contém ~50 operações exclusivas do modelo Contato:

| Funcionalidade | Dependência Exclusiva | Custo |
|---|---|---|
| Importação CSV (149 linhas) | Mapeamento dinâmico de colunas para Contato | Alto |
| Vincular leads minerados (135 linhas) | Enriquecimento Assertiva → Contato | Alto |
| Vincular leads banco (276 linhas) | Cache CPF/IPTU → Contato | Muito Alto |
| Funil de prospecção (groupBy statusProspeccao) | Métrica dimensional do Contato | Médio |
| Controle de envio em massa | modoAtendimento em lote | Médio |
| Exportar CSV enriquecido (159 linhas) | Box discovery por CPF via Contato | Alto |
| Reset de histórico | MensagemProspeccao CASCADE | Médio |
| Retry/tentativas | tentativasContato, ultimaTentativa | Alto |

---

#### `conversation-cache.ts` — Sistema Redis

O cache de histórico do agente SDR usa `contatoId` como chave Redis:

```
Redis key: `conv:${contatoId}`       → histórico de mensagens
Redis key: `schema:${contatoId}`     → schemaState (dados coletados)
Redis key: `agent:${contatoId}`      → último agente usado
```

**Impacto**: trocar para `leadId` invalida todo o histórico de conversas ativas durante a migração. Proprietários em atendimento perderiam contexto de conversa.

---

#### `agent-chain.ts` — Função `determinarAgente`

```typescript
export function determinarAgente(
  statusLead?: string,
  contatoId?: string,       // ← presença de contatoId = SDR
  agentePersistido?: TipoAgente
): TipoAgente {
  if (!statusLead) return 'SDR';       // sem Lead = SDR (prospecção)
  if (statusAdmin.has(statusLead)) return 'ADMIN';
  return 'SDR';
}
```

O `contatoId` hoje sinaliza implicitamente que a interação é de **prospecção ativa**. Sem o Contato, a diferença entre "SDR fazendo prospecção" e "SDR qualificando lead" seria determinada apenas pelo `statusLead`, o que já funciona — mas o contexto contextual seria diferente.

---

### 2.3 Frontend — 32 Arquivos / 431 Referências

Principais componentes impactados:

| Componente | Dependências do Contato | Impacto |
|---|---|---|
| `ProprietarioDetalhes/index.tsx` | contato, statusProspeccao, modoAtendimento, virouLead | Alto |
| `AbaContatos.tsx` (campanha) | statusProspeccao, tentativasContato, modoAtendimento | Alto |
| `DashboardAgentes.tsx` | métricas por statusProspeccao | Médio |
| `ContatoDetalhes.tsx` | modelo Contato inteiro | Alto |
| `useCampanhaDetalhes.ts` | contagem por status de Contato | Médio |
| `useProprietarios.ts` | estagio derivado de Contato | Médio |

---

### 2.4 Mensageria — Dois Sistemas Paralelos

Um impacto frequentemente subestimado: há **dois sistemas de mensagens distintos**:

```
Prospecção ativa (Contato):
  MensagemProspeccao  →  contatoId (FK)
  Armazena: direcao, conteudo, tipo, messageId, processadaPorIA, respostaGerada, toolsChamadas

Atendimento de Lead (Lead):
  Conversa  →  leadId
  Mensagem  →  conversaId
  Armazena: faseSPIN, agente, rating, duração, custo
```

Ao unificar, essas duas dimensões precisariam coexistir em um único modelo ou serem fundidas — implicando migração de dados históricos de produção com risco de perda.

---

### 2.5 Métricas e Funil

O funil de prospecção é baseado em `statusProspeccao` do Contato como dimensão:

```
AGUARDANDO → CONTATANDO → RESPONDEU → INTERESSADO → LEAD → (CAPTADO)
                                    ↓
                              SEM_INTERESSE / OPTOUT / FALHA
```

O `StatusLead` do Lead cobre a segunda metade do funil:

```
NOVO → TENTATIVA_AGENDAMENTO → VISITA_AGENDADA → AVALIACAO_EM_ANDAMENTO
     → DOCUMENTACAO → EM_NEGOCIACAO → ONBOARDING → CAPTADO
```

**Fusão implicaria criar um único enum de ~15 estados** que percorre toda a jornada, com lógicas de transição muito distintas entre a fase de prospecção (machine-driven, em massa) e qualificação (human-driven, individual).

---

## 3. Análise de Viabilidade por Abordagem

Foram analisadas três abordagens estratégicas:

---

### Abordagem A — Unificação Total (Big Bang)

> Eliminar a tabela `contatos` completamente. Tudo vira `Lead` desde a mineração.

**O que muda:**
- Mineração cria Leads direto com status inicial `PROSPECTANDO`
- `MensagemProspeccao` migra para `Conversa/Mensagem` com marcação de origem
- `tentativasContato`, `modoAtendimento`, `statusProspeccao` migram para o Lead
- Engine de disparo passa a operar sobre `leads WHERE status = 'PROSPECTANDO'`
- Cache Redis migra de `contatoId` para `leadId`
- 1.910 linhas de `contatos.rotas.ts` são refatoradas ou eliminadas
- 39 migrações existentes + 1 migration gigante com `ALTER TABLE`

**Vantagens:**
- Modelo mental simples: tudo é Lead
- Uma só consulta para buscar qualquer proprietário
- Elimina joins Lead ↔ Contato em todo o sistema
- `ProprietarioDetalhes` não precisa de fallback contatoOrigem

**Riscos:**
- **Dados em produção**: migração de `contatos` → `leads` com histórico de mensagens associado
- **Cache Redis invalidado**: conversas ativas perdem contexto durante migração
- **Índice `@@unique([tenantId, cpf])`**: Leads de campanhas diferentes com mesmo CPF colidem
- **Contadores de Campanha**: `totalContatos` / `totalLeads` perdem semântica distinta
- **Engine de disparo**: precisaria de filtros novos para não disparar para Leads em negociação avançada
- **Bloqueio de funcionalidade** durante semanas de refactor

| Critério | Avaliação |
|---|---|
| Esforço estimado | **14–20 semanas** |
| Risco de regressão | **Muito Alto** |
| Risco de perda de dados | **Alto** |
| Ganho arquitetural líquido | **Alto** |
| Recomendado agora? | **Não** |

---

### Abordagem B — Unificação Incremental (Fase de Prospecção no Lead)

> Adicionar ao Lead um conjunto de campos de prospecção. Mineração cria Lead diretamente. Contato vira entidade opcional/legada.

**O que muda:**
- Adicionar ao schema de `Lead`:
  ```
  faseProspecao       String?   // null = lead qualificado | 'AGUARDANDO', 'CONTATANDO'...
  tentativasDisparo   Int       @default(0)
  ultimoDisparo       DateTime?
  dataProximoContato  DateTime?
  modoAtendimento     String    @default("IA")
  atendidoPor         String?
  campanhaOrigemId    (já existe) String?
  ```
- Engine de disparo opera sobre `Lead WHERE faseProspeccao IS NOT NULL`
- Contato permanece como entidade legada para campanhas já criadas
- Novos disparos criam Lead direto
- Migração de Contatos existentes para Leads quando `virouLead = true` (já feita pelo use case existente)

**Vantagens:**
- Sem quebra de compatibilidade para dados existentes
- Migração progressiva: novas campanhas usam Lead direto
- Campanhas legadas continuam funcionando
- Engine de disparo tem caminho claro de migração
- Sem invalidação do cache Redis (pode usar leadId como nova chave gradualmente)

**Riscos:**
- Lead com `faseProspeccao` não nulo ainda é semanticamente diferente de um Lead qualificado — a distinção conceitual persiste, só muda onde ela está armazenada
- Engine de disparo precisa garantir que nunca dispare para Leads em fase `DOCUMENTACAO` ou `CAPTADO`
- `totalContatos` da Campanha perderia semântica (seria `totalLeadsProspecao`)
- O enum `@@unique([tenantId, cpf])` precisaria ser relaxado para permitir múltiplas campanhas com mesmo CPF

| Critério | Avaliação |
|---|---|
| Esforço estimado | **6–9 semanas** |
| Risco de regressão | **Médio** |
| Risco de perda de dados | **Baixo** |
| Ganho arquitetural líquido | **Médio** |
| Recomendado agora? | **Avaliar com produto** |

---

### Abordagem C — Ponte Inteligente (Mineração → Lead direto, Contato como tracking)

> Manter ambos os modelos, mas tornar o Contato **opcional e derivado**. A mineração pode criar Lead diretamente quando configurado. O Contato passa a ser só o tracker de estado de prospecção para campanhas que precisam de controle granular.

**O que muda:**
- Adicionar flag na Campanha: `criarLeadDireto: Boolean @default(false)`
- Quando `criarLeadDireto = true`: mineração cria Lead com `origem = 'mineracao_direta'`
- O SDR opera direto sobre o Lead (já é compatível — o SDR já funciona com leadId)
- Contato segue existindo para campanhas que precisam do controle granular (tentativas, modo atendimento)
- Sem migração de dados existentes
- `ProprietarioDetalhes` já funciona com Lead-only (corrigido nos fixes anteriores)

**Vantagens:**
- Zero risco de regressão para campanhas existentes
- Implementação em 2–3 semanas
- Entrega valor imediato (mineração → Lead direto)
- Não bloqueia nenhuma funcionalidade ativa
- Contato pode ser depreciado gradualmente ao longo de meses

**Riscos:**
- Mantém a dualidade por mais tempo (mas de forma controlada)
- Campanhas com `criarLeadDireto = true` perdem o controle de tentativas granular do Contato (a menos que o Lead receba os campos)
- Relatórios precisam distinguir origem dos Leads

| Critério | Avaliação |
|---|---|
| Esforço estimado | **2–4 semanas** |
| Risco de regressão | **Muito Baixo** |
| Risco de perda de dados | **Zero** |
| Ganho arquitetural líquido | **Parcial** |
| Recomendado agora? | **Sim, como passo 1** |

---

## 4. Mapa de Impacto por Ecossistema

| Ecossistema | Abordagem A | Abordagem B | Abordagem C |
|---|---|---|---|
| **Engine de Disparo** | Reescrita total | Refactor moderado | Sem mudança |
| **Webhook WhatsApp** | Reescrita total (~40 pontos) | Adaptação de chaves | Sem mudança |
| **Orquestrador / Agentes** | Refactor de roteamento | Adaptação parcial | Sem mudança |
| **Cache Redis (histórico)** | Invalidação + nova chave | Nova chave gradual | Sem mudança |
| **Schema / Migrações** | Migration destrutiva | Additive migrations | Additive migrations |
| **Frontend (32 arquivos)** | Refactor completo | Refactor parcial | Mínimo |
| **Métricas / Funil SDR** | Redesenho completo | Redesenho parcial | Sem mudança |
| **CRM Integration** | Sem impacto (já usa Lead) | Sem impacto | Sem impacto |
| **CSV Import/Export** | Reescrita (1.910 linhas) | Reescrita parcial | Sem mudança |
| **Dados históricos produção** | Migração com risco | Migração controlada | Zero migração |

---

## 5. Pré-condições para qualquer unificação

Independente da abordagem escolhida, estas premissas precisam ser atendidas **antes** de qualquer mudança estrutural:

### 5.1 Resolver o `@@unique([tenantId, cpf])` no Lead

Hoje o Lead tem unicidade por `[tenantId, cpf]`. Na prospecção ativa, o mesmo CPF pode aparecer em múltiplas campanhas diferentes dentro do mesmo tenant. Sem resolver essa constraint, a criação de Leads a partir da mineração falhará com duplicata de CPF.

**Solução**: trocar a constraint para `@@unique([tenantId, campanhaOrigemId, cpf])` ou remover o índice único e tratar duplicatas por lógica de negócio.

### 5.2 Definir a semântica de "tentativas" no Lead

O mecanismo de retry do engine de disparo é construído sobre campos do Contato que não existem no Lead. A decisão de negócio precisa definir:
- Um Lead em prospecção pode ter múltiplos disparos? (hoje: sim, via Contato)
- O Lead deve persistir o histórico de cada tentativa? Ou apenas a última?
- Um Lead `CAPTADO` ou `EM_NEGOCIACAO` deve ser imunizado de novos disparos?

### 5.3 Definir separação de histórico de mensagens

Hoje existem dois sistemas:
- `MensagemProspeccao` → histórico de prospecção ativa (SDR fase inicial)
- `Conversa/Mensagem` → histórico de atendimento qualificado (SDR fase avançada)

A decisão precisa definir se ambos se fundem em `Conversa` ou se `MensagemProspeccao` permanece como log de prospecção e `Conversa` como log de atendimento.

### 5.4 Estratégia de migração de cache Redis

O cache Redis usa `contatoId` como chave. Uma migração ao vivo (sem downtime) exige:
1. Suporte a duas chaves simultaneamente durante a transição
2. TTL dos caches antigos (hoje 24h) como janela de migração natural
3. Não há risco de perda de dados críticos (cache é volátil), mas conversas ativas podem perder contexto no momento da troca

---

## 6. Recomendação Estratégica

### Decisão imediata: Abordagem C (Ponte Inteligente)

**Implementar agora (2–4 semanas):** Adicionar a flag `criarLeadDireto` na Campanha para que novas campanhas de mineração possam criar Leads diretamente, sem passar pelo Contato. O Contato fica como entidade legada para campanhas existentes e para casos que precisam de controle granular de tentativas.

**Isso resolve o pedido original** (mineração → Lead direto) com risco zero para o sistema em produção.

---

### Decisão de médio prazo: Abordagem B (6–9 meses)

Após estabilizar a Abordagem C em produção e validar o comportamento de Leads criados diretamente da mineração, iniciar a Abordagem B de forma incremental:

1. **Sprint 1** (2 semanas): Adicionar campos de prospecção ao Lead, relaxar constraint CPF unique
2. **Sprint 2** (2 semanas): Migrar engine de disparo para operar sobre Lead
3. **Sprint 3** (2 semanas): Migrar webhook e cache Redis para leadId
4. **Sprint 4** (3 semanas): Migrar frontend e métricas
5. **Sprint 5** (2 semanas): Deprecar modelo Contato, manter como view para compatibilidade

---

### Não recomendado: Abordagem A (Big Bang)

A Abordagem A não é viável no estágio atual do sistema pelos seguintes motivos:

1. **697 referências diretas ao Contato** em código de produção — qualquer ponto esquecido gera bug silencioso
2. **Cache Redis invalidado** durante a migração quebra conversas em andamento
3. **Migration destrutiva** em 39 migrações já consolidadas representa risco de integridade de dados
4. **Semana de downtime** ou deploy em múltiplas etapas com feature flags para 6.321+ linhas de mudança
5. **ROI negativo** no curto prazo: o ganho arquitetural é real, mas o custo de 14–20 semanas com alto risco supera os benefícios quando existem alternativas mais seguras

---

## 7. Resumo Quantitativo

| Métrica | Valor |
|---|---|
| Referências ao Contato no backend | **697** em 32 arquivos |
| Referências ao Contato no frontend | **431** em 32 arquivos |
| Linhas nos 5 arquivos mais críticos | **6.321** |
| Migrações de banco existentes | **39** |
| Tabelas dependentes do Contato | **4** (contatos, mensagens_prospeccao, campanhas, leads) |
| Sistemas de cache impactados | **1** (Redis com TTL 24h) |
| Sistemas de mensageria paralelos | **2** (MensagemProspeccao + Conversa/Mensagem) |

| Abordagem | Esforço | Risco | Valor Entregue |
|---|---|---|---|
| A — Unificação Total | 14–20 sem | Muito Alto | Total |
| B — Unificação Incremental | 6–9 sem | Médio | Alto |
| C — Ponte Inteligente | 2–4 sem | Muito Baixo | Parcial |

---

*Relatório gerado após análise estática de 6.321+ linhas de código de produção e 39 migrações de banco.*
