# 🎯 PLANEJAMENTO: MÓDULO DE GESTÃO DE LEADS

**Data:** 06/12/2025  
**Objetivo:** MVP do módulo de gestão de leads qualificados pelo agente SDR

---

## 📊 ANÁLISE DO ESTADO ATUAL

### ✅ O que JÁ TEMOS:

#### 1. **Banco de Dados** (`prisma/schema.prisma`)
```typescript
model Lead {
  id                 String      @id @default(uuid())
  tenantId           String
  cpf                String?
  nome               String
  email              String?
  telefone           String?
  status             StatusLead  @default(NOVO)
  temperatura        Temperatura @default(FRIO)
  origem             String      @default("manual")
  primeiroContato    DateTime    @default(now())
  ultimaInteracao    DateTime?
  atividades         Atividade[]  // ⭐ TAREFAS/AGENDAMENTOS
  conversas          Conversa[]
  imoveis            Imovel[]
}

enum StatusLead {
  NOVO
  CONTATANDO
  QUALIFICADO        // ⭐ Estado após SDR qualificar
  EM_NEGOCIACAO
  CONVERTIDO
  PERDIDO
  INATIVO
}

enum Temperatura {
  FRIO
  MORNO
  QUENTE             // ⭐ Quando aceita avaliação
}

model Atividade {
  id           String        @id
  leadId       String
  tipo         TipoAtividade  // ⭐ TAREFA = Agendamento
  titulo       String
  descricao    String?
  agendadoPara DateTime?     // ⭐ Data da avaliação
  completadoEm DateTime?     // ⭐ NULL = Pendente
  resultado    String?
}

enum TipoAtividade {
  LIGACAO
  EMAIL
  WHATSAPP
  REUNIAO
  NOTA
  TAREFA                    // ⭐ Usado para agendamentos
}
```

#### 2. **Tools do SDR** (`sdr-tools.ts`)
```typescript
// ✅ JÁ IMPLEMENTADAS:
agendar_avaliacao({
  contatoId,
  dataAvaliacao: "15/12/2025 10:30",
  observacoes,
  enderecoImovel,
  tipoImovel
})
// Cria Lead se não existir
// Cria Atividade tipo=TAREFA
// Status → QUALIFICADO / Temperatura → QUENTE

agendar_followup({
  contatoId,
  dataRecontato: "20/12/2025 14:00",
  motivoAdiamento
})
// Agenda recontato futuro
```

#### 3. **Frontend Básico** (`Leads.tsx`)
```typescript
// ✅ JÁ EXISTE:
- Listagem de leads QUALIFICADOS
- Busca por nome/telefone/email
- Status badges (cores)
- Temperatura (🔥🌤️❄️)
- Chat modal
- Enviar WhatsApp teste

// ❌ FALTA:
- Detalhes do lead
- Timeline de atividades
- Gestão de agendamentos
- Confirmação/cancelamento
```

#### 4. **API Backend** (`rotas/leads.ts`)
```typescript
// ✅ JÁ EXISTE:
GET  /api/leads           // Lista leads qualificados
POST /api/leads           // Criar lead manual

// ❌ FALTA:
GET  /api/leads/:id                    // Detalhes
GET  /api/leads/:id/atividades         // Timeline
PUT  /api/leads/:id/atividades/:atId   // Confirmar/Cancelar
POST /api/leads/:id/notas              // Adicionar nota
```

---

## 🎯 PROBLEMAS A RESOLVER

### 🔴 **PROBLEMA 1: Lead qualificado fica "solto"**
**Situação:** SDR qualifica lead e agenda avaliação, mas corretor não vê claramente.

**Impacto:**
- ❌ Avaliações agendadas podem ser esquecidas
- ❌ Cliente liga reclamando que corretor não foi
- ❌ Perda de conversão

### 🔴 **PROBLEMA 2: Falta confirmação de agendamento**
**Situação:** Cliente pode ter imprevisto, mas não tem como avisar facilmente.

**Impacto:**
- ❌ Corretor vai até o local e ninguém atende
- ❌ Tempo desperdiçado
- ❌ Frustração cliente + corretor

### 🔴 **PROBLEMA 3: Sem visibilidade de agenda**
**Situação:** Corretor não sabe quais avaliações tem hoje/semana.

**Impacto:**
- ❌ Desorganização
- ❌ Duplo agendamento
- ❌ Falta de planejamento

