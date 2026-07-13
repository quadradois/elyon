# Raio-X AS-IS / TO-BE — Processo de Mineração de Leads (Elyon CRM)

> **Data:** 2026-06-10
> **Escopo:** Pipeline completo de mineração de leads (Goiânia), da seleção do imóvel até a prospecção, e a evolução planejada com a API ICAD geo360.
> **Documentos relacionados:** `SOP_API_ICAD_geo360_Goiania.md` (mesma pasta), `docs/MAPA_GAPS_PIPELINE_DADOS`.

---

## 1. Visão geral

O processo de mineração de leads inicia na página **`/dashboard/mineracao`** (`pacotes/frontend/src/paginas/Mineracao.tsx`, rota registrada em `App.tsx:326`) e percorre **5 etapas**:

```
[1. Seleção do imóvel]  →  [2. Identificação do proprietário]  →  [3. Enriquecimento]
        ↓                          ↓                                      ↓
  Base local + API           Scraper IPTU (Prefeitura)             Assertiva + Cache CPF
  Prefeitura/geo360
        ↓
[4. Vinculação e persistência]  →  [5. Consumo / Prospecção]
   Lead + Campanha                  Proprietários, SDR IA, WhatsApp
```

A integração com a **API geo360/ICAD** (TO-BE) atua principalmente nas etapas 1 e 2, substituindo/complementando o scraper HTML da Prefeitura por consultas estruturadas e oficiais.

---

## 2. AS-IS — Processo atual

### 2.1 Etapa 1 — Seleção do imóvel (`/dashboard/mineracao`)

A página oferece **5 modos de mineração**:

| Modo | Descrição |
|---|---|
| Edifícios por Bairro (recomendado) | Hierarquia Bairro → Edifício → Unidades |
| Por Nome | Busca fuzzy pelo nome do edifício |
| Condomínios de Casas | Condomínios horizontais |
| Por IPTU | Inscrição cadastral direta |
| Por Endereço | Rua + número |

**Fontes de dados:**
- **Primária:** base cartográfica local em PostgreSQL (`prisma.Imovel`, `Edificio`, `Bairro` — tabelas `imoveis`, `edificios_geo`, `bairros_geo`).
- **Fallback:** API REST da Prefeitura (`portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/...`), via `MapaService` (`pacotes/backend/src/servicos/mapa.ts`). Flag `MINERACAO_LOCAL_ONLY=true` pula a API externa quando há dado local.

**Endpoints do backend:**
- `GET /mineracao/bairros`
- `GET /mineracao/edificios/:cdbairro`
- `GET /mineracao/unidades/:cdedificio` (paginado)
- `GET /mineracao/buscar-edificios?termo=...`
- `GET /mineracao/condominios?termo=...`
- `GET /mineracao/casas/:cdbairro`
- `GET /mineracao/endereco?rua=...&numero=...`

### 2.2 Etapa 2 — Identificação do proprietário (Scraper IPTU)

1. Usuário seleciona unidades → "Minerar Leads" → `POST /mineracao/jobs/iniciar` (job assíncrono).
2. O job processa em **lotes de 10 imóveis** com delay de 500 ms entre lotes.
3. Para cada inscrição, o `ScraperIPTUService` (`pacotes/backend/src/servicos/scraper-iptu.ts`) faz POST de formulário em:
   `https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00201w0.asp`
4. O HTML retornado é parseado **por regex**: nome do proprietário, CPF/CNPJ (com máscara LGPD), endereço de correspondência, apartamento/bloco/quadra/lote, tipo (PREDIAL/TERRITORIAL).
5. Frontend acompanha via polling: `GET /mineracao/jobs/:jobId/status` (2 s) e `GET /mineracao/jobs/:jobId/resultado`.

**Controle financeiro:** saldo verificado antes (`servicoCreditos.consultarSaldo`); **1 crédito por imóvel** raspado com sucesso. Nenhum Lead é criado nesta etapa (dados provisórios para revisão).

### 2.3 Etapa 3 — Enriquecimento (Assertiva)

`POST /mineracao/confirmar-leads` → serviço `Assertiva` (`pacotes/backend/src/servicos/assertiva.ts`):

- **Deduplicação de CPFs** e consulta ao cache `CacheCpf` (TTL **365 dias**, janela deslizante).
- **Cache hit:** sem custo de API; cobra 1 crédito do tenant se houver telefone; registra auditoria em `ConsultaCpf` (custo/cobrança/lucro).
- **Cache miss:** chamada à API Assertiva (~US$ 0,15/consulta) → telefones (com flag WhatsApp), e-mails, score, dados demográficos, renda estimada, profissão, empresa/CNPJ, participações societárias, redes sociais.

