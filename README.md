# ELYON

Plataforma de CRM imobiliário com agente de IA para captação de imóveis, atendimento por WhatsApp e operação comercial orientada por dados.

## O que é o ELYON

O ELYON ajuda imobiliárias a transformar atendimento em captação real.
A plataforma combina:

- agente de IA especializado em captação
- CRM com pipeline de leads e visão operacional
- integração com WhatsApp para escala de conversas
- governança por tenant (cada imobiliária com regras e políticas próprias)

Resultado: mais consistência no discurso comercial, mais velocidade no funil e menos perda de oportunidade.

## Principais funções

- Captação ativa de proprietários com roteiros comerciais padronizados.
- Tratativa de objeções e dúvidas contratuais com controle por cláusula.
- Qualificação de leads com faseamento operacional (SDR/Admin).
- Dashboard com métricas de performance e acompanhamento do time.
- Gestão de tarefas e follow-ups para reduzir abandono de leads.
- Multi-tenant com políticas separadas por imobiliária.

## Destaque da versão 0.5.0

### Nova capacidade de aprendizado do agente de captação

O agente agora evolui com base no histórico operacional da própria imobiliária.

- **Learning Bank**: registra contexto, ação e resultado para aprendizado contínuo.
- **PAOL (política adaptativa)**: prioriza ações com melhor desempenho histórico por contexto.
- **Experience Replay auditável**: reaplica histórico recente + histórico amplo para recalibrar política sem perder rastreabilidade.
- **Telemetria e cockpit de IA**: visibilidade de outcomes, fallback, guardrails e eficiência por tenant.

Importante: o aprendizado respeita feature flags e políticas de governança, permitindo ativação gradual com segurança.

## Arquitetura

### Backend

- Node.js 20 + TypeScript
- Express + Prisma
- PostgreSQL + Redis
- OpenAI Agents SDK

### Frontend

- React + TypeScript
- Vite
- Dashboard operacional e painéis de IA

### Infra

- Docker Compose
- Traefik
- Deploy em VPS

## Domínios oficiais

- `elyon.ia.br`
- `crm.elyon.ia.br`
- `api.elyon.ia.br`

## Quick Start

```bash
git clone https://github.com/quadradois/elyon.git
cd elyon
npm install
docker compose up -d
npm run migrar
npm run dev
```

## Documentação

- [Plano de Coerência dos Agents](./docs/planos/PLANO_EXECUCAO_COERENCIA_AGENTES.md)
- [Raio-X de Coerência](./docs/raio-x/RAIO_X_COERENCIA_AGENTES.md)
- [Deploy](./DEPLOY.md)

## Release atual

- **Versão**: `0.5.0`
- **Status**: Produção ativa
- **Última atualização**: 26/04/2026
