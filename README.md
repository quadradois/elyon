# 🛡️ ELYON - Sistema de Captação Inteligente

> **ELYON** (עֶלְיוֹן - "O Altíssimo" em hebraico)  
> Plataforma SaaS de CRM imobiliário com agentes de IA personalizados

**Empresa**: ELYON  
**Produto**: ELYON Platform  
**Início**: 26/11/2025  
**Lançamento MVP**: 18/01/2026 (53 dias)  
**Clientes confirmados**: 5 imobiliárias

---

## 🎯 Visão do Produto

Sistema multi-tenant que permite cada imobiliária ter seu próprio agente de IA personalizado para captação de imóveis!

### Diferencial Competitivo

- 🤖 **ELYON**: Orquestrador mestre que coordena agentes
- 🎭 **Agentes Personalizados**: Cada imobiliária pode nomear, treinar e customizar seu agente, ou usar um padrão oficial da plataforma
- 💰 **Cache Compartilhado**: Economia de 25% → 85% margem em consultas CPF
- 🇧🇷 **100% Brasileiro**: Todo sistema em pt-BR

---

## 📜 REGRAS DO JOGO

### 🛡️ Mandato do Guardião (Viabilidade Comercial)

**Filtro Universal para QUALQUER decisão**:

```
❓ A: Isso gera receita ou validação mensurável em 30 dias?
❓ B: Isso reduz trabalho operacional do usuário AGORA?

A=SIM, B=SIM   → ✅ PRIORIDADE MÁXIMA
A=SIM, B=NÃO   → ✅ FAZER
A=NÃO, B=SIM   → ⚠️  EXPERIMENTAR
A=NÃO, B=NÃO   → ❌ CEMITÉRIO DE IDEIAS
```

**Princípios**:

- ✅ Validação antes de construção
- ✅ MVP antes de perfeição
- ✅ Dados reais antes de opiniões
- ❌ PROIBIDO over-engineering
- ❌ PROIBIDO roadmap inchado

Ver [PLAYBOOK_FAXINA_AGENTES.md](./docs/PLAYBOOK_FAXINA_AGENTES.md) completo.

---

### 🔧 Diretrizes Técnicas (Qualidade de Código)

**REGRA SUPREMA**: 🇧🇷 **100% Português-Brasileiro Obrigatório**

```typescript
// ❌ ERRADO
class UserService {}
const getProperties = () => {};

// ✅ CERTO
class ServicoUsuario {}
const buscarImoveis = () => {};
```

**Limites de Código**:

- TypeScript: 350 linhas
- React: 250 linhas
- Controllers: 200 linhas
- Services: 300 linhas

**Padrões**:

- Pastas: `kebab-case` (pt-BR)
- Componentes: `PascalCase` (pt-BR)
- Hooks: `useCamelCase` (pt-BR)
- Commits: `feat:`, `fix:`, `refatoração:` (pt-BR)

Ver [PLAN_REFATORACAO_ORCHESTRATOR_2_AGENTES.md](./docs/PLAN_REFATORACAO_ORCHESTRATOR_2_AGENTES.md) completo.

---

## 🏗️ Arquitetura

### Tech Stack

**Backend**:

- Node.js 20 LTS + TypeScript 5.x
- Express.js 4.x
- Prisma 5.x (ORM)
- PostgreSQL 15+
- Redis 7+

**Frontend**:

- React 18.x + TypeScript 5.x
- Vite 5.x
- Shadcn/ui + Tailwind CSS
- TanStack Query

**IA & Agentes**:

- OpenAI Agents SDK (`@openai/agents` + `@openai/agents-openai`)
- Arquitetura operacional SDR + Admin (coerência e governança por fases)
- Suporte multi-provedor LLM por tenant (BYOK)

**Comunicação**:

- Evolution API (WhatsApp open-source)

**Hospedagem**:

- VPS próprio (8 cores, 24GB RAM, 400GB SSD)
- Docker + Docker Compose

### Estrutura do Monorepo

```
elyon/
├── pacotes/
│   ├── backend/         # API Node.js
│   ├── frontend/        # Dashboard React
│   └── compartilhado/   # Types compartilhados
├── documentos/          # Docs técnicos
├── docker-compose.yml
├── nginx.conf
└── README.md (este arquivo)
```