---

## 🏗️ SOLUÇÃO PROPOSTA: MVP GESTÃO DE LEADS

### 📋 **MÓDULO 1: Visualização de Leads Qualificados**

#### 1.1 Tela: Lista de Leads (melhorada)
**Local:** `Leads.tsx` (já existe, melhorar)

**Adicionar:**
- 🔔 Badge "Avaliação Hoje" (visual chamativo)
- 📅 Coluna "Próxima Ação" (data agendamento)
- 🎯 Status detalhado (AGENDADO / CONFIRMADO / PENDENTE)
- 🔍 Filtros: Status, Temperatura, Data agendamento
- 📊 Cards resumo no topo:
  - "Avaliações Hoje" (3)
  - "Aguardando Confirmação" (5)
  - "Leads Quentes" (12)

#### 1.2 Tela: Detalhes do Lead (nova)
**Local:** `LeadDetalhes.tsx` (criar)

**Seções:**
```
┌─────────────────────────────────────────┐
│ 📋 INFORMAÇÕES BÁSICAS                  │
│ Nome, Telefone, Email, CPF              │
│ Origem, Data primeiro contato           │
├─────────────────────────────────────────┤
│ 🏠 IMÓVEL DE INTERESSE                  │
│ Endereço, Tipo, Área, Observações       │
├─────────────────────────────────────────┤
│ 📅 AGENDAMENTOS                         │
│ [Card destacado se houver pendente]     │
│ ┌─────────────────────────────────┐    │
│ │ 🔔 AVALIAÇÃO AGENDADA           │    │
│ │ Data: 15/12/2025 10:30          │    │
│ │ Local: Rua T-50, Setor Bueno    │    │
│ │ Status: ⏳ AGUARDANDO CONFIRMAÇÃO│    │
│ │                                  │    │
│ │ [Confirmar] [Reagendar] [Cancelar]  │
│ └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│ 💬 TIMELINE DE ATIVIDADES               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━       │
│ ● Hoje 14:30 - SDR qualificou lead     │
│ ● Hoje 14:32 - Avaliação agendada      │
│ ● Ontem - Lead respondeu WhatsApp      │
├─────────────────────────────────────────┤
│ 📝 NOTAS E OBSERVAÇÕES                  │
│ [Adicionar nota...]                     │
└─────────────────────────────────────────┘
```

---

### 📅 **MÓDULO 2: Gestão de Agendamentos**

#### 2.1 Status do Agendamento
```typescript
enum StatusAgendamento {
  PENDENTE           // Criado pelo SDR, aguardando
  CONFIRMADO         // Cliente confirmou
  CLIENTE_CONFIRMOU  // Via link confirmação
  CANCELADO          // Cliente cancelou
  REAGENDADO         // Nova data marcada
  CONCLUIDO          // Avaliação realizada
  NAO_COMPARECEU     // No-show
}
```

#### 2.2 Link de Confirmação (WhatsApp)
**Quando SDR agenda avaliação, enviar:**

```
Olá João! ✅

Sua avaliação está agendada:
📅 15/12/2025 às 10:30
📍 Rua T-50, 123 - Setor Bueno

Por favor, confirme sua presença:
👉 [CONFIRMAR PRESENÇA]
👉 [PRECISO REAGENDAR]

Qualquer dúvida, estou aqui!
Sofia 😊
```

**Links gerados:**
- `https://crm.elyon.com/confirmar/{tokenAgendamento}`
- `https://crm.elyon.com/reagendar/{tokenAgendamento}`

#### 2.3 Página de Confirmação (Landing Page)
**Rota:** `/confirmacao/:token`

**Visual:**
```
┌─────────────────────────────────────┐
│        🏠 Elyon Imóveis            │
│                                     │
│   Olá João! 👋                     │
│                                     │
│   Sua avaliação está confirmada:   │
│                                     │
│   📅 15/12/2025                    │
│   🕙 10:30                         │
│   📍 Rua T-50, 123                 │
│                                     │
│   [✅ Confirmar Presença]          │
│   [📅 Reagendar]                   │
│   [❌ Cancelar]                    │
│                                     │
│   Aguardamos você! 😊              │
└─────────────────────────────────────┘
```

