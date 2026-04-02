# 📋 PLANEJAMENTO: GESTÃO DE LEADS DE CAPTAÇÃO

**Data:** 05/12/2025  
**Contexto:** Módulo final do MVP - Sistema de gestão de leads captados via SPIN Selling  
**Objetivo:** Permitir que corretores gerenciem leads qualificados pelo SDR Captador

---

## 🎯 CONTEXTO DO NEGÓCIO

### **SDR = CAPTADOR de Imóveis**
- **NÃO vende** imóveis para clientes
- **CAPTA** imóveis de proprietários
- **Cliente:** Proprietário que quer vender/alugar
- **Serviço:** Ajudar proprietário a vender/alugar o imóvel dele

### **Corretor usa CRM para:**
1. Ver leads qualificados pelo SDR
2. Entender contexto SPIN completo
3. Preparar visita de avaliação
4. Gerenciar agendamentos
5. Fazer follow-up estruturado

---

## 📊 ARQUITETURA DE DADOS

### **1. Model Lead (Prisma Schema)**

```prisma
model Lead {
  id                 String         @id @default(uuid())
  nome               String
  telefone           String
  email              String?
  
  // Relacionamentos:
  contatoId          String
  contato            Contato        @relation(fields: [contatoId], references: [id])
  empreendimentoId   String?
  empreendimento     Empreendimento? @relation(fields: [empreendimentoId], references: [id])
  
  // Status e temperatura:
  status             StatusLead     @default(NOVO)
  temperatura        Temperatura    @default(FRIO)
  
  // 🆕 DADOS DO IMÓVEL (do proprietário):
  enderecoImovel     String?        // Endereço completo
  tipoImovel         String?        // apartamento, casa, comercial, terreno
  areaImovel         String?        // "100m²", "grande"
  quartosImovel      Int?           // Número de quartos
  vagasImovel        Int?           // Vagas de garagem
  valorPretendido    String?        // "R$ 650.000", "entre 600-700k"
  ocupacao           String?        // "ocupado", "vazio"
  interesseEm        String?        // "vender", "alugar", "ambos"
  
  // 🆕 QUALIFICAÇÃO SPIN (descoberta do SDR):
  
  // S - SITUAÇÃO:
  situacaoAtual      String?        // "Imóvel vazio há 6 meses"
  tempoDecisao       String?        // "Decidiu vender há 2 meses"
  tentativasAnteriores String?      // "Tentou sozinho, sem sucesso"
  comCorretorAtualmente Boolean?    // Está com outro corretor?
  
  // P - PROBLEMA:
  motivacaoVenda     String?        // "Mudança de cidade por trabalho"
  doresIdentificadas String[]       // ["Sem visitantes", "Propostas baixas"]
  
  // I - IMPLICAÇÃO:
  prazoDesejado      String?        // "Precisa vender em 3 meses"
  urgencia           Urgencia?      // BAIXA, MEDIA, ALTA
  consequencias      String?        // "Perdendo aluguel todo mês"
  custosAtuais       String?        // "Pagando condomínio + IPTU = R$ 1.200/mês"
  pressaoTempo       Boolean?       // true/false
  
  // N - NECESSIDADE DE SOLUÇÃO:
  expectativaServico String?        // "Quer corretor que traga compradores"
  objecoes           String[]       // ["Preocupado com comissão"]
  interesseAvaliacao Boolean?       // Aceitou avaliação?
  
  // Observações gerais do SPIN:
  observacoesSpin    String?        @db.Text
  
  // Atividades e conversas:
  atividades         Atividade[]
  conversas          Conversa[]
  
  // Metadados:
  criadoEm           DateTime       @default(now())
  atualizadoEm       DateTime       @updatedAt
  
  @@index([contatoId])
  @@index([empreendimentoId])
  @@index([status])
  @@index([temperatura])
}

enum StatusLead {
  NOVO              // Recém captado pelo SDR
  CONTATANDO        // SDR em conversa
  QUALIFICADO       // SPIN completo, pronto para corretor
  EM_AVALIACAO      // Corretor agendou/fez avaliação
  EM_NEGOCIACAO     // Proposta de captação apresentada
  CAPTADO           // Imóvel captado! (contrato assinado)
  PERDIDO           // Não quis o serviço
  INATIVO           // Sem resposta
}

enum Temperatura {
  FRIO              // Baixo interesse
  MORNO             // Interesse médio
  QUENTE            // Alto interesse, urgente
}

enum Urgencia {
  BAIXA             // Sem pressa
  MEDIA             // 3-6 meses
  ALTA              // < 3 meses, urgente
}
```