### 2.4 Etapa 4 — Vinculação e persistência

`POST /campanhas/:id/vincular-leads-minerados`: cria/atualiza registros `Lead` com dados do scraper + Assertiva, vincula à campanha via `campanhaOrigemId`, persiste telefones/e-mails como JSON.

### 2.5 Etapa 5 — Consumo / Prospecção

- `/dashboard/proprietarios` e `/dashboard/proprietarios/:id` — listagem e detalhe dos leads minerados.
- `/dashboard/leads` — pipeline de prospecção.
- **Agente SDR (IA)** — qualificação SPIN e handoff para humano.
- **WhatsApp** — via Evolution API (migração para Evolution GO em andamento).

### 2.6 Gaps conhecidos do AS-IS (de `MAPA_GAPS_PIPELINE_DADOS`)

| Prioridade | Gap | Problema | Impacto |
|---|---|---|---|
| 🔴 Crítico | GAP-03 | Scraper não extrai `valorVenal`, `areaConstruida`, `areaTerreno`, `anoConstituicao` (scraper-iptu.ts ~linha 163) | Impossível avaliar o imóvel |
| 🔴 Crítico | GAP-05 | `cpfMae`, `escolaridade` chegam da Assertiva mas são descartados (schema sem campos) | Perda de enriquecimento |
| 🟠 Alto | GAP-06 | `estadoCivil` retorna da Assertiva mas nunca é mapeado para o Lead | Perfil incompleto |
| 🟠 Alto | GAP-UI-1/2/3 | `ppe`, `participacoesEmpresas`, `redesSociais`, `setor`, `cnpjEmpresa` existem no banco mas não aparecem na UI | Prospecção "às cegas" |
| 🟡 Médio | GAP-01 | Dados estruturais (pavimentos, elevadores, vagas) não exibidos na seleção de unidades | UI mostra só nome/endereço |
| 🟡 Médio | GAP-02 | Estrutura do `Imovel` ignorada no `EmpreendimentoConhecimento` | IA sem contexto do prédio |
| 🟡 Médio | GAP-07 | Vínculo Campanha ↔ Empreendimento não exibido no detalhe | Operador sem contexto |

**Resumo do impacto:** o pipeline funciona ponta a ponta, mas **perde ~30–40% do dado enriquecido** (valor, compliance, perfil profissional) por lacunas de schema/mapeamento/UI.

### 2.7 Fragilidades estruturais do AS-IS

1. **Scraper HTML por regex** — quebra a qualquer mudança de layout do site da Prefeitura; sem contrato formal.
2. **Sem geolocalização confiável** na origem — `geom` não vem do scraper.
3. **Sem visão de cobertura** — não há como enumerar setor/quadra inteiros; a mineração depende da base local estar completa.
4. **Throughput limitado** — lotes de 10 com delay, página por página.

---

## 3. TO-BE — Processo futuro com a API geo360/ICAD

### 3.1 O que muda

A API geo360 (ver `SOP_API_ICAD_geo360_Goiania.md`) fornece **consulta cadastral estruturada e oficial**, com dois serviços:

| Serviço | URL base | Autenticação |
|---|---|---|
| Busca cadastral | `apis-goiania.geo360.com.br/cadastro/search/` | `Authorization: Bearer <authToken>` |
| Gateway PostgREST (bairros, geografia) | `apis-goiania.geo360.com.br/gateway/rest/` | `x-auth-token` + `x-tn-token` |

Recurso-chave: `GET /cadastro/search/goiania/imobiliario?inscricao_cartografica=<código>`
- **3 dígitos** → todos os imóveis do **setor** (validado: setor 101 = 11.544 imóveis)
- **7 dígitos** → todos da **quadra**
- **10 dígitos** → **lote** específico
- Retorna: `id_imobiliario`, `id_lote`, `geom`, `inscricao_cartografica`, `numero_cadastro`

### 3.2 Mudanças por etapa

**Etapa 1 — Seleção (impacto alto)**
- Novo serviço backend `GEO360Service` com gestão dos tokens públicos (`authToken` UUID + `tnToken` base64; **rotacionáveis** — nunca fixar no código).
- Novos endpoints propostos:
  - `GET /mineracao/geo360/setor/:setor`
  - `GET /mineracao/geo360/quadra/:quadra`
  - `GET /mineracao/geo360/lote/:lote`
