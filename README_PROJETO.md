# 🏢 ELYON - Plataforma de CRM Imobiliário com IA

> **Sistema captaçaõ de imóveis com prospecção ativa**

Data de última atualização: 08/12/2025

---

## 📋 Índice

1. [Visão Geral](#-visão-geral)
2. [Problema que Resolvemos](#-problema-que-resolvemos)
3. [Stack Tecnológica](#-stack-tecnológica)
4. [Arquitetura do Sistema](#-arquitetura-do-sistema)
5. [Módulos Implementados](#-módulos-implementados)
6. [Roadmap](#-roadmap)
7. [Como Rodar Localmente](#-como-rodar-localmente)
8. [Estrutura de Pastas](#-estrutura-de-pastas)
9. [Fluxo de Dados](#-fluxo-de-dados)
10. [Decisões Arquiteturais](#-decisões-arquiteturais)

---

## 🎯 Visão Geral

**ELYON** é uma plataforma SaaS multi-tenant que revoluciona a captação de imóveis para imobiliárias através de:

- 🤖 **Agentes de IA** que fazem prospecção ativa via WhatsApp
- 📊 **CRM completo** para gestão de leads e conversas
- 🎯 **Qualificação automática** de proprietários interessados em vender/alugar
- 📞 **Integração WhatsApp** via Evolution API
- 🧠 **Context-aware AI** usando Claude (Anthropic) com RAG

### Objetivo Principal

Automatizar o trabalho de SDRs (Sales Development Representatives) e Closers imobiliários, aumentando a produtividade de imobiliárias de 5-10 captações/mês para 50-100 captações/mês por agente.

---

## 🎪 Problema que Resolvemos

### Antes (Processo Manual)

```
Corretor → Busca imóveis no ZapImóveis/VivaReal
       → Copia 200 telefones manualmente
       → Envia mensagens uma por uma no WhatsApp
       → Responde manualmente cada proprietário
       → Perde 80% dos leads por demora/esquecimento
       → Resultado: 5-10 captações/mês
```

### Depois (Com ELYON)

```
ELYON → Minera automaticamente milhares de contatos
     → Envia mensagens personalizadas em lote
     → IA responde instantaneamente 24/7
     → Qualifica leads automaticamente (SPIN Selling)
     → Agenda avaliações e converte para leads
     → Resultado: 50-100 captações/mês
```

---

## 🛠️ Stack Tecnológica

### Backend

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **Node.js** | v23.11.0 | Runtime |
| **TypeScript** | Latest | Linguagem principal |
| **Express** | 4.x | API REST |
| **Prisma** | 5.22.0 | ORM (PostgreSQL) |
| **Anthropic Claude** | Haiku 4.5 / Sonnet 4 | LLM para agentes de IA |
| **Zod** | Latest | Validação de schemas |
| **tsx** | Latest | TypeScript execution (dev) |

### Frontend

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **React** | 18.x | UI Framework |
| **Vite** | 5.4.21 | Build tool |
| **TypeScript** | Latest | Type safety |
| **Tailwind CSS** | - | Estilização |
| **shadcn/ui** | - | Componentes UI |

### Infraestrutura

| Serviço | Uso |
|---------|-----|
| **PostgreSQL** | Banco de dados principal |
| **Evolution API v2.3.6** | Gateway WhatsApp (porta 8081) |
| **Docker** | Containerização |
| **WebSocket** | Comunicação em tempo real |
| **Turbo (Monorepo)** | Build system |

### Integrações Externas

| Serviço | Uso |
|---------|-----|
| **Manus AI** | Pesquisa automática de dados de empreendimentos |
| **WhatsApp Business API** | Envio de mensagens (via Evolution) |
| **Anthropic API** | Processamento de linguagem natural |

---

## 🏗️ Arquitetura do Sistema

### Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│  - Dashboard de campanhas                                        │
│  - Visualização de contatos e leads                             │
│  - Interface de conversas (histórico WhatsApp)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express + Node.js)                   │
│                                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│  │  REST API     │  │  WEBHOOK      │  │  WORKERS      │      │
│  │  - CRUD       │  │  - Evolution  │  │  - SDR Agent  │      │
│  │  - Auth       │  │  - Manus      │  │  - Disparo    │      │
│  └───────────────┘  └───────────────┘  └───────────────┘      │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              BUSINESS LOGIC LAYER                         │  │
│  │  - Agentes IA (SDR + Closer)                              │  │
│  │  - Qualificação (SPIN Selling)                            │  │
│  │  - RAG (Conhecimento de empreendimentos)                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE (PostgreSQL)                       │
│  - Tenants (Multi-tenancy)                                      │
│  - Campanhas                                                     │
│  - Contatos                                                      │
│  - Leads                                                         │
│  - Mensagens (Histórico WhatsApp)                               │
│  - Empreendimentos (Conhecimento RAG)                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    SERVIÇOS EXTERNOS                             │
│  - Evolution API (WhatsApp)                                      │
│  - Anthropic Claude (IA)                                         │
│  - Manus AI (Pesquisa de dados)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Prospecção Ativa

```
1. MINERAÇÃO (3 opções)

   🎯 OBJETIVO: Criar listas de contatos segmentadas por imóveis/empreendimentos! 

   
   OPÇÃO A: BUSCA NA BASE DA PREFEITURA (Mineração Profunda)
   ├─ 1️⃣ Usuário busca empreendimento por nome
   │   └─ GET /mineracao/buscar-imoveis?termo=reserva
   │
   ├─ 2️⃣ Sistema retorna lista de edifícios/condomínios
   │   └─ Fonte: Base de dados IPTU da Prefeitura de Goiânia
   │
   ├─ 3️⃣ Usuário seleciona edifício e busca unidades
   │   └─ GET /mineracao/unidades/:cdedificio
   │   └─ Retorna: inscrições IPTU, apartamentos, blocos, etc
   │
   ├─ 4️⃣ Sistema identifica proprietários (Scraper IPTU)
   │   └─ POST /mineracao/identificar-proprietarios
   │   └─ Input: Lista de inscrições IPTU
   │   └─ Scraper acessa site da Prefeitura
   │   └─ Extrai: Nome, CPF, endereço de correspondência
   │   └─ Batch processing: 10 imóveis simultâneos
   │   └─ Delay entre batches: 500ms (anti-bloqueio)
   │
   ├─ 5️⃣ Sistema enriquece dados (Assertiva API)
   │   └─ POST /mineracao/confirmar-leads
   │   └─ Input: Lista de CPFs + dados IPTU
   │   └─ Busca: Telefones, emails, endereços adicionais
   │   └─ Cache: Evita cobranças duplicadas por CPF
   │   └─ Output: Telefones com WhatsApp, múltiplos emails
   │
   └─ 6️⃣ Persistência no banco
       ├─ Tabela LEAD: Dados do proprietário (nome, CPF, telefones, emails)
       ├─ Tabela IMOVEL: Dados do imóvel (inscrição IPTU, endereço, unidade)
       ├─ Tabela CONTATO: Registro para campanha (telefone principal)
       └─ Deduplicação: CPF único por tenant
   
   OPÇÃO B: IMPORTAR DA BASE (Reuso)
   ├─ Usuário seleciona leads já minerados em outras campanhas
   ├─ Sistema cria vínculos (CONTATO) para nova campanha
   └─ Evita mineração duplicada

2. BRIEFING DO EMPREENDIMENTO
   
   🎯 OBJETIVO: Criar conhecimento estruturado sobre o empreendimento que iremos usar para realizar as captações de imóveis destes empreendimentos assim o agente terá autoridade  ara melhorar a comunicação com proprietários
   
   📋 O QUE É O BRIEFING:
   ├─ Documento com informações do empreendimento
   ├─ Inclui: Tipologia, área, preços, lazer, localização, diferenciais
   ├─ Formato: Texto estruturado em seções
   ├─ Tamanho: 2000-3000 caracteres
   ├─ Armazenado em: campanha.briefingCompleto (campo TEXT)
   └─ Função: RAG (Retrieval Augmented Generation) para o agente de IA
   
   📝 FORMAS DE CRIAR O BRIEFING:
   
   OPÇÃO A: ESCRITA MANUAL ✍️
   ├─ Usuário digita manualmente no editor do sistema
   ├─ Editor estruturado com seções pré-definidas
   ├─ Campos: Tipo, localização, preços, metragens, lazer
   └─ Indicado quando: Corretor já tem todas as informações
   
   OPÇÃO B: PESQUISA AUTOMÁTICA (Manus AI) 🤖
   ├─ 1️⃣ Usuário inicia pesquisa automática
   │   └─ Informa apenas: Nome do empreendimento + Endereço completo
   │
   ├─ 2️⃣ Manus AI pesquisa na internet (2-5 minutos)
   │   └─ Fontes: Site da construtora, ZapImóveis, VivaReal, etc
   │   └─ Extrai automaticamente todas as informações
   │
   ├─ 3️⃣ Sistema gera briefing estruturado
   │   └─ Converte dados encontrados em texto formatado
   │
   └─ 4️⃣ Usuário VALIDA e pode EDITAR antes de salvar
       └─ Briefing nunca é aplicado automaticamente sem revisão
   
   OPÇÃO C: IMPORTAR DE CAMPANHA ANTERIOR 📋
   ├─ Reutilizar briefing já criado em outra campanha
   └─ Sistema copia o conteúdo de campanha.briefingCompleto
   
   ✅ RESULTADO FINAL (independente da forma):
   └─ campanha.briefingCompleto preenchido com texto estruturado
   
   💡 USO DO BRIEFING PELO AGENTE:
   ├─ Inserido NO INÍCIO de TODAS as conversas (primacy effect)
   ├─ Agente usa para responder perguntas do proprietário
   ├─ Evita alucinações: IA não inventa dados
   ├─ Demonstra conhecimento: "O seu é em qual andar?"
   └─ Ancora valor: "Apartamentos aqui saem R$ 280-380k"

3. DISPARO MASSIVO
   ├─ Sistema envia mensagem inicial via Evolution API
   ├─ Mensagem personalizada: "Família procurando no [empreendimento]"
   └─ Status do contato: CONTATANDO → RESPONDEU

4. CONVERSAÇÃO IA
   ├─ Proprietário responde via WhatsApp
   ├─ Evolution envia webhook para backend
   ├─ Backend carrega histórico + briefing
   ├─ Claude (Haiku 4.5) gera resposta contextualizada
   ├─ Sistema envia resposta automática
   └─ Loop continua até qualificação

5. QUALIFICAÇÃO (SPIN Selling)
   ├─ IA faz perguntas estratégicas:
   │  - Situação: "Seu apartamento está ocupado ou vazio?"
   │  - Problema: "Por que quer vender?"
   │  - Implicação: "Precisa vender até quando?"
   │  - Necessidade: "Posso incluir na nossa carteira?"
   └─ Status: RESPONDEU → INTERESSADO → LEAD

6. CONVERSÃO
   ├─ Proprietário aceita: "pode anunciar"
   ├─ IA chama tool "converter_para_lead"
   ├─ Sistema cria Lead no CRM
   └─ Notifica corretor via WebSocket
```

---

## ✅ Módulos Implementados

### 1. Prospecção Manual (MINERAÇÃO)

**Status:** ✅ 100% Funcional

**Descrição:** Mineração de contatos em portais imobiliários.

**Features:**
- Upload de CSV com contatos
- Criação de campanhas por empreendimento
- Importação via scraping (em desenvolvimento)
- Gestão de listas de contatos

**Arquivos principais:**
- `pacotes/backend/src/rotas/campanhas.ts`
- `pacotes/backend/src/rotas/contatos.ts`

---

### 2. Pesquisa Automática (MANUS IA)

**Status:** ✅ (Verificar Andamento + Buscar melhorias)

**Descrição:** Integração com Manus AI para pesquisa automática de dados de empreendimentos.

**Features:**
- Busca automática de briefing do empreendimento
- Extração de: tipologia, área, preços, diferenciais, localização
- Validação e edição manual do briefing
- Status de tarefas (PENDENTE → PROCESSANDO → CONCLUIDO)

**Arquivos principais:**
- `pacotes/backend/src/servicos/manus-service.ts`
- `pacotes/backend/src/rotas/manus.ts`

**Exemplo de uso:**
```typescript
// Criar pesquisa
POST /api/manus/pesquisas
{
  "nomeEmpreendimento": "Residencial Reserva Buriti",
  "cidade": "Goiânia",
  "bairro": "Vila Rosa"
}

// Resultado é salvo em campanha.briefingCompleto
```

---

### 3. Agente SDR + Closer (IA Conversacional)

**Status:** ✅ 50% Funcional (melhorias contínuas)

**Descrição:** Agente de IA que faz papel de SDR (qualificação) + Closer (conversão).

**Decisão Arquitetural (05/12/2025):**
> ⚠️ **IMPORTANTE:** Combinamos intencionalmente SDR e Closer em UM agente.
> - MVP com 5 clientes não justifica separação
> - No WhatsApp, cada handoff perde ~40% do lead
> - 1 agente fazendo 2 papéis = mais conversão, menos complexidade

**Features:**
- ✅ Prompt V3 (CLOSER) focado em conversão (~3000 tokens)
- ✅ Briefing do empreendimento no INÍCIO do prompt (primacy effect)
- ✅ Substituição de placeholders: `{nome}`, `{empreendimento}`, `{imobiliaria}`
- ✅ SPIN Selling (Situação → Problema → Implicação → Necessidade)
- ✅ Tool calling (converter_para_lead, agendar_avaliacao, etc)
- ✅ Histórico de mensagens (últimas 20)
- ✅ Context-aware (RAG com briefing do empreendimento)

**Arquivos principais:**
- `pacotes/backend/src/agentes/workers/sdr-worker.ts`
- `pacotes/backend/src/agentes/templates-prospeccao.ts`
- `pacotes/backend/src/ferramentas/sdr-tools.ts`

**Exemplo de prompt gerado:**
```
╔═══════════════════════════════════════════════════════════════╗
║  📚 CONHECIMENTO OBRIGATÓRIO DO EMPREENDIMENTO               ║
╚═══════════════════════════════════════════════════════════════╝

Residencial Reserva Buriti:
- Tipo: Condomínio Residencial Vertical (Apartamentos)
- Localização: Setor Vila Rosa, Goiânia – GO
- Tipologia: 2 quartos (sendo 1 suíte)
- Área: 54m² a 59m²
- Valor: R$ 280.000 a R$ 380.000
- Diferenciais: Piscina, Sala Fitness, Churrasqueira...

⚠️ REGRA ABSOLUTA: SEMPRE use os dados acima!
Se perguntarem tipologia → DIGA: "2 quartos"
Se perguntarem imobiliária → DIGA: "Eliézer Barbosas - Imóveis"

═══════════════════════════════════════════════════════════════

# 🔧 FERRAMENTAS - USE IMEDIATAMENTE!

| GATILHO | FERRAMENTA | AÇÃO |
|---------|------------|------|
| "sim", "pode", "ok" | converter_para_lead | Converter AGORA |
| "dia 13/12", "às 14h" | agendar_avaliacao | Agendar AGORA |
...
```

---

### 3.1. Arquitetura LLM Unificada (BYOK)

**Status:** ✅ 100% Funcional (implementado em 06/02/2026)

**Descrição:** Sistema que permite tenants usarem suas próprias chaves de API (BYOK - Bring Your Own Key).

**Decisão Arquitetural (06/02/2026):**
> ⚠️ **OpenAI Agents SDK + LiteLLM** como arquitetura unificada para suportar múltiplos providers.

**Providers Suportados:**
| Provider | Icone | Modelos |
|----------|-------|---------|
| OpenAI | 🤖 | gpt-4o, gpt-4o-mini, gpt-4-turbo |
| Anthropic | 🧠 | claude-3-5-sonnet, claude-3-5-haiku |
| Groq | ⚡ | llama-3.3-70b, mixtral-8x7b |
| Mistral | 🌀 | mistral-large, mistral-medium |
| Azure OpenAI | ☁️ | gpt-4, gpt-35-turbo |
| Google Vertex | 🔵 | gemini-pro, gemini-1.5-pro |
| Together AI | 🤝 | Llama-3-70b, Mixtral-8x7B |
| DeepSeek | 🔍 | deepseek-chat, deepseek-coder |

**Features:**
- ✅ API Keys criptografadas com AES-256
- ✅ Fallback para chave do sistema
- ✅ Métricas de uso por provider
- ✅ Teste de conexão via UI
- ✅ Priorização de providers

**API Endpoints:**
```
GET  /api/configuracao/llm           - Lista configs do tenant
POST /api/configuracao/llm           - Criar BYOK config
PUT  /api/configuracao/llm/:provider - Atualizar
DEL  /api/configuracao/llm/:provider - Remover
POST /api/configuracao/llm/:provider/testar - Testar conexão
GET  /api/configuracao/llm/metricas  - Métricas de uso
```

**Arquivos principais:**
- `pacotes/backend/src/rotas/config-llm.ts`
- `pacotes/backend/src/servicos/llm-provider-factory.ts`
- `pacotes/frontend/src/paginas/ConfiguracaoLLM.tsx`

---

### 4. Integração WhatsApp (Evolution API)

**Status:** ✅ 100% Funcional

**Descrição:** Gateway para envio/recebimento de mensagens via WhatsApp Business.

**Features:**
- ✅ Envio de mensagens em lote
- ✅ Recebimento via webhook
- ✅ Suporte a texto, imagem, áudio
- ✅ Normalização de telefones (com/sem 9º dígito)
- ✅ Configuração automática de webhook no startup

**Configuração:**
- URL: `http://192.168.1.7:8081` (Evolution API)
- Webhook: `http://192.168.1.7:3000/webhooks`
- Instance: `elyon_main`

**Arquivos principais:**
- `pacotes/backend/src/servicos/whatsapp-service.ts`
- `pacotes/backend/src/rotas/webhook.ts`

---

### 5. Proteções Anti-Flood e Debounce

**Status:** ✅ 100% Funcional (implementado em 08/12/2025)

**Descrição:** Sistema de proteção contra sobrecarga de mensagens após reconexão.

**Problema resolvido:**
- Evolution API ficou offline por 2 dias
- Ao reconectar, enviou centenas de mensagens antigas de uma vez
- Sistema respondeu todas, causando spam

**Features implementadas:**

#### 5.1. Anti-Flood Protection
- ✅ Filtro de timestamp: ignora mensagens > 48h
- ✅ Verificação de resposta: não responde duplicatas
- ✅ Janela de verificação: < 5min = processa imediatamente

#### 5.2. Debounce de Mensagens
- ✅ Aguarda 5s após última mensagem antes de responder
- ✅ Consolida múltiplas mensagens em uma única resposta
- ✅ Histórico carregado do banco (inclui todas mensagens do debounce)

#### 5.3. Cooldown Protection
- ✅ Não responde se já respondeu há menos de 10s
- ✅ Reagenda automaticamente quando cooldown expira

#### 5.4. Mutex/Lock
- ✅ Previne processamento paralelo do mesmo contato
- ✅ Garante uma resposta por vez

**Constantes:**
```typescript
const TEMPO_MAXIMO_MSG_MS = 48 * 60 * 60 * 1000;  // 48 horas
const JANELA_VERIFICACAO_MS = 5 * 60 * 1000;       // 5 minutos
const DEBOUNCE_MS = 5000;                          // 5 segundos
const COOLDOWN_MS = 10000;                         // 10 segundos
```

**Arquivos principais:**
- `pacotes/backend/src/rotas/webhook.ts` (linhas 250-460)

---

### 6. CRM e Dashboard

**Status:** ✅ 50% Funcional

**Descrição:** Interface web para gestão de campanhas, contatos e leads.

**Features:**
- ✅ Dashboard com métricas
- ✅ Listagem de campanhas
- ✅ Visualização de contatos por campanha
- ✅ Histórico de conversas
- ✅ Edição de briefing de empreendimento
- ⏳ Filtros avançados (em desenvolvimento)
- ⏳ Relatórios de conversão (em desenvolvimento)

**Arquivos principais:**
- `pacotes/frontend/src/`

---

### 7. Multi-Tenancy

**Status:** ✅ 90% Funcional

**Descrição:** Sistema SaaS com isolamento completo entre clientes.

**Features:**
- ✅ Tenants independentes
- ✅ Configuração de agente por tenant
- ✅ Personalidade, expertise, scripts customizáveis
- ✅ Perfil de comissões por tenant

**Schema:**
```typescript
model Tenant {
  id              String
  nome            String
  configuracoes   Json?
  perfilVenda     Json?  // comissão padrão, etc
  perfilLocacao   Json?  // taxa administração, etc
  campanhas       Campanha[]
  leads           Lead[]
  agentes         AgenteConfig[]
}
```

---

## 🚧 Roadmap (O que falta implementar)

### Prioridade ALTA

#### 1. Validação de Respostas da IA ⏳
**Objetivo:** Evitar alucinações em dados críticos

**Implementação sugerida:**
```typescript
// Após geração da resposta
if (resposta.includes("quartos")) {
  const tipologiaMencionada = extrairTipologia(resposta);
  const tipologiaReal = extrairTipologiaDoBriefing(briefing);
  
  if (tipologiaMencionada !== tipologiaReal) {
    console.error("ALUCINAÇÃO DETECTADA!");
    // Reenviar com instrução mais forte
  }
}
```

#### 2. Métricas e Logs de Alucinação ⏳
**Objetivo:** Detectar quando proprietário identifica erro

**Features:**
- Detectar mensagens como "isso não está certo", "mentira"
- Logar no banco para análise posterior
- Dashboard de erros para melhoria contínua

#### 3. A/B Testing de Prompts ⏳
**Objetivo:** Comparar efetividade de diferentes versões

**Features:**
- Rotacionar entre Prompt V2 e V3
- Métricas: taxa de conversão, tempo de qualificação
- Decidir qual prompt é melhor baseado em dados

---

### Prioridade MÉDIA

#### 4. Prompt Caching Explícito 🔄
**Objetivo:** Reduzir custos com cache da Anthropic

**Implementação:**
```typescript
const resposta = await anthropic.messages.create({
  system: [
    {
      type: "text",
      text: prefixoBriefing,
      cache_control: { type: "ephemeral" }  // ← Cache por 5 min
    },
    {
      type: "text",
      text: PROMPT_CLOSER_V3
    }
  ],
  ...
});
```

**Economia esperada:** 90% de desconto em tokens do briefing

#### 5. Scraping Automático 🔄
**Objetivo:** Minerar contatos sem CSV manual

**Fontes:**
- ZapImóveis
- VivaReal
- OLX
- QuintoAndar

**Desafios:**
- Anti-bot (Cloudflare, CAPTCHA)
- Rate limiting
- Mudanças frequentes nas APIs

#### 6. Notificações em Tempo Real 🔄
**Objetivo:** Alertar corretor quando lead é qualificado

**Features:**
- Push notifications no browser
- Email quando lead aceita avaliação
- WhatsApp para corretor (via Evolution)

---

### Prioridade BAIXA

#### 7. Relatórios Avançados 📊
- Funil de conversão detalhado
- Análise de objeções mais comuns
- Tempo médio de qualificação
- Custo por lead (considerando API)

#### 8. Integração com CRMs Externos 🔌
- Integração com RD Station
- Integração com HubSpot
- Webhook para sistemas legados

#### 9. WhatsApp Multicanal 📱
- Suporte a múltiplas instâncias Evolution
- Rotação de números (evitar bloqueio)
- Fallback automático se número bloqueado

---

## 🚀 Como Rodar Localmente

### Pré-requisitos

```bash
- Node.js v23.11.0+
- PostgreSQL (ou Docker)
- Evolution API rodando (porta 8081)
```

### 1. Clonar o repositório

```bash
git clone [repo-url]
cd elyon
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

Criar arquivo `.env` em `pacotes/backend/`:

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/elyon"

# Anthropic
ANTHROPIC_API_KEY="sk-ant-..."

# Evolution API
EVOLUTION_API_URL="http://192.168.1.7:8081"
EVOLUTION_API_KEY="sua-chave"
EVOLUTION_INSTANCE="elyon_main"

# Webhook
WEBHOOK_URL="http://192.168.1.7:3000/webhooks"

# Manus AI
MANUS_API_KEY="sua-chave"
```

### 4. Rodar migrações do banco

```bash
cd pacotes/backend
npx prisma migrate deploy
```

### 5. Iniciar em modo desenvolvimento

```bash
# Na raiz do monorepo
npm run dev

# Ou separadamente:
cd pacotes/backend && npm run dev  # Backend: http://localhost:3000
cd pacotes/frontend && npm run dev # Frontend: http://localhost:5173
```

### 6. Verificar Evolution API

```bash
curl http://192.168.1.7:8081/instance/elyon_main/status
```

---

## 📁 Estrutura de Pastas

```
elyon/
├── pacotes/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── agentes/              # 🤖 Lógica dos agentes IA
│   │   │   │   ├── workers/
│   │   │   │   │   └── sdr-worker.ts       # Agente SDR+Closer principal
│   │   │   │   ├── templates-prospeccao.ts # Prompts V1, V2, V3
│   │   │   │   └── few-shot-examples.ts    # Exemplos para o Claude
│   │   │   │
│   │   │   ├── ferramentas/          # 🔧 Tools que o Claude pode chamar
│   │   │   │   └── sdr-tools.ts            # converter_para_lead, agendar_avaliacao, etc
│   │   │   │
│   │   │   ├── rotas/                # 🛣️ Endpoints REST
│   │   │   │   ├── webhook.ts              # ⚡ Recebe msgs do WhatsApp
│   │   │   │   ├── campanhas.ts
│   │   │   │   ├── contatos.ts
│   │   │   │   ├── leads.ts
│   │   │   │   └── manus.ts
│   │   │   │
│   │   │   ├── servicos/             # 📦 Camada de serviço
│   │   │   │   ├── whatsapp-service.ts     # Integração Evolution API
│   │   │   │   ├── manus-service.ts        # Integração Manus AI
│   │   │   │   ├── conhecimento-curado.ts  # RAG (conhecimento)
│   │   │   │   └── logger.ts               # Logs estruturados
│   │   │   │
│   │   │   └── servidor.ts           # 🚀 Express app principal
│   │   │
│   │   ├── prisma/
│   │   │   └── schema.prisma         # 📊 Schema do banco
│   │   │
│   │   └── scripts/                  # 🔨 Scripts utilitários
│   │
│   ├── frontend/                     # ⚛️ React + Vite
│   │   └── src/
│   │
│   └── compartilhado/                # 📚 Código compartilhado
│
├── documentos/                       # 📄 Documentação técnica
│   ├── PROMPT_SDR_V2_OUTBOUND.md
│   ├── BRIEFING_MVP_AGENTES_IA.md
│   └── ...
│
├── docker-compose.yml
├── turbo.json                        # Configuração do monorepo
└── package.json
```

---

## 🔄 Fluxo de Dados (Prospecção Ativa)

### 1. Proprietário Responde

```
WhatsApp → Evolution API → Webhook POST /webhooks
```

**Payload do webhook:**
```json
{
  "event": "messages.upsert",
  "instance": "elyon_main",
  "data": {
    "key": {
      "remoteJid": "5562999999999@s.whatsapp.net",
      "id": "3EB0..."
    },
    "message": {
      "conversation": "Sim tenho apartamento"
    },
    "messageTimestamp": 1733688000
  }
}
```

### 2. Webhook Processa

```typescript
// webhook.ts

1. Normalizar telefone (últimos 8 dígitos)
2. Buscar contato no banco (JOIN campanhas + tenant)
3. Verificar anti-flood:
   - Msg > 48h? Ignorar
   - Já respondemos? Ignorar
4. Adicionar à fila de debounce (5s)
5. Timer expira → processar
```

### 3. Carregar Contexto

```typescript
// webhook.ts

1. Buscar histórico (últimas 20 mensagens)
2. Buscar briefing da campanha (campanha.briefingCompleto)
3. Montar contextoRAG:
   - ### CONHECIMENTO DO EMPREENDIMENTO ###
   - [briefing completo aqui]
4. Montar configSDR:
   - nome: "Sofia"
   - tenantNome: "Eliézer Barbosas - Imóveis"
   - empreendimento: "Reserva Buriti"
   - modoProspeccao: true
```

### 4. Processar com Claude

```typescript
// sdr-worker.ts

1. Gerar system prompt:
   - Briefing NO INÍCIO (primacy effect)
   - Substituir {nome}, {empreendimento}, {imobiliaria}
   - Prompt V3 (CLOSER)
2. Chamar Claude Haiku com tools
3. Loop de tool calling se necessário:
   - converter_para_lead
   - agendar_avaliacao
   - etc
4. Retornar resposta final
```

### 5. Enviar Resposta

```typescript
// webhook.ts

1. whatsappService.enviarMensagemTexto(telefone, resposta)
2. Salvar mensagem de SAÍDA no histórico
3. Registrar cooldown (10s)
4. Limpar fila de debounce
```

---

## 🧠 Decisões Arquiteturais Importantes

### 1. SDR + Closer em UM agente (05/12/2025)

**Decisão:** Combinar SDR (qualificação) e Closer (conversão) em um único agente.

**Justificativa:**
- MVP com 5 clientes não justifica complexidade de 2 agentes
- WhatsApp: cada handoff entre agentes perde ~40% do lead
- 1 agente = mais conversão, menos complexidade
- Custo de contexto é baixo comparado ao risco de perda

**Quando separar:**
- Escala de 50+ clientes
- Taxa de conversão cair significativamente
- Corretores pedirem leads mais "crus"

---

### 2. Briefing NO INÍCIO do prompt (08/12/2025)

**Decisão:** Colocar o briefing do empreendimento no INÍCIO do system prompt, antes das instruções.

**Justificativa:**
- LLMs têm "primacy effect" - focam mais no início
- Dados críticos (tipologia, preço) precisam de máxima atenção
- Problema detectado: IA disse "2 ou 3 quartos" quando só tem "2 quartos"
- Custo: +~700 tokens por chamada, mas vale a pena para evitar erros

**Estrutura:**
```
1. BRIEFING (início)
2. FERRAMENTAS
3. IDENTIDADE
4. FLUXO
5. EXEMPLOS
```

---

### 3. Debounce de 5s + Cooldown de 10s (08/12/2025)

**Decisão:** Implementar debounce e cooldown para evitar múltiplas respostas.

**Problema original:**
- Evolution API offline por 2 dias
- Ao reconectar, enviou 200+ mensagens de uma vez
- Sistema respondeu todas, causando spam

**Solução:**
```typescript
DEBOUNCE_MS = 5000   // Aguarda 5s após última mensagem
COOLDOWN_MS = 10000  // Não responde se já respondeu há < 10s
```

**Resultado:** Sistema responde UMA vez mesmo com múltiplas mensagens rápidas.

---

### 4. Claude Haiku para produção (não Sonnet)

**Decisão:** Usar `claude-haiku-4-5-20251001` para chamadas de produção.

**Justificativa:**
- Haiku: $0.25/1M tokens input
- Sonnet: $3.00/1M tokens input
- Haiku é 12x mais barato
- Qualidade é suficiente para conversação + tool calling
- Economia: ~$150/mês vs $1800/mês (base de 100 conversas/dia)

**Quando usar Sonnet:**
- Análise complexa de dados
- Geração de briefings (Manus faz isso)
- Tarefas one-shot que precisam máxima qualidade

---

### 5. Prisma Raw Queries para busca de contatos

**Decisão:** Usar `$queryRawUnsafe` ao invés de Prisma ORM puro para buscar contatos.

**Justificativa:**
- Precisamos comparar últimos 8 dígitos do telefone
- Normalização de telefone (com/sem 9º dígito)
- REGEXP_REPLACE para remover caracteres especiais
- Performance: INDEX otimizado para RIGHT(phone, 8)

**Exemplo:**
```sql
WHERE RIGHT(REGEXP_REPLACE(telefone, '[^0-9]', '', 'g'), 8) = '93715693'
```

---

## 🎓 Onboarding - Próximos Passos

### Para entender o código:

1. **Comece por:** `pacotes/backend/src/rotas/webhook.ts`
   - Este é o coração do sistema
   - Recebe mensagens do WhatsApp e orquestra tudo

2. **Depois veja:** `pacotes/backend/src/agentes/workers/sdr-worker.ts`
   - Entenda como o agente de IA funciona
   - Veja os prompts em `templates-prospeccao.ts`

3. **Ferramentas:** `pacotes/backend/src/ferramentas/sdr-tools.ts`
   - Tools que o Claude pode chamar
   - Cada tool é uma ação concreta (converter lead, agendar, etc)

4. **Schema:** `pacotes/backend/prisma/schema.prisma`
   - Entenda as entidades e relacionamentos
   - Multi-tenancy, campanhas, contatos, leads

### Para testar localmente:

1. Configure Evolution API (Docker)
2. Configure `.env` com suas chaves
3. Rode `npm run dev`
4. Use Postman para testar endpoints
5. Envie mensagem de teste via WhatsApp

### Documentos importantes:

- `documentos/BRIEFING_MVP_AGENTES_IA.md` - Visão geral do MVP
- `documentos/PROMPT_SDR_V2_OUTBOUND.md` - Documentação do prompt
- `documentos/RELATORIO_IMPLEMENTACAO_AGENTES.md` - Decisões técnicas

---

## 📞 Contato

**Projeto:** ELYON CRM Imobiliário  
**Stack:** TypeScript + React + PostgreSQL + Anthropic Claude  
**Deploy:** Docker + Evolution API  

---

**Última atualização:** 08/12/2025  
**Versão:** MVP 1.0  
**Status:** Em produção com 5 clientes