### **2. Model Atividade (já existe, só ajustar)**

```prisma
model Atividade {
  id              String         @id @default(uuid())
  tipo            TipoAtividade
  titulo          String
  descricao       String?        @db.Text
  
  // Agendamento:
  agendadoPara    DateTime?      // Data/hora da avaliação
  dataLimite      DateTime?
  completadoEm    DateTime?
  
  // 🆕 CONFIRMAÇÃO DE AGENDAMENTO:
  statusAgendamento StatusAgendamento? @default(PENDENTE)
  confirmacoesEnviadas Int?      @default(0)
  confirmadoPor   String?        // "proprietario", "sistema", "corretor"
  confirmadoEm    DateTime?
  canceladoPor    String?
  canceladoEm     DateTime?
  motivoCancelamento String?
  
  // 🆕 TOKEN para confirmação pública:
  tokenConfirmacao String?       @unique  // UUID para link público
  
  // Relacionamentos:
  leadId          String?
  lead            Lead?          @relation(fields: [leadId], references: [id])
  usuarioId       String?
  usuario         Usuario?       @relation(fields: [usuarioId], references: [id])
  
  criadoEm        DateTime       @default(now())
  atualizadoEm    DateTime       @updatedAt
  
  @@index([leadId])
  @@index([tipo])
  @@index([agendadoPara])
  @@index([statusAgendamento])
  @@index([tokenConfirmacao])
}

enum TipoAtividade {
  TAREFA            // Tarefa genérica
  AVALIACAO         // Visita de avaliação no imóvel
  LIGACAO           // Ligar para o proprietário
  FOLLOW_UP         // Retomar contato
  REUNIAO           // Reunião presencial
}

enum StatusAgendamento {
  PENDENTE          // Aguardando confirmação
  CONFIRMADO        // Proprietário confirmou
  CANCELADO         // Cancelado
  REALIZADO         // Avaliação concluída
  NAO_COMPARECEU    // No-show
}
```

---

## 🔧 BACKEND - APIs NECESSÁRIAS

### **3.1. API: GET /api/leads (listar)**

```typescript
// GET /api/leads?status=QUALIFICADO&temperatura=QUENTE&pagina=1
// Query params:
// - status?: StatusLead
// - temperatura?: Temperatura
// - urgencia?: Urgencia
// - empreendimentoId?: string
// - busca?: string (nome, telefone)
// - pagina?: number
// - limite?: number

Response: {
  leads: [
    {
      id: "uuid",
      nome: "João Silva",
      telefone: "(62) 99999-9999",
      email: "joao@email.com",
      status: "QUALIFICADO",
      temperatura: "QUENTE",
      urgencia: "ALTA",
      
      // Imóvel:
      enderecoImovel: "Rua X, 123 - Setor Bueno",
      tipoImovel: "apartamento",
      quartosImovel: 3,
      valorPretendido: "R$ 650.000",
      
      // SPIN resumido:
      motivacaoVenda: "Mudança de cidade",
      prazoDesejado: "60 dias",
      
      // Próxima atividade:
      proximaAtividade: {
        tipo: "AVALIACAO",
        agendadoPara: "2025-12-10T14:00:00Z",
        statusAgendamento: "CONFIRMADO"
      },
      
      criadoEm: "2025-12-05T10:00:00Z"
    }
  ],
  total: 45,
  pagina: 1,
  totalPaginas: 5
}
```

### **3.2. API: GET /api/leads/:id (detalhes)**