- **Mineração por varredura territorial** (setor/quadra inteiros) — modo novo, inexistente no AS-IS.
- Dados de bairro enriquecidos via PostgREST (`/gateway/rest/bairro?select=*`): população, área, zona, lat/long — alimentam segmentação e a base `bairros_geo`.

**Etapa 2 — Identificação (impacto médio)**
- geo360 valida a inscrição cadastral e fornece `geom` antes do scraper, reduzindo consultas desperdiçadas em inscrições inválidas.
- O scraper IPTU **permanece como fonte do nome/CPF do proprietário** (geo360 não expõe dado pessoal — coerente com portal público).
- Estratégia: **geo360 primeiro** (estrutura + validação) → scraper só para o dado de proprietário; scraper continua como fallback completo.

**Etapas 3–5 — sem mudança estrutural**, mas se beneficiam:
- `geom` persiste em `Imovel` (latitude/longitude confiáveis) → mapas e segmentação geográfica na UI e no agente SDR.
- Fonte cadastral registrada (proveniência do dado).

### 3.3 Comparativo AS-IS × TO-BE

| Dimensão | AS-IS | TO-BE |
|---|---|---|
| Fonte cadastral | Base local + API MapaServer (fallback) | geo360 oficial + base local (cache) + scraper (fallback) |
| Formato do dado | HTML parseado por regex | JSON estruturado |
| Cobertura | Limitada à base local carregada | Varredura por setor (3 díg.) / quadra (7 díg.) / lote (10 díg.) |
| Geolocalização | Esparsa/ausente | `geom` em toda resposta |
| Robustez | Quebra com mudança de layout | Contrato de API (PostgREST + REST) |
| Total de imóveis do município | Desconhecido | Calculável (soma dos counts por setor) |
| Dados de bairro | Estáticos na base local | Demografia/zona/área via PostgREST |
| Proprietário (nome/CPF) | Scraper IPTU | **Mantido scraper IPTU** (geo360 não fornece) |
| Enriquecimento pessoal | Assertiva + cache 365d | Inalterado |

### 3.4 Riscos e cuidados do TO-BE

1. **Rotação de tokens** — `authToken`/`tnToken` são públicos mas rotacionáveis; o `GEO360Service` precisa de mecanismo de refresh (releitura do portal) e retry em 401.
2. **Esquemas de auth distintos por serviço** — Bearer no `/cadastro/search/`, headers `x-auth-token`/`x-tn-token` no `/gateway/rest/` (erro comum, já validado em teste: misturar gera 401).
3. **Volume** — um setor pode retornar >11 mil imóveis; respostas grandes exigem paginação/streaming e persistência em lote.
4. **Dependência externa pública** — sem SLA; manter base local como cache primário e scraper como contingência.
5. **Multi-município** — `tnToken` "1308" = Goiânia; arquitetura deve parametrizar o tenant para expansão futura.

### 3.5 Roadmap sugerido

| Fase | Entrega | Observação |
|---|---|---|
| 1 | `GEO360Service` (auth + 2 esquemas + retry/rotação de token) | Fundação |
| 2 | Endpoints `/mineracao/geo360/{setor,quadra,lote}` + persistência de `geom` em `Imovel` | Habilita varredura territorial |
| 3 | Sincronização de bairros via PostgREST → `bairros_geo` | Demografia para segmentação |
| 4 | Orquestração híbrida: geo360 (estrutura) → scraper (proprietário) → Assertiva (enriquecimento) | Pipeline TO-BE completo |
| 5 | Correção dos GAPs críticos (03, 05, 06) em paralelo | Baixo esforço, alto valor |
| 6 | UI: mapa/geolocalização na mineração + exposição dos campos ocultos | Fecha os GAPs de UI |

---

## 4. Conclusão

O AS-IS é um pipeline funcional de 5 etapas (seleção → scraper IPTU → Assertiva → Lead/Campanha → prospecção), porém frágil na origem do dado cadastral (HTML + regex), cego geograficamente e com perda significativa de dados enriquecidos por gaps de schema/UI.

O TO-BE com a API geo360 ataca exatamente a raiz: **dado cadastral oficial, estruturado, georreferenciado e enumerável por setor/quadra/lote**, mantendo o scraper apenas para o que a API pública não fornece (identidade do proprietário) e preservando intactas as etapas de enriquecimento e prospecção. O ganho central é transformar a mineração de "busca no que já temos carregado" em **varredura territorial sistemática de Goiânia**, com fundação pronta para outros municípios da plataforma geo360.
