# RAIO-X AS-IS — ELYON v0.2.2

> **Data:** 10/04/2026
> **Status:** Produção (`crm.elyon.ia.br` / `api.elyon.ia.br`)
> **Testes:** 48 suites · 676 testes · 0 falhas

---

## 1. VISÃO GERAL

**ELYON** é um SaaS multi-tenant de captação inteligente de imóveis com IA. Um pipeline de 4 agentes conversa via WhatsApp com proprietários de imóveis, qualifica leads, agenda reuniões e faz onboarding — tudo automatizado.

### Números do Código

| Métrica | Valor |
|---------|-------|
| Backend (TypeScript) | ~44.700 linhas |
| Frontend (React/TSX) | ~35.400 linhas |
| Testes | ~9.000 linhas |
| Skills (.md) | 15 arquivos · 701 linhas |
| Schema Prisma | 1.720 linhas · 35 models · 22 enums |
| Dependências backend | 30 prod + 16 dev |
| **Total estimado** | **~90.000 linhas** |

### Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| **Runtime** | Node.js 20 + TypeScript |
| **Framework web** | Express 4 |
| **Motor IA** | `@openai/agents` SDK v0.5.1 (OpenAI Agents SDK) |
| **LLM padrão** | GPT-4.1 (principal) · GPT-4.1-mini (auxiliar) |
| **BYOK** | OpenAI direto ou OpenRouter (gateway) |
| **Banco** | PostgreSQL 15 + PGVector (embeddings) |
| **Cache** | Redis 7 |
| **ORM** | Prisma 5.7 |
| **WhatsApp** | Evolution API |
| **Frontend** | React 18 + Vite 5 + Tailwind CSS 4 |
| **Proxy reverso** | Traefik v3.3 (TLS automático Let's Encrypt) |
| **Infra** | Docker Compose · VPS única |
| **Pagamentos** | Asaas |
| **Enriquecimento** | Assertiva (CPF/CNPJ → telefones, renda, score) |
| **Pesquisa** | Manus AI |
| **Calendário** | Google Calendar API + Meet |
| **Storage** | AWS S3 |
| **Monorepo** | npm workspaces + Turborepo |
| **Testes** | Jest (unitário/integração) |

---

## 2. ARQUITETURA DE AGENTES

### 2.1 Hierarquia

```
Webhook WhatsApp (Evolution API)
       │
       ▼
┌─────────────────────────────────────────┐
│            ORCHESTRATOR                  │
│  (529 linhas · 18 etapas no pipeline)   │
│                                         │
│  Guardrails → Resolução → Execução →    │
│  Pós-handoff → Filtros → Métricas       │
└─────────┬──────────┬───────────┬────────┘
          │          │           │
          ▼          ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  OPENER  │→│ PRESENTER│→│  ADMIN   │
    │  v13     │ │  v6      │ │  v4      │
    │ gpt-4.1  │ │ gpt-4.1  │ │ gpt-4.1  │
    │          │ │          │ │  -mini   │
    └──────────┘ └──────────┘ └──────────┘
          ↑          │               
          └──────────┘  (reverse)    
                │                    
                ▼                    
         ┌──────────────┐            
         │  KNOWLEDGE   │            
         │  (sub-agent) │            
         │  gpt-4.1-mini│            
         └──────────────┘            
```

### 2.2 Agentes

| Agente | Versão | Modelo | Papel | Structured Output |
|--------|--------|--------|-------|-------------------|
| **Opener** | v13 | gpt-4.1 | Prospector — primeiro contato, coleta PVAM | `OpenerOutputSchema` (Zod) |
| **Presenter** | v6 | gpt-4.1 | Diagnosticador SPIN Selling, pitch, agendamento | `PresenterOutputSchema` (Zod) |
| **Admin** | v4 | gpt-4.1-mini | Onboarding — documentos, contrato, CRM | `AdminOutputSchema` (Zod) |
| **Knowledge** | - | gpt-4.1-mini | Sub-agente RAG (técnicas de venda + empreendimentos) | Texto livre |

### 2.3 Fluxo de Handoffs

| De → Para | Gatilho |
|-----------|---------|
| Opener → Presenter | Lead mostra interesse real (A+M inferidos no PVAM) |
| Presenter → Admin | Lead aceita proposta → fase de onboarding |
| Presenter → Opener | Lead recuou, não está pronto (reverse handoff) |

### 2.4 Tools (14 ferramentas + 2 RAG internas)

| # | Tool | Agente(s) | Descrição |
|---|------|-----------|-----------|
| 1 | `qualificar_lead` | Opener, Presenter | Qualifica com temperatura + 17 campos SPIN |
| 2 | `converter_para_lead` | Opener | Promove Contato → Lead |
| 3 | `registrar_optout` | Opener | Opt-out imediato |
| 4 | `agendar_followup` | Opener, Presenter | Follow-up com data futura |
| 5 | `mover_para_fase` | Opener, Presenter, Admin | Move lead no Kanban |
| 6 | `registrar_indicacao` | Opener | Registra indicação de terceiro |
| 7 | `encaminhar_corretor` | Admin | Escalação para humano |
| 8 | `gerar_link_contrato` | Admin | Link de assinatura digital |
| 9 | `atualizar_dados_lead` | Presenter, Admin | CPF/email/endereço/nome |
| 10 | `salvar_dados_imovel` | Admin | Dados completos do imóvel |
| 11 | `enviar_para_crm` | Admin | Envia lead CAPTADO para CRM externo |
| 12 | `agendar_reuniao_closer` | Presenter | Google Calendar + Meet |
| 13 | `enviar_link_agendamento` | Presenter | Fallback: link de agendamento |
| 14 | `consultar_preco_mercado` | Presenter | Estima valor cruzando IPTU + RAG |
| 15 | `ler_skill` | Opener, Presenter | Carrega playbook .md sob demanda |
| 16 | `buscar_conhecimento_interno` | Knowledge | RAG curado de vendas |
| 17 | `buscar_info_empreendimento` | Knowledge | RAG de empreendimentos |

### 2.5 Skills (15 playbooks)

| Categoria | Skills |
|-----------|--------|
| **Compartilhados** (3) | regras-whatsapp · anti-injection · reset-emocional |
| **Opener** (6) | protocolo-desconfianca · protocolo-recuo-hostilidade · protocolo-indicacao · tratativa-exclusividade · tratativa-varios-corretores · protocolo-ja-tem-contrato |
| **Presenter** (6) | spin-diagnostico · pitch-rede-parceiros · tratativa-exclusividade · tratativa-vender-sozinho · tratativa-comissao · escalation-trigger-matrix |

### 2.6 Pipeline do Orchestrator (18 etapas)

| # | Etapa | Descrição |
|---|-------|-----------|
| 1 | Guardrails entrada | opt-out, spam, blacklist, comprador |
| 2 | Fase humana | DOCUMENTACAO/EM_NEGOCIACAO → ADMIN |
| 3 | Agente persistido | Redis cache |
| 4 | Determinar agente | status → tipo (OPENER/PRESENTER/ADMIN) |
| 5 | Fallback determinístico | Confirmação de prioridade → força PRESENTER |
| 6 | Criar cadeia | `obterCadeiaAgentes()` com handoffs SDK |
| 7 | Input SDK | Histórico cache + schema state + lead record |
| 8 | Schema State | Extrai → enriquece → persiste |
| 9 | Pré-processamento | Sentimento + Objeção + Skill (paralelo) |
| 10 | BYOK Fallback | Callback para recriar com chave plataforma |
| 11 | Executar agente | `executarAgenteComRetry()` · maxTurns=15 |
| 12 | Persistir histórico | Salva no cache para próximo turno |
| 13 | Extrair resposta | Texto + CoT + structured output |
| 14 | Pós-handoff | Atualiza agente persistido, briefing |
| 15 | Filtros de resposta | Limpeza, guardrails runtime |
| 16 | Anti-repetição | Detecta loop → fallback contextual |
| 17 | Métricas | Tokens, duração, agente, handoffs |
| 18 | Audit log | Registro do primeiro turno |

### 2.7 Mecanismos de Resiliência

| Mecanismo | Descrição |
|-----------|-----------|
| **MaxTurnsExceeded** | Agente em loop → fallback amigável |
| **tool_call_id obsoleto** | Histórico corrompido → purga + retry |
| **ToolCallError/Timeout** | Retry único |
| **Provider fallback** | BYOK 5xx/429/timeout → recria com chave plataforma |
| **Anti-repetição** | Resposta repetitiva → fallback contextual |
| **Schema State** | Estado da conversa persistido (Redis + banco) |

---

## 3. API — ROTAS (130+ endpoints)

### 3.1 Autenticação (`/api/auth`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/login` | Login email/senha + tenantSlug |
| POST | `/registrar` | Criar usuário (ADMIN) |
| POST | `/refresh` | Refresh token |
| POST | `/admin-login` | Login SUPER_ADMIN |

### 3.2 Leads (`/api/leads`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Listar (paginado, filtros) |
| POST | `/` | Criar manual |
| GET | `/estatisticas` | Dashboard resumo |
| GET | `/:id` | Detalhes (SPIN, imóvel, conversas) |
| PATCH | `/:id` | Atualizar |
| DELETE | `/:id` | Excluir (cascade) |
| POST | `/:id/restaurar` | Restaurar arquivado |
| POST | `/:id/perder` | Marcar perdido |
| POST | `/:id/captar` | Marcar captado |
| POST | `/:id/reativar` | Reativar |
| POST | `/:id/atividades` | Criar atividade |
| PATCH | `/:id/atividades/:atividadeId` | Completar/cancelar atividade |
| GET | `/:id/chat` | Histórico WhatsApp |

### 3.3 Agenda (`/api/agenda`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Listar eventos |
| POST | `/bloqueio` | Bloquear horário |
| POST | `/:id/aprovar` | Aprovar agendamento + WhatsApp |
| GET/PUT | `/expediente` | Config de expediente |
| GET | `/google-calendar/status` | Health check GCal |
| GET | `/google-calendar/slots` | Slots livres |
| GET | `/google-calendar/disponibilidade` | Verificar horário |
| GET | `/google-calendar/link-agendamento` | Link público |

### 3.4 Campanhas (`/api/campanhas`)

| Grupo | Endpoints |
|-------|-----------|
| **CRUD** | Criar · Listar · Obter · Atualizar briefing · Status · Excluir |
| **Contatos** | Importar CSV/JSON · Vincular leads · Exportar · Pausar · Promover · Deletar |
| **Disparo** | Disparar · Pausar · Reativar · Status · Config · Funil · Leads quentes |
| **Mensagens** | Detalhes contato · Mensagens · Enviar manual · Histórico |
| **Manus** | Criar com pesquisa · Cache empreendimentos |
| **Atendimento** | Assumir humano · Devolver IA · Modo atendimento |

### 3.5 Mineração (`/api/mineracao`)

| Grupo | Endpoints |
|-------|-----------|
| **Busca** | Bairros · Edifícios · Unidades · Casas · Condomínios · Endereço |
| **Processamento** | Buscar proprietário (IPTU) · Enriquecimento lote (Assertiva) · Confirmar leads |
| **Jobs** | Iniciar · Status · Resultado · Cancelar |

### 3.6 WhatsApp (`/api/whatsapp` · `/api/sessoes-whatsapp`)

| Grupo | Endpoints |
|-------|-----------|
| **Conexão** | Status · Conectar (QR Code) · Reset · Desconectar |
| **Config** | Buscar · Atualizar · Webhook |
| **Sessões** | CRUD multi-sessão |
| **Mensagens** | Enviar texto |

### 3.7 Agentes IA (`/api/agentes`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/configurar-rapido` | Config rápida (pré-treinado) |
| GET/POST/PUT/DELETE | `/`, `/:id` | CRUD |
| PATCH | `/:id/ativar\|pausar\|desativar` | Lifecycle |
| PATCH | `/:id/perfil-imobiliaria` | Perfil comercial |
| POST | `/modo-avancado` | Agente personalizado |

### 3.8 Métricas (`/api/metricas*`)

| Rota | Endpoints |
|------|-----------|
| `/api/metricas` | Dashboard completo (leads, campanhas, conversas, Assertiva, conversão) |
| `/api/metricas-agentes` | Resumo · Conversas/dia · Workers · Funil · Atividade recente |
| `/api/metricas-ia` | Performance IA · Tools · Conversões |

### 3.9 Billing (`/api/billing`)

| Grupo | Endpoints |
|-------|-----------|
| **Tenant** | Saldo · Pacotes · Transações · Recarga · Upgrade · Comprar créditos |
| **Webhook** | Asaas (pagamentos) |
| **Admin** | Testar Asaas · Add créditos · Simular · Renovar · CRUD clientes · Planos |

### 3.10 Outros

| Rota | Endpoints |
|------|-----------|
| `/api/blacklist` | CRUD blacklist telefones |
| `/api/alertas` | CRUD alertas corretor |
| `/api/pesquisas` | Manus AI pesquisas |
| `/api/contatos` | Busca global |
| `/api/contratos` | Geração + aceite digital |
| `/api/clientes` | Carteira de clientes |
| `/api/documentos` | Upload RAG (PDF/TXT/DOC) |
| `/api/listas` | Listas de contatos |
| `/api/sincronizacao` | Sync Mapa Goiânia |
| `/api/configuracao/integracao` | Integrações CRM |
| `/api/configuracao/llm` | BYOK (OpenAI/OpenRouter) |
| `/api/usuarios` | CRUD usuários |
| `/api/tenant` | Perfil + logo |
| `/api/admin/auditoria` | Logs de auditoria |
| `/api/jobs` | Recontato manual |
| `/api/leads-vip` | Leads do site (Supabase) |
| `/webhooks` | Inbound WhatsApp + Manus |

---

## 4. SERVIÇOS (28)

| Serviço | Função |
|---------|--------|
| **assertiva** | Enriquecimento CPF/CNPJ (telefones, renda, score) |
| **autenticacao** | Login, registro, JWT |
| **blacklist** | Telefones bloqueados (opt-out) |
| **cep** | Consulta CEP (ViaCEP) |
| **conhecimento-curado** | RAG de técnicas de vendas curadas |
| **crm-service** | Envio leads para CRM externo |
| **disparo-campanha** | Disparo em massa com rate limiting e janela horária |
| **embeddings** | Vetorização semântica (text-embedding-3-small) |
| **google-calendar** | Google Calendar + Meet (slots, eventos, links) |
| **job-mineracao** | Jobs assíncronos de mineração (IPTU + Assertiva) |
| **job-unidades** | Jobs de busca de unidades |
| **manus** | Pesquisa de empreendimentos via Manus AI |
| **mapa** | API Mapa de Goiânia (bairros, edifícios, unidades) |
| **metricas-sdr** | Performance SDR + alertas corretor |
| **openai** | Whisper (transcrição) + GPT |
| **rag-conversas** | RAG conversacional (extrai + busca) |
| **rag-empreendimentos** | RAG de empreendimentos |
| **scheduler-limpeza-cache** | Limpeza periódica Redis |
| **scheduler-sincronizacao-mapa** | Sync periódico Mapa Goiânia |
| **scraper-iptu** | Scraper IPTU (proprietário por inscrição) |
| **servico-asaas** | Pagamentos (Asaas: PIX, boleto, assinatura) |
| **servico-auditoria** | Logs de auditoria |
| **servico-creditos** | Gestão de créditos (mensal, prepago, bônus) |
| **servico-gestao-clientes** | CRUD tenants/clientes SaaS |
| **servico-supabase** | Leads VIP do site (Supabase) |
| **sincronizacao-mapa** | Sync base local ↔ Mapa Goiânia |
| **webhook-utils** | Detecção de interesse, telemetria |
| **websocket** | Socket.IO alertas em tempo real |
| **whatsapp** | Evolution API (instância, QR, mensagens) |

---

## 5. CASOS DE USO (8)

| Use Case | Chamado por | Função |
|----------|-------------|--------|
| `ConverterParaLeadUseCase` | Tool `converter_para_lead`, webhook, rota promover | Contato → Lead |
| `QualificarLeadUseCase` | Tool `qualificar_lead` | Temperatura + SPIN |
| `MoverParaFaseUseCase` | Tool `mover_para_fase` | Kanban (FASE1→CAPTADO) |
| `SalvarDadosImovelUseCase` | Tool `salvar_dados_imovel` | Dados imóvel pós-contrato |
| `AgendarFollowupUseCase` | Tool `agendar_followup` | Recontato futuro |
| `EncaminharCorretorUseCase` | Tool `encaminhar_corretor` | Escalação humana + alerta |
| `AtualizarDadosLeadUseCase` | Tool `atualizar_dados_lead` | CPF, email, endereço |
| `RegistrarOptoutUseCase` | Tool `registrar_optout` | Opt-out + blacklist |

---

## 6. BANCO DE DADOS (35 Models)

### 6.1 Core Business

| Model | Tabela | Campos | Descrição |
|-------|--------|---------|-----------|
| **Tenant** | `tenants` | ~60 | Multi-tenancy: imobiliária + billing + BYOK + perfil |
| **Usuario** | `usuarios` | ~12 | Usuários (SUPER_ADMIN, ADMIN, CORRETOR, VISUALIZADOR) |
| **Campanha** | `campanhas` | ~28 | Campanhas de prospecção/mineração |
| **Contato** | `contatos` | ~55 | Contatos da campanha (Assertiva, IPTU, prospecção) |
| **Lead** | `leads` | ~75 | Leads qualificados (SPIN, imóvel, CRM, contrato) |
| **Imovel** | `imoveis` | ~40 | Imóveis (IPTU, geo, proprietário) |
| **Cliente** | `clientes` | ~9 | Leads convertidos (carteira) |
| **Contrato** | `contratos` | ~16 | Contratos digitais |

### 6.2 Conversas & IA

| Model | Tabela | Descrição |
|-------|--------|-----------|
| **ConfiguracaoAgente** | `configuracoes_agente` | Config do agente IA |
| **DocumentoAgente** | `documentos_agente` | RAG docs do agente |
| **Conversa** | `conversas` | Conversas (FSM SPIN) |
| **Mensagem** | `mensagens` | Mensagens individuais |
| **MensagemProspeccao** | `mensagens_prospeccao` | Msgs de prospecção ativa |
| **ConversaEmbedding** | `conversas_embeddings` | RAG conversas (PGVector) |
| **ConhecimentoCurado** | `conhecimento_curado` | Técnicas vendas curadas |
| **EmpreendimentoConhecimento** | `empreendimentos_conhecimento` | RAG empreendimentos (PGVector) |
| **MetricaMensagem** | `metricas_mensagens` | Métricas qualidade IA |

### 6.3 Prospecção & Mineração

| Model | Tabela | Descrição |
|-------|--------|-----------|
| **Bairro** | `bairros_geo` | Base geográfica bairros |
| **Edificio** | `edificios_geo` | Base geográfica edifícios |
| **SincronizacaoMapa** | `sincronizacoes_mapa` | Log sync Mapa Goiânia |
| **Lista** / **ContatoLista** | `listas` / `contatos_lista` | Listas de mineração |
| **CacheCpf** / **ConsultaCpf** | `cache_cpf` / `consultas_cpf` | Cache Assertiva |
| **LogScraperIPTU** | `logs_scraper_iptu` | Log scraping IPTU |
| **PesquisaManus** | `pesquisas_manus` | Pesquisas Manus AI |

### 6.4 Operacional

| Model | Tabela | Descrição |
|-------|--------|-----------|
| **SessaoWhatsapp** | `sessoes_whatsapp` | Sessões Evolution API |
| **Atividade** | `atividades` | Atividades dos leads |
| **AlertaCorretor** | `alertas_corretor` | Alertas para corretores |
| **TelefoneBlacklist** | `telefones_blacklist` | Blacklist opt-out |
| **ConfiguracaoIntegracao** | `configuracoes_integracao` | Integrações CRM |

### 6.5 Billing

| Model | Tabela | Descrição |
|-------|--------|-----------|
| **Transacao** | `transacoes` | Transações financeiras |
| **Pacote** | `pacotes` | Pacotes de recarga |
| **RenovacaoLog** | `renovacoes_log` | Log renovações |
| **LogAuditoria** | `logs_auditoria` | Auditoria geral |

### 6.6 Embeddings (PGVector)

- `EmpreendimentoConhecimento.embedding` — vector(1536)
- `ConversaEmbedding.embedding` — vector(1536)

### 6.7 Campos @deprecated

| Campo | Model | Nota |
|-------|-------|------|
| `openaiApiKeyCriptografada` | Tenant | Chave secundária removida |
| `usarChavePrincipalParaAudio` | Tenant | Chave única cobre tudo |
| `usarChavePrincipalParaRag` | Tenant | Chave única cobre tudo |
| `SDR_VENDAS`, `SDR_LOCACAO`, `DOCUMENTOS` | TipoAgente | Mantidos para compat |
| `CONTATANDO`...`INATIVO` (5) | StatusLead | Mantidos para compat |

---

## 7. FRONTEND (34 páginas)

### 7.1 Stack

| Item | Tecnologia |
|------|-----------|
| Framework | React 18 |
| Build | Vite 5 |
| CSS | Tailwind CSS 4 |
| UI | Componentes custom (21 base + 20 negócio) |
| Roteamento | React Router |
| WebSocket | Socket.IO (alertas real-time) |
| Server | Nginx (Docker) |

### 7.2 Páginas Públicas (3)

| Página | Rota |
|--------|------|
| Login | `/login` |
| Confirmar Agendamento | `/confirmar/:atividadeId/:token` |
| Aceitar Contrato | `/aceitar-contrato/:token` |

### 7.3 Dashboard (22 páginas)

| Página | Rota |
|--------|------|
| Prospecção | `/dashboard/prospeccao` (default) |
| Agentes | `/dashboard/agentes` · `/dashboard/agente/:id` |
| Performance Agentes | `/dashboard/agente/performance` |
| Agenda | `/dashboard/agenda` |
| WhatsApp | `/dashboard/whatsapp` · `/dashboard/sessoes-whatsapp` |
| Leads | `/dashboard/leads` · `/dashboard/leads/:id` |
| Clientes | `/dashboard/clientes` |
| Campanhas | `/dashboard/campanhas` · `/dashboard/campanhas/:id` |
| Contato Detalhes | `/dashboard/campanhas/:campanhaId/contatos/:contatoId` |
| Listas | `/dashboard/listas` · `/dashboard/listas/:id` |
| Mineração | `/dashboard/mineracao` |
| Captação | `/dashboard/captacao` |
| Relatórios | `/dashboard/relatorios` |
| Configurações | `/dashboard/configuracoes` |
| Blacklist | `/dashboard/blacklist` |
| Perfil Imobiliária | `/dashboard/perfil` |
| Créditos | `/dashboard/creditos` |
| Upgrade | `/dashboard/upgrade` |
| Integrações | `/dashboard/integracoes` |
| BYOK LLM | `/dashboard/configuracao-llm` |
| Equipe | `/dashboard/equipe` |

### 7.4 Admin (6 páginas)

| Página | Rota |
|--------|------|
| Clientes | `/admin/clientes` |
| Auditoria | `/admin/auditoria` |
| Transações | `/admin/transacoes` |
| Leads VIP | `/admin/leads-vip` |
| Pacotes | `/admin/pacotes` |
| Planos | `/admin/planos` |

---

## 8. INFRAESTRUTURA

### 8.1 Containers Docker (8)

| Container | Imagem | Porta | Função |
|-----------|--------|-------|--------|
| `elyon_backend` | Build local (Node.js) | 3000 (interna) | API REST + WebSocket |
| `elyon_frontend` | Build local (Nginx) | 80 (interna) | Dashboard React |
| `elyon_site` | Build local (Nginx) | 80 (interna) | Site institucional |
| `elyon_postgres` | pgvector/pgvector:0.8.0-pg15 | 5432 (interna) | Banco de dados |
| `elyon_redis` | redis:7-alpine | 6379 (interna) | Cache |
| `elyon_traefik` | traefik:v3.3 | 80, 443 | Proxy reverso + TLS |
| `elyon_audio_converter` | evolution-audio-converter | 4040 (interna) | Transcrição áudio |
| `elyon_backup` | postgres-backup-local:15 | — | Backup automático |

### 8.2 Domínios

| URL | Serviço |
|-----|---------|
| `crm.elyon.ia.br` | Frontend Dashboard |
| `api.elyon.ia.br` | Backend API |
| `elyon.ia.br` | Site institucional |
| `traefik.elyon.ia.br` | Traefik Dashboard (protegido) |

### 8.3 Volumes Persistentes

| Volume | Uso |
|--------|-----|
| `postgres_data` | Dados PostgreSQL |
| `redis_data` | Dados Redis |
| `traefik_letsencrypt` | Certificados TLS |
| `./backups` | Backups automáticos (bind mount) |

### 8.4 Redes Docker

| Rede | Tipo | Uso |
|------|------|-----|
| `elyon_network` | External bridge | Comunicação entre todos os serviços |
| `crm_quadradois_net` | External bridge | Backend ↔ Site (CRM externo) |

### 8.5 Secrets

```
/root/elyon/secrets/
├── db_password.txt     (chmod 600)
├── redis_password.txt  (chmod 600)
└── jwt_secret.txt      (chmod 600)
```

### 8.6 Backup

- **Automático:** Diário às 03:00 (container `elyon_backup`)
- **Retenção:** 7 dias diário · 4 semanas · 6 meses
- **R2 (offsite):** Scripts `backup_r2.sh` / `restore_r2.sh`

### 8.7 Deploy

```bash
cd /root/elyon
./scripts/deploy.sh build    # Reconstrói imagens
./scripts/deploy.sh up       # Inicia serviços
./scripts/deploy.sh update   # git pull → build → down → up
./scripts/deploy.sh logs     # Logs em tempo real
./scripts/deploy.sh status   # Status containers
```

---

## 9. JOBS AUTOMÁTICOS (3)

| Job | Schedule | Função |
|-----|----------|--------|
| **Recontato Automático** | Diário 9h | Recontata MORNO_FUTURO com data vencida |
| **Reengajamento** | Terça/Quinta 10h | Re-engaja FRIO (30+ dias) com valor |
| **Conversas Inativas** | Hora em hora | Finaliza conversas 24h sem msg · Fiscaliza conversões · Alertas |

---

## 10. INTEGRAÇÕES EXTERNAS

| Integração | Uso | Tipo |
|------------|-----|------|
| **OpenAI** | LLM (GPT-4.1), Whisper (transcrição), Embeddings | API Key |
| **OpenRouter** | Gateway LLM alternativo (BYOK) | API Key |
| **Evolution API** | WhatsApp (instâncias, mensagens, webhook) | Self-hosted |
| **Google Calendar** | Agendamento + Google Meet | Service Account |
| **Assertiva** | Enriquecimento CPF/CNPJ (telefones, renda, score) | OAuth2 |
| **Manus AI** | Pesquisa de empreendimentos | API Key |
| **Asaas** | Pagamentos (PIX, boleto, assinatura) | API Key |
| **AWS S3** | Storage (logos, documentos) | IAM Keys |
| **Supabase** | Leads VIP do site | API Key |
| **Mapa Goiânia** | Dados geográficos (bairros, edifícios, IPTU) | API pública |
| **ViaCEP** | Consulta CEP | API pública |

---

## 11. MIDDLEWARE

| Middleware | Função |
|------------|--------|
| `verificarAutenticacao` | JWT + cache Redis (5min) → `req.usuario` + `req.tenantId` |
| `verificarAdmin` | Restringe a ADMIN/SUPER_ADMIN |
| `verificarSuperAdmin` | Restringe a SUPER_ADMIN |
| `verificarCreditos` | Bloqueia se saldo=0 (HTTP 402) |
| `alertarCreditosBaixos` | Header aviso se <10 créditos |
| Helmet | Headers de segurança |
| CORS | Whitelist de origens |
| Rate Limit global | 200 req/min |
| Rate Limit login | 10/15min |

---

## 12. TESTES

| Métrica | Valor |
|---------|-------|
| **Suites** | 48 |
| **Testes** | 676 |
| **Passando** | 676 (100%) |
| **Falhando** | 0 |

### Distribuição

| Módulo | Suites | Descrição |
|--------|--------|-----------|
| Agentes | 35 | Agents, orchestrator, tools, guardrails, handoffs, skills, structured output, adversarial |
| Casos de Uso | 8 | Todos os 8 use cases |
| Rotas | 2 | Autenticação + Mineração |
| Utilitários | 3 | behavioralRAG, cascade-delete, tenant |

---

## 13. MÓDULOS DO ORCHESTRATOR (23 arquivos de suporte)

| Arquivo | Função |
|---------|--------|
| `agent-chain.ts` | Mapeamento status→agente, cache, criação da cadeia |
| `agent-runner.ts` | Execução com retry em 4 camadas |
| `agent-resolution.ts` | Nome SDK → tipo |
| `byok-resolver.ts` | Resolve chave BYOK (tenant vs plataforma) |
| `context-builder.ts` | Constrói ElyonContext |
| `input-builder.ts` | Monta input para SDK |
| `conversation-state.ts` | Schema State (extrai, atualiza, fallbacks) |
| `conversation-cache.ts` | Redis cache (history, state, agent) |
| `output-extraction.ts` | Separa texto + CoT + structured output |
| `response-filters.ts` | Filtros pós-resposta |
| `handoff-filters.ts` | Limpeza de histórico + briefing handoff |
| `post-handoff.ts` | Atualiza agente persistido |
| `history-persistence.ts` | Salva histórico SDK no cache |
| `entry-guardrail.ts` | Guardrails de entrada |
| `guardrails.ts` | Opt-out, spam, blacklist |
| `persisted-agent.ts` | Resolve agente persistido |
| `sentiment-analyzer.ts` | Análise de sentimento (regex) |
| `classificador-objecao.ts` | Classificação de objeção (LLM) |
| `classificador-skills.ts` | Pré-carregamento de skill |
| `orchestrator-metrics.ts` | Logging de métricas |
| `orchestrator-queries.ts` | Queries de config/contexto |
| `shared-behavioral-guardrails.ts` | Regras anti-injection |
| `commercial-policy.ts` | Comissão/prazo padrão |
| `few-shot-examples.ts` | Exemplos por fase |
| `elyon-context.ts` | Interface + `criarModeloBYOK()` |
| `elyon-core.ts` | Jobs: finalizar, inativas, fiscalizar |

---

## 14. RESUMO EXECUTIVO

| Dimensão | Contagem |
|----------|----------|
| **Agentes IA** | 4 (Opener + Presenter + Admin + Knowledge) |
| **Ferramentas IA** | 17 |
| **Skills (playbooks)** | 15 |
| **Endpoints API** | 130+ |
| **Serviços backend** | 28 |
| **Casos de uso** | 8 |
| **Models banco** | 35 |
| **Páginas frontend** | 34 |
| **Integrações externas** | 11 |
| **Jobs automáticos** | 3 |
| **Containers Docker** | 8 |
| **Testes** | 676 (100% green) |
| **Total LOC** | ~90.000 |