```typescript
// GET /api/leads/uuid-do-lead

Response: {
  // Dados básicos:
  id: "uuid",
  nome: "João Silva",
  telefone: "(62) 99999-9999",
  email: "joao@email.com",
  status: "QUALIFICADO",
  temperatura: "QUENTE",
  
  // Imóvel completo:
  imovel: {
    endereco: "Rua X, 123, Apto 501 - Setor Bueno, Goiânia",
    tipo: "apartamento",
    area: "100m²",
    quartos: 3,
    vagas: 2,
    valorPretendido: "R$ 650.000",
    ocupacao: "vazio",
    interesseEm: "vender"
  },
  
  // SPIN completo:
  spin: {
    situacao: {
      situacaoAtual: "Imóvel vazio há 4 meses após mudança",
      tempoDecisao: "Decidiu vender há 2 meses",
      tentativasAnteriores: "Tentou vender sozinho por 3 meses",
      comCorretorAtualmente: false
    },
    problema: {
      motivacaoVenda: "Mudança de cidade por trabalho",
      doresIdentificadas: [
        "Poucas visitas (apenas 3 em 2 meses)",
        "Propostas muito baixas (R$ 500k quando pede 650k)",
        "Sem tempo para organizar visitas"
      ]
    },
    implicacao: {
      prazoDesejado: "60 dias",
      urgencia: "ALTA",
      consequencias: "Já comprou imóvel em SP, tem compromisso financeiro duplo",
      custosAtuais: "R$ 1.200/mês (condomínio + IPTU)",
      pressaoTempo: true
    },
    necessidade: {
      expectativaServico: "Quer corretor especializado que traga compradores reais",
      objecoes: ["Preocupado com comissão de 6%"],
      interesseAvaliacao: true
    },
    observacoesSpin: "Proprietário muito receptivo e profissional..."
  },
  
  // Empreendimento (se houver):
  empreendimento: {
    id: "uuid",
    nome: "Residencial Vista Verde",
    construtora: "Construtora XYZ"
  },
  
  // Atividades (timeline):
  atividades: [
    {
      id: "uuid",
      tipo: "AVALIACAO",
      titulo: "Avaliação do imóvel",
      agendadoPara: "2025-12-10T14:00:00Z",
      statusAgendamento: "CONFIRMADO",
      confirmadoEm: "2025-12-05T15:30:00Z",
      criadoEm: "2025-12-05T10:00:00Z"
    },
    {
      id: "uuid",
      tipo: "FOLLOW_UP",
      titulo: "Follow-up inicial",
      completadoEm: "2025-12-04T16:00:00Z",
      criadoEm: "2025-12-04T14:00:00Z"
    }
  ],
  
  // Conversas (histórico SDR):
  conversas: [
    {
      id: "uuid",
      mensagem: "Boa tarde, João! Aqui é da Imobiliária...",
      direcao: "ENVIADA",
      criadoEm: "2025-12-05T10:00:00Z"
    }
  ],
  
  criadoEm: "2025-12-05T10:00:00Z",
  atualizadoEm: "2025-12-05T15:30:00Z"
}
```

### **3.3. API: POST /api/leads (criar manualmente)**

```typescript
// POST /api/leads
Body: {
  contatoId: "uuid",
  nome: "João Silva",
  telefone: "(62) 99999-9999",
  email?: "joao@email.com",
  
  // Dados iniciais:
  status?: "NOVO",
  temperatura?: "MORNO",
  observacoes?: "Lead criado manualmente..."
}

Response: {
  id: "uuid",
  nome: "João Silva",
  status: "NOVO",
  criadoEm: "2025-12-05T10:00:00Z"
}
```

### **3.4. API: PATCH /api/leads/:id (atualizar)**

```typescript
// PATCH /api/leads/uuid-do-lead
Body: {
  status?: "EM_AVALIACAO",
  temperatura?: "QUENTE",
  observacoesSpin?: "Atualização após ligação...",
  // ... qualquer campo do Lead
}

Response: {
  id: "uuid",
  status: "EM_AVALIACAO",
  atualizadoEm: "2025-12-05T16:00:00Z"
}
```

### **3.5. API: POST /api/leads/:id/atividades (criar atividade)**

```typescript
// POST /api/leads/uuid-do-lead/atividades
Body: {
  tipo: "AVALIACAO",
  titulo: "Avaliação do apartamento",
  descricao?: "Visita para avaliar o imóvel...",
  agendadoPara: "2025-12-10T14:00:00Z",
  usuarioId?: "uuid-do-corretor"
}

Response: {
  id: "uuid",
  tipo: "AVALIACAO",
  titulo: "Avaliação do apartamento",
  agendadoPara: "2025-12-10T14:00:00Z",
  statusAgendamento: "PENDENTE",
  tokenConfirmacao: "uuid-token",
  criadoEm: "2025-12-05T10:00:00Z"
}
```