#### 2.4 Notificações para Corretor
**Quando:**
- ✅ Cliente confirma → Notificação "João confirmou avaliação às 10:30"
- 📅 Cliente reagenda → Notificação "João pediu reagendamento"
- ❌ Cliente cancela → Notificação "João cancelou avaliação"
- ⏰ 1h antes → Lembrete "Avaliação em 1h - João Silva"

---

### 🔔 **MÓDULO 3: Sistema de Alertas**

#### 3.1 Alertas Automáticos
```typescript
// Tipos de Alerta
AVALIACAO_HOJE          // Manhã do dia
AGUARDANDO_CONFIRMACAO  // 24h sem resposta
CLIENTE_CONFIRMOU       // Imediato
CLIENTE_CANCELOU        // Imediato
LEAD_SEM_INTERACAO      // 3 dias sem contato
```

#### 3.2 Centro de Notificações
**Localização:** Sino no header (já existe)

**Adicionar alertas:**
- 🔔 "3 avaliações agendadas para hoje"
- ⏰ "João Silva - Avaliação em 1h"
- ✅ "Maria confirmou presença"
- ❌ "Carlos cancelou avaliação"

---

## 📐 ARQUITETURA TÉCNICA

### Backend (APIs novas)

```typescript
// ============================================
// LEADS - GESTÃO COMPLETA
// ============================================

// 1. Detalhes do lead
GET /api/leads/:id
Response: {
  lead: {
    id, nome, telefone, email, cpf,
    status, temperatura, origem,
    primeiroContato, ultimaInteracao
  },
  imovel: {
    endereco, tipo, area, observacoes
  },
  agendamentos: [{
    id, tipo, dataAgendamento,
    status, observacoes, tokenConfirmacao
  }],
  timeline: [{
    tipo, titulo, descricao, data, ator
  }]
}

// 2. Timeline de atividades
GET /api/leads/:id/timeline
Response: [{
  id, tipo, titulo, descricao, 
  criadoEm, criadoPor, resultado
}]

// 3. Confirmar agendamento
PUT /api/leads/:id/agendamentos/:agendamentoId/confirmar
Body: { confirmadoPor: 'cliente' | 'corretor' }
Response: { success: true, novoStatus: 'CONFIRMADO' }

// 4. Reagendar
PUT /api/leads/:id/agendamentos/:agendamentoId/reagendar
Body: { 
  novaData: "16/12/2025 15:00",
  motivo: "Cliente teve imprevisto"
}
Response: { success: true, novoAgendamentoId }

// 5. Cancelar
PUT /api/leads/:id/agendamentos/:agendamentoId/cancelar
Body: { motivo: "Cliente desistiu" }
Response: { success: true }

// 6. Adicionar nota
POST /api/leads/:id/notas
Body: { texto: "Cliente ligou pedindo mais info" }
Response: { notaId }

// ============================================
// CONFIRMAÇÃO PÚBLICA (sem auth)
// ============================================

// 7. Confirmar via link público
GET /api/confirmacao/:token
Response: { 
  agendamento: { data, hora, endereco, cliente },
  valido: true
}

POST /api/confirmacao/:token/confirmar
Response: { success: true }

POST /api/confirmacao/:token/reagendar
Body: { motivo, sugestaoData }
Response: { success: true }

// ============================================
// DASHBOARD
// ============================================

// 8. Resumo do dia
GET /api/leads/dashboard/hoje
Response: {
  avaliacoesHoje: 3,
  aguardandoConfirmacao: 5,
  leadsQuentes: 12,
  proximaAvaliacao: { lead, horario }
}
```

### Frontend (Páginas/Componentes)

```typescript
// ============================================
// PÁGINAS
// ============================================

src/paginas/
  Leads.tsx                  // ✅ Já existe, melhorar
  LeadDetalhes.tsx           // 🆕 Criar
  Agenda.tsx                 // 🆕 Criar (view calendário)
  ConfirmacaoPublica.tsx     // 🆕 Criar (landing page)

// ============================================
// COMPONENTES
// ============================================

src/componentes/
  lead/
    LeadHeader.tsx           // Info básica + badges
    AgendamentoCard.tsx      // Card de agendamento
    TimelineAtividades.tsx   // Lista de atividades
    NotasSection.tsx         // Notas e observações
  
  agenda/
    CalendarioSemanal.tsx    // View semanal
    CardAvaliacao.tsx        // Card na agenda
    ModalReagendar.tsx       // Dialog reagendar
```