---

## 🌐 Domínios

```
elyon.ia.br       → Landing page
crm.elyon.ia.br   → Dashboard
api.elyon.ia.br   → Backend API
evo.elyon.ia.br   → Evolution API (WhatsApp)
n8n.elyon.ia.br   → N8n (futuro)
```

---

## 📅 Roadmap MVP (53 dias)

### Fase 1: Fundação (26/11 - 09/12) - 14 dias

- Setup monorepo
- VPS + Docker Compose
- PostgreSQL + Redis + Evolution API
- Autenticação JWT

### Fase 2: Core ELYON (10/12 - 23/12) - 14 dias

- Orquestrador ELYON
- Agentes personalizáveis
- WhatsApp funcionando
- Dashboard básico

### Fase 3: Features (24/12 - 06/01) - 14 dias

- Cache CPF compartilhado
- Personalização de agente (UI)
- Pipeline kanban
- Tarefas automatizadas

### Fase 4: Refinamento (07/01 - 13/01) - 7 dias

- Testes
- Bug fixes
- Otimizações
- Documentação

### Fase 5: Lançamento (14/01 - 18/01) - 5 dias

- Onboarding 5 clientes
- Suporte dedicado
- Coleta de feedback

---

## 💰 Modelo de Negócio

**Preço MVP**: R$ 297/mês (tier Small Business)

**Inclui**:

- Até 5.000 mensagens WhatsApp
- 100 consultas CPF
- 1 agente personalizado
- Dashboard analytics

**Projeção**:

- 5 clientes = R$ 1.485/mês
- Margem: 96% (custos ~R$ 50/mês)

---

## 🚀 Quick Start (Desenvolvimento)

### Pré-requisitos

- Node.js 20 LTS
- Docker + Docker Compose
- Git

### Setup Local

```bash
# Clonar
git clone https://github.com/elyon-ai/elyon.git
cd elyon

# Instalar dependências
npm install

# Subir banco local
docker-compose up -d

# Rodar migrations
npm run migrar

# Iniciar dev
npm run dev
```

### Variáveis de Ambiente

```bash
cp .env.exemplo .env.local
# Editar .env.local com suas credenciais
```

---

## 📊 Métricas de Sucesso

### MVP (até 18/01/2026)

- ✅ 5/5 tenants onboarded
- ✅ NPS > 8/10
- ✅ Uptime > 99%
- ✅ Response time < 2s
- ✅ 0 bugs críticos

### Fevereiro/2026

- R$ 1.485 MRR confirmado
- Cache hit rate > 40%
- 10+ conversas/dia por tenant

---

## 📚 Documentação

- [PLAN.md](./docs/PLAN.md) - Plano geral de execução
- [PLAYBOOK_GOVERNANCA_CONFIABILIDADE_QUALIFICACAO.md](./docs/PLAYBOOK_GOVERNANCA_CONFIABILIDADE_QUALIFICACAO.md) - Governança e confiabilidade
- [RAIO_X_COERENCIA_AGENTES.md](./docs/RAIO_X_COERENCIA_AGENTES.md) - Diagnóstico de coerência dos agents
- [PLANO_EXECUCAO_COERENCIA_AGENTES.md](./docs/PLANO_EXECUCAO_COERENCIA_AGENTES.md) - Plano PR1-PR3 executado
- [RAIO_X_AS_IS.md](./docs/RAIO_X_AS_IS.md) - Mapeamento AS-IS técnico
- [VPS_DEPLOY_GUIDE.md](./DEPLOY.md) - Guia de deploy (Atualizado)

---

## 👥 Time

**Fundador**: [Seu Nome]  
**AI Coordenador**: Antigravity (Guardião + Coordenador Técnico)  
**Parceiros**: OpenAI, Evolution API, Assertiva Soluções

---

## 📄 Licença

Proprietário - ELYON © 2026

---

## 🎯 Contato

**Email**: contato@elyon.ia.br  
**Website**: https://elyon.ia.br  
**ELYON**: https://crm.elyon.ia.br

---

**Versão**: 0.4.0  
**Última atualização**: 26/04/2026  
**Status**: ✅ Produção ativa

---

> _"O Altíssimo em Inteligência Imobiliária"_