### **3.6. API: GET /api/atividades/:id/confirmar/:token (pública)**

```typescript
// GET /api/atividades/uuid-atividade/confirmar/uuid-token
// Página pública para proprietário confirmar/cancelar

Response: {
  atividade: {
    tipo: "AVALIACAO",
    titulo: "Avaliação do imóvel",
    agendadoPara: "2025-12-10T14:00:00Z",
    statusAgendamento: "PENDENTE",
    
    // Dados para exibir:
    lead: {
      nome: "João Silva",
      enderecoImovel: "Rua X, 123 - Setor Bueno"
    },
    corretor: {
      nome: "Carlos Vendedor",
      telefone: "(62) 98888-8888"
    }
  },
  tokenValido: true
}
```

### **3.7. API: POST /api/atividades/:id/confirmar/:token (pública)**

```typescript
// POST /api/atividades/uuid-atividade/confirmar/uuid-token
Body: {
  acao: "confirmar" | "cancelar",
  motivoCancelamento?: "Não posso mais", "Horário ruim", "Outro"
}

Response: {
  statusAgendamento: "CONFIRMADO",
  confirmadoEm: "2025-12-05T15:30:00Z",
  mensagem: "Agendamento confirmado com sucesso!"
}
```

### **3.8. API: GET /api/leads/estatisticas (dashboard)**

```typescript
// GET /api/leads/estatisticas

Response: {
  total: 127,
  porStatus: {
    NOVO: 15,
    CONTATANDO: 8,
    QUALIFICADO: 42,
    EM_AVALIACAO: 18,
    EM_NEGOCIACAO: 12,
    CAPTADO: 25,
    PERDIDO: 7
  },
  porTemperatura: {
    FRIO: 30,
    MORNO: 50,
    QUENTE: 47
  },
  porUrgencia: {
    BAIXA: 40,
    MEDIA: 52,
    ALTA: 35
  },
  avaliacoesHoje: 3,
  avaliacoesEstaSemana: 12,
  proximasAvaliacoes: [
    {
      leadNome: "João Silva",
      agendadoPara: "2025-12-10T14:00:00Z",
      statusAgendamento: "CONFIRMADO"
    }
  ]
}
```

---

## 🎨 FRONTEND - INTERFACE DO CRM

### **4.1. Página: Lista de Leads**

**Arquivo:** `pacotes/frontend/src/paginas/Leads.tsx` (já existe, melhorar)

**Melhorias necessárias:**

```tsx
// CARDS DE ESTATÍSTICAS (topo):
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ 📊 Total    │ 🔥 Quentes  │ ⏰ Urgentes │ 📅 Avaliaç. │
│    127      │     47      │     35      │      3      │
└─────────────┴─────────────┴─────────────┴─────────────┘

// FILTROS:
┌────────────────────────────────────────────────────────┐
│ 🔍 Buscar: [___________]                              │
│                                                        │
│ Status: [Todos ▼] Temperatura: [Todos ▼]             │
│ Urgência: [Todos ▼] Empreendimento: [Todos ▼]        │
└────────────────────────────────────────────────────────┘

// TABELA DE LEADS:
┌──────────────────────────────────────────────────────────────────┐
│ Nome          | Imóvel        | Motivação    | Prazo | Próx.Ativ│
├──────────────────────────────────────────────────────────────────┤
│ 🔥 João Silva | 📍 Apt 3Q     | Mudança      | 60d   | 📅 10/12 │
│    Bueno      | R$ 650k       | QUENTE       | ALTA  | 14h      │
│    QUALIFICADO                                                   │
├──────────────────────────────────────────────────────────────────┤
│ 🌤️ Maria Souza| 📍 Casa 4Q    | Investimento | 6m    | 📞 08/12 │
│    Sul        | R$ 900k       | MORNO        | MÉDIA | 10h      │
│    CONTATANDO                                                    │
└──────────────────────────────────────────────────────────────────┘

// BADGES:
- Status: cores diferentes (verde=QUALIFICADO, azul=CONTATANDO, etc)
- Temperatura: 🔥 QUENTE, 🌤️ MORNO, ❄️ FRIO
- Urgência: 🔴 ALTA, 🟡 MÉDIA, 🟢 BAIXA
```