---

## 🎨 DESIGN SYSTEM

### Cores por Status

```typescript
const STATUS_COLORS = {
  // Agendamentos
  PENDENTE: 'yellow',           // ⏳ Aguardando
  CONFIRMADO: 'green',          // ✅ Confirmado
  CANCELADO: 'red',             // ❌ Cancelado
  CONCLUIDO: 'blue',            // ✓ Realizado
  NAO_COMPARECEU: 'orange',     // 👻 No-show
  
  // Leads
  NOVO: 'blue',
  QUALIFICADO: 'green',
  EM_NEGOCIACAO: 'purple',
  
  // Temperatura
  QUENTE: 'red',                // 🔥
  MORNO: 'yellow',              // 🌤️
  FRIO: 'blue'                  // ❄️
}
```

### Ícones

```typescript
const ICONS = {
  AVALIACAO: '🏠',
  TELEFONE: '📞',
  WHATSAPP: '💬',
  EMAIL: '✉️',
  NOTA: '📝',
  ALERTA: '🔔',
  CALENDARIO: '📅',
  CONFIRMADO: '✅',
  CANCELADO: '❌',
  PENDENTE: '⏳'
}
```

---

## 📅 CRONOGRAMA DE IMPLEMENTAÇÃO

### 🚀 **FASE 1: Backend + APIs** (2-3h)
- [x] Analisar estrutura atual
- [ ] Criar rotas de leads detalhadas
- [ ] Implementar confirmação de agendamento
- [ ] Sistema de tokens público
- [ ] Atualizar schema Prisma (adicionar status agendamento)

### 🎨 **FASE 2: Frontend - Detalhes do Lead** (2-3h)
- [ ] Criar página `LeadDetalhes.tsx`
- [ ] Componente `AgendamentoCard`
- [ ] Componente `TimelineAtividades`
- [ ] Integração com APIs

### 🌐 **FASE 3: Landing Page Confirmação** (1-2h)
- [ ] Página pública `/confirmacao/:token`
- [ ] Design responsivo mobile-first
- [ ] Confirmação via API

### 🔔 **FASE 4: Notificações e Alertas** (1-2h)
- [ ] Integrar alertas de agendamento
- [ ] Badge "Hoje" na listagem
- [ ] Dashboard resumo do dia

### ✅ **FASE 5: Melhorias Lista de Leads** (1h)
- [ ] Filtros avançados
- [ ] Cards resumo no topo
- [ ] Ordenação por data agendamento

---

## 💡 IDEIAS FUTURAS (Pós-MVP)

### 🤖 **IA no Agendamento**
- Sugerir melhores horários baseado em histórico
- Detectar padrões de cancelamento
- Prever no-shows

### 📊 **Analytics**
- Taxa de confirmação
- Taxa de no-show
- Tempo médio até conversão
- Melhores horários de avaliação

### 🔗 **Integrações**
- Google Calendar sync
- Lembretes via WhatsApp (1 dia antes, 1h antes)
- Feedback pós-avaliação automático

### 📱 **App Corretor**
- Ver agenda do dia no mobile
- Check-in na avaliação
- Upload de fotos do imóvel

---

## 🎯 MÉTRICAS DE SUCESSO

**MVP será considerado sucesso se:**
- ✅ 100% das avaliações agendadas ficam visíveis
- ✅ 80%+ dos clientes confirmam presença
- ✅ Redução de 50% em no-shows
- ✅ Corretores conseguem ver agenda da semana
- ✅ Cliente consegue reagendar sozinho

---

## 🚨 RISCOS E MITIGAÇÕES

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Cliente não abre link WhatsApp | Médio | Enviar lembrete 1 dia antes |
| Token de confirmação vaza | Alto | Expiração em 30 dias + validação |
| Corretor não vê notificação | Alto | Badge visual + alertas sonoros |
| Duplo agendamento | Médio | Validar horário disponível |

---

## 📝 PRÓXIMOS PASSOS

1. ✅ **Aprovação deste planejamento**
2. 🔨 **Implementar FASE 1: Backend**
3. 🎨 **Implementar FASE 2: Frontend Detalhes**
4. 🌐 **Implementar FASE 3: Landing Page**
5. 🧪 **Testes E2E do fluxo completo**
6. 🚀 **Deploy MVP**

---

**Pronto para começar?** 🚀