**Funcionalidades:**
- ✅ Filtros dinâmicos
- ✅ Busca por nome/telefone
- ✅ Ordenação (prazo, temperatura, data)
- ✅ Paginação
- ✅ Click no lead → abrir detalhes

---

### **4.2. Página: Detalhes do Lead**

**Arquivo:** `pacotes/frontend/src/paginas/LeadDetalhes.tsx` (criar novo)

**Layout:**

```tsx
┌─────────────────────────────────────────────────────────────────┐
│ ← Voltar                                                        │
│                                                                 │
│ 🔥 JOÃO SILVA - QUENTE                                          │
│ (62) 99999-9999 | joao@email.com                               │
│                                                                 │
│ [QUALIFICADO]  [Mudar Status ▼]                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 🏠 DADOS DO IMÓVEL                                              │
├─────────────────────────────────────────────────────────────────┤
│ 📍 Endereço:                                                    │
│    Rua X, 123, Apto 501 - Setor Bueno, Goiânia                 │
│                                                                 │
│ 🏢 Tipo: Apartamento  |  📏 Área: 100m²                        │
│ 🛏️ Quartos: 3         |  🚗 Vagas: 2                           │
│                                                                 │
│ 💰 Valor Pretendido: R$ 650.000                                │
│ 📦 Ocupação: Vazio    |  🎯 Interesse: Vender                  │
│                                                                 │
│ 🏗️ Empreendimento: Residencial Vista Verde                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 📊 QUALIFICAÇÃO SPIN                                            │
├─────────────────────────────────────────────────────────────────┤
│ 📍 SITUAÇÃO:                                                    │
│   • Imóvel vazio há 4 meses após mudança                       │
│   • Decidiu vender há 2 meses                                  │
│   • Tentou vender sozinho por 3 meses sem sucesso             │
│   • Não está com corretor atualmente                           │
│                                                                 │
│ ⚠️ PROBLEMA:                                                    │
│   • Motivação: Mudança de cidade por trabalho                  │
│   • Dores:                                                      │
│     - Poucas visitas (apenas 3 em 2 meses)                     │
│     - Propostas muito baixas (R$ 500k vs R$ 650k)             │
│     - Sem tempo para organizar visitas                         │
│                                                                 │
│ ⚡ IMPLICAÇÃO:                                                  │
│   • Prazo: 60 dias (URGÊNCIA ALTA 🔴)                          │
│   • Consequências: Já comprou imóvel em SP, compromisso duplo │
│   • Custos atuais: R$ 1.200/mês (condomínio + IPTU)          │
│   • Pressão de tempo: SIM                                      │
│                                                                 │
│ ✅ NECESSIDADE:                                                 │
│   • Expectativa: Corretor especializado com compradores reais  │
│   • Objeções: Preocupado com comissão de 6%                   │
│   • Aceitou avaliação: SIM                                     │
│                                                                 │
│ 📝 Observações do SDR:                                          │
│    "Proprietário muito receptivo e profissional. Frustrado     │
│     com experiência anterior. Mencionou que vizinho vendeu     │
│     rápido com imobiliária. Documentação em dia."              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 📅 PRÓXIMAS ATIVIDADES                                          │
├─────────────────────────────────────────────────────────────────┤
│ ✅ Avaliação do imóvel - 10/12/2025 às 14h                     │
│    Status: CONFIRMADO pelo proprietário em 05/12 às 15h30     │
│    [Ver Detalhes] [Reagendar] [Cancelar]                      │
│                                                                 │
│ [+ Nova Atividade]                                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 📜 TIMELINE                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 🟢 05/12/2025 15:30                                            │
│    Proprietário confirmou avaliação para 10/12 às 14h         │
│                                                                 │
│ 📅 05/12/2025 10:15                                            │
│    Avaliação agendada pelo SDR                                 │
│                                                                 │
│ ✅ 05/12/2025 10:00                                            │
│    Lead qualificado pelo SDR (QUENTE)                          │
│                                                                 │
│ 💬 05/12/2025 09:45                                            │
│    SDR: "Proprietário demonstrou urgência..."                  │
│                                                                 │
│ 📞 05/12/2025 09:30                                            │
│    Primeira conversa iniciada pelo SDR                         │
└─────────────────────────────────────────────────────────────────┘
```

**Componentes:**
1. **Header:** Nome, telefone, email, status, temperatura
2. **Card Imóvel:** Todos dados do imóvel
3. **Card SPIN:** Quatro seções (S, P, I, N) com dados estruturados
4. **Card Atividades:** Próximas ações agendadas
5. **Timeline:** Histórico completo de interações

---

### **4.3. Página: Confirmação Pública de Agendamento**

**Arquivo:** `pacotes/frontend/src/paginas/ConfirmarAgendamento.tsx` (criar novo)

**Rota:** `/confirmar/:atividadeId/:token` (SEM autenticação)

**Layout:**

```tsx
┌─────────────────────────────────────────────────────────────────┐
│                    🏢 IMOBILIÁRIA QUADRADOIS                    │
│                                                                 │
│                 📅 CONFIRMAÇÃO DE AGENDAMENTO                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Olá, João Silva!                                                │
│                                                                 │
│ Você tem uma avaliação agendada:                               │
│                                                                 │
│ 📅 Data: Terça-feira, 10 de Dezembro de 2025                   │
│ 🕐 Horário: 14:00                                              │
│ 📍 Local: Rua X, 123, Apto 501 - Setor Bueno                  │
│                                                                 │
│ 👤 Corretor: Carlos Vendedor                                    │
│ 📱 Telefone: (62) 98888-8888                                   │
│                                                                 │
│ ┌───────────────────┐  ┌───────────────────┐                  │
│ │ ✅ CONFIRMAR      │  │ ❌ CANCELAR       │                  │
│ └───────────────────┘  └───────────────────┘                  │
│                                                                 │
│ ℹ️ Caso precise remarcar, entre em contato com nosso corretor │
└─────────────────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- ✅ Validar token
- ✅ Mostrar detalhes do agendamento
- ✅ Botão CONFIRMAR (verde)
- ✅ Botão CANCELAR (vermelho, pede motivo)
- ✅ Feedback visual após ação
- ✅ WhatsApp do corretor para contato

**Modal de Cancelamento:**
```tsx
┌─────────────────────────────────────────────────────────────────┐
│ ❌ Cancelar Agendamento                                         │
├─────────────────────────────────────────────────────────────────┤
│ Motivo do cancelamento:                                         │
│                                                                 │
│ ( ) Não posso mais neste horário                               │
│ ( ) Não tenho mais interesse                                   │
│ ( ) Já contratei outro corretor                                │
│ ( ) Outro: [_________________]                                 │
│                                                                 │
│        [Voltar]  [Confirmar Cancelamento]                      │
└─────────────────────────────────────────────────────────────────┘
```

---

### **4.4. Modal: Nova Atividade**

**Componente:** `NovaAtividade.tsx` (criar)

```tsx
┌─────────────────────────────────────────────────────────────────┐
│ 📅 Nova Atividade                                               │
├─────────────────────────────────────────────────────────────────┤
│ Tipo:                                                           │
│ ( ) Avaliação  ( ) Ligação  ( ) Follow-up  ( ) Reunião        │
│                                                                 │
│ Título:                                                         │
│ [________________________________________]                      │
│                                                                 │
│ Descrição:                                                      │
│ [________________________________________]                      │
│ [________________________________________]                      │
│                                                                 │
│ Data e Hora:                                                    │
│ [10/12/2025] às [14:00]                                        │
│                                                                 │
│ ☑️ Enviar confirmação para proprietário                        │
│                                                                 │
│           [Cancelar]  [Criar Atividade]                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔔 SISTEMA DE NOTIFICAÇÕES

### **5.1. WhatsApp: Confirmação de Agendamento**

**Quando:** SDR agenda avaliação via `agendar_avaliacao`

**Template:**
```
Olá, {{nome}}! 👋

Sua avaliação foi agendada! 📅

📍 Endereço: {{endereco}}
🗓️ Data: {{data}}
🕐 Horário: {{hora}}
👤 Corretor: {{nomeCorretor}}

Para CONFIRMAR ou CANCELAR, acesse:
{{linkConfirmacao}}

Qualquer dúvida, fale com:
📱 {{telefoneCorretor}}

Imobiliária QuadradoIs
```

### **5.2. WhatsApp: Lembrete 24h antes**

**Quando:** 24h antes da avaliação (se status = PENDENTE ou CONFIRMADO)

**Template:**
```
Olá, {{nome}}! 👋

Lembrete: sua avaliação é AMANHÃ! 📅

🗓️ {{data}} às {{hora}}
📍 {{endereco}}
👤 Corretor: {{nomeCorretor}}

Status: {{statusConfirmacao}}

{{#se_pendente}}
⚠️ Você ainda não confirmou!
Confirme aqui: {{linkConfirmacao}}
{{/se_pendente}}

Nos vemos lá! 🏠
```

### **5.3. Notificação Interna: Confirmação recebida**

**Quando:** Proprietário confirma/cancela agendamento

**Para:** Corretor responsável (in-app + email)

**Template:**
```
✅ João Silva CONFIRMOU a avaliação!

📅 10/12/2025 às 14:00
📍 Rua X, 123, Apto 501 - Setor Bueno

[Ver Lead]
```

---

## 🧪 TESTES NECESSÁRIOS

### **6.1. Testes Backend**

```typescript
// tests/api/leads.test.ts

describe('API Leads', () => {
  test('GET /api/leads - lista com filtros')
  test('GET /api/leads/:id - detalhes completos')
  test('POST /api/leads - criar lead manual')
  test('PATCH /api/leads/:id - atualizar status')
  test('POST /api/leads/:id/atividades - criar atividade')
  test('GET /api/leads/estatisticas - dashboard')
})

describe('API Confirmação Pública', () => {
  test('GET /api/atividades/:id/confirmar/:token - validar token')
  test('POST /api/atividades/:id/confirmar/:token - confirmar')
  test('POST /api/atividades/:id/confirmar/:token - cancelar')
  test('Token inválido retorna 404')
})
```

### **6.2. Testes Frontend**

```typescript
// tests/Leads.test.tsx
test('Lista leads com filtros')
test('Filtros aplicam corretamente')
test('Paginação funciona')
test('Click no lead abre detalhes')

// tests/LeadDetalhes.test.tsx
test('Exibe dados SPIN completos')
test('Exibe timeline de atividades')
test('Permite criar nova atividade')
test('Permite mudar status')

// tests/ConfirmarAgendamento.test.tsx
test('Valida token e exibe dados')
test('Confirmação funciona')
test('Cancelamento pede motivo')
test('Token inválido mostra erro')
```

---

## 📦 FASES DE IMPLEMENTAÇÃO

### **FASE 1: Backend Core (2-3h)**

**Prioridade:** ⭐⭐⭐ CRÍTICA

- [ ] Migration Prisma: adicionar campos SPIN no Lead
- [ ] Migration Prisma: adicionar StatusAgendamento e tokenConfirmacao na Atividade
- [ ] API: GET /api/leads (listar)
- [ ] API: GET /api/leads/:id (detalhes)
- [ ] API: PATCH /api/leads/:id (atualizar)
- [ ] Testes unitários das APIs

**Entregável:** CRUD básico de Leads funcionando

---

### **FASE 2: Página de Detalhes do Lead (2h)**

**Prioridade:** ⭐⭐⭐ CRÍTICA

- [ ] Criar `LeadDetalhes.tsx`
- [ ] Card de dados do imóvel
- [ ] Card de qualificação SPIN (4 seções)
- [ ] Card de próximas atividades
- [ ] Timeline de interações
- [ ] Integrar com API GET /api/leads/:id

**Entregável:** Corretor consegue ver lead completo no CRM

---

### **FASE 3: Sistema de Agendamento (2h)**

**Prioridade:** ⭐⭐⭐ CRÍTICA

- [ ] API: POST /api/leads/:id/atividades
- [ ] Gerar tokenConfirmacao ao criar atividade
- [ ] Modal NovaAtividade.tsx
- [ ] Integração com Evolution API (enviar WhatsApp)
- [ ] Template de mensagem com link

**Entregável:** Corretor consegue agendar e envia confirmação automática

---

### **FASE 4: Confirmação Pública (1-2h)**

**Prioridade:** ⭐⭐⭐ CRÍTICA

- [ ] API: GET /api/atividades/:id/confirmar/:token
- [ ] API: POST /api/atividades/:id/confirmar/:token
- [ ] Página `ConfirmarAgendamento.tsx` (pública)
- [ ] Validação de token
- [ ] Modal de cancelamento com motivo
- [ ] Feedback visual (sucesso/erro)

**Entregável:** Proprietário consegue confirmar/cancelar pelo WhatsApp

---

### **FASE 5: Notificações (1h)**

**Prioridade:** ⭐⭐ IMPORTANTE

- [ ] Job: Lembrete 24h antes (cron)
- [ ] Notificação in-app: confirmação recebida
- [ ] Email para corretor: confirmação/cancelamento

**Entregável:** Sistema avisa corretor e lembra proprietário

---

### **FASE 6: Melhorias na Lista (1h)**

**Prioridade:** ⭐ DESEJÁVEL

- [ ] Cards de estatísticas no topo
- [ ] Filtros avançados (urgência, empreendimento)
- [ ] Ordenação customizável
- [ ] API: GET /api/leads/estatisticas

**Entregável:** Dashboard com visão geral do funil

---

### **FASE 7: Integração com SDR Tools (30min)**

**Prioridade:** ⭐⭐⭐ CRÍTICA

- [ ] Atualizar `qualificar_lead` para salvar campos SPIN
- [ ] Atualizar `agendar_avaliacao` para gerar token
- [ ] Enviar WhatsApp de confirmação após agendamento

**Entregável:** SDR Worker salva dados SPIN automaticamente

---

## ⏱️ ESTIMATIVA TOTAL

| Fase | Tempo | Prioridade |
|------|-------|------------|
| 1. Backend Core | 2-3h | ⭐⭐⭐ |
| 2. Detalhes Lead | 2h | ⭐⭐⭐ |
| 3. Agendamento | 2h | ⭐⭐⭐ |
| 4. Confirmação Pública | 1-2h | ⭐⭐⭐ |
| 5. Notificações | 1h | ⭐⭐ |
| 6. Melhorias Lista | 1h | ⭐ |
| 7. Integração SDR | 30min | ⭐⭐⭐ |
| **TOTAL** | **9-11h** | |

### **MVP Mínimo (Fases 1-4 + 7):** 7-9h
### **MVP Completo (Todas fases):** 9-11h

---

## 🎯 RESULTADO FINAL

### **O que o usuário terá:**

1. ✅ **SDR qualifica** leads usando SPIN Selling
2. ✅ **Dados estruturados** salvos no banco (S, P, I, N)
3. ✅ **CRM completo** para corretores gerenciarem leads
4. ✅ **Detalhes do lead** com contexto SPIN completo
5. ✅ **Sistema de agendamento** com confirmação automática
6. ✅ **Link público** para proprietário confirmar/cancelar
7. ✅ **Notificações** para corretor e proprietário
8. ✅ **Timeline** de todas interações
9. ✅ **Dashboard** com estatísticas do funil

### **Fluxo Completo:**

```
1. SDR entra em contato (WhatsApp/telefone)
2. SDR aplica SPIN Selling (coleta S, P, I, N)
3. SDR qualifica lead (temperatura + urgência)
4. SDR agenda avaliação
5. Sistema envia WhatsApp com link de confirmação
6. Proprietário confirma/cancela pelo link
7. Corretor recebe notificação
8. Corretor acessa CRM e vê contexto SPIN completo
9. Corretor vai preparado para avaliação
10. Corretor capta o imóvel! 🎉
```

---

## 🚀 PRÓXIMO PASSO

**Aguardando sua aprovação para começar a implementação!**

Quer que eu:
1. **Comece pela FASE 1** (Backend Core)?
2. **Ajuste algo no planejamento** antes?
3. **Esclareça alguma dúvida**?

**Estou pronto para finalizar o MVP!** 🔥
