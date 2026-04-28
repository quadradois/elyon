# Mapa de Gaps — Pipeline de Dados: Mineração → CRM

**Data:** 2026-04-27  
**Escopo:** Ciclo completo de dados desde a seleção do edifício até a exibição no ProprietarioDetalhes

---

## Visão Geral do Pipeline

```
[1] Seleção do Edifício       → mapaService → DB local ou API Prefeitura Goiânia
        ↓
[2] Scraper IPTU              → scraperIPTU.consultarProprietario() → HTML Prefeitura
        ↓
[3] Enriquecimento Assertiva  → assertivaService.enriquecerDocumento() → cacheCpf → Contato
        ↓
[4] Vincular à Campanha       → POST /campanhas/:id/vincular-leads-minerados → Contato (DB)
        ↓
[5] Exibição UI               → GET /api/proprietarios/:id → ProprietarioDetalhes
```

---

## ETAPA 1 — Seleção do Edifício

### Fonte dos dados
- **Primária:** Base local PostgreSQL (`prisma.bairro`, `prisma.edificio`, `MODO_BASE_LOCAL_ONLY=true`)
- **Fallback:** API REST da Prefeitura de Goiânia (`portalmapa.goiania.go.gov.br`)
- **Importante:** Quando a base local tem dados (`bairrosLocais.length > 0`), a API externa NÃO é consultada

### O que retorna para o frontend na busca
```
{ codigo, nome, logradouro, totalUnidades? }
```

### O que JÁ EXISTE na tabela `Imovel` mas nunca é exibido na seleção

| Campo | Descrição | Gap |
|-------|-----------|-----|
| `numeroPavimentos` | Nº de andares do edifício | Nunca exibido |
| `numeroElevadores` | Quantidade de elevadores | Nunca exibido |
| `vagasCobertas` | Vagas cobertas total | Nunca exibido |
| `vagasDescobertas` | Vagas descobertas total | Nunca exibido |
| `numeroGaragens` | Nº de garagens | Nunca exibido |
| `areaTerreno` | Área do terreno (m²) | Nunca exibido |
| `areaEdificada` | Área edificada (m²) | Nunca exibido |
| `latitude` / `longitude` | Geolocalização | Nunca exibido |
| `codigoEdificio` | Código do edifício na prefeitura | Nunca vinculado ao EmpreendimentoConhecimento |
| `tipoEdificacao1/2` | Tipo estrutural (código int) | Nunca decodificado |
| `estrutura/esquadrias/piso/forro` | Acabamento (códigos int) | Nunca decodificados |

**GAP-01:** A tela de seleção de edifício exibe apenas nome e logradouro. Dados ricos de estrutura (pavimentos, elevadores, vagas) já estão no banco mas são desperdiçados — o usuário seleciona um edifício "às cegas" sem saber quantas unidades tem vagas, quantos andares, etc.

**GAP-02:** O `EmpreendimentoConhecimento` (base de conhecimento do agente IA) é alimentado apenas por briefing textual. Os dados estruturais do `Imovel` (pavimentos, elevadores, vagas, áreas) nunca são injetados no briefing — o agente IA não sabe responder perguntas básicas sobre a estrutura do condomínio.

---

## ETAPA 2 — Scraper IPTU (Prefeitura de Goiânia)

### O que o scraper extrai do HTML

| Campo | Status |
|-------|--------|
| `nome` | ✅ Capturado |
| `cpf` / `cnpj` | ✅ Capturado (com filtro LGPD para mascarados) |
| `endereco_correspondencia` (raw) | ✅ Capturado |
| `tipoImovel` (PREDIAL/TERRITORIAL) | ✅ Capturado |
| `apartamento`, `bloco`, `unidade` | ✅ Parseado do endereço |
| `box`, `quadra`, `lote` | ✅ Parseado do endereço |
| `nomeEdificio` | ✅ Parseado do endereço |
| `logradouro`, `numero` | ✅ Parseado do endereço |

### O que a página da Prefeitura tem mas o scraper NÃO captura

| Campo | Evidência no código | Gap |
|-------|---------------------|-----|
| `valorVenal` | `iptu-unitario` retorna `valorVenal: 'N/D'` com comentário "futuro improvement" | Comentário explícito de gap reconhecido |
| `areaConstruida` | `iptu-unitario` retorna `area: 'N/D'` com mesmo comentário | Idem |
| `areaTerreno` | Não capturado pelo scraper | Linha 807 do vincular usa `lead.areaTerreno` mas vem sempre nulo |
| `anoConstituicao` | Campo existe no Contato (`anoConstituicao Int?`) mas nunca é preenchido | Scraper não extrai |

**GAP-03:** `valorVenal`, `areaConstruida` e `areaTerreno` existem na página da Prefeitura, estão na tabela Contato, mas o scraper não os captura. O próprio código tem comentário "N/D - futuro improvement". Esses campos são críticos para precificação e qualificação do imóvel.

**GAP-04:** O scraper usa apenas 3 regex (`nomeMatch`, `cpfMatch`, `enderecoMatch`) para extrair dados de uma página HTML rica. Qualquer campo adicional da Prefeitura exigiria apenas um novo regex — o custo de adição é mínimo.

---

## ETAPA 3 — Enriquecimento Assertiva

### O que a Assertiva retorna (interface `DadosEnriquecidos`)

| Grupo | Campos | Status no Cache | Status no Contato |
|-------|--------|-----------------|-------------------|
| Identificação | cpf, nome, score | ✅ Salvo | ✅ Salvo |
| Telefones | telefones[] com whatsapp flag | ✅ Salvo | ✅ Salvo (5 campos + JSON) |
| Emails | emails[] | ✅ Salvo | ✅ Salvo (5 campos + JSON) |
| Cadastral | dataNascimento, idade, sexo, signo | ✅ Salvo | ✅ Salvo |
| Cadastral | situacaoCadastral, obitoProvavel, ppe | ✅ Salvo | ✅ Salvo |
| Cadastral | nomeMae | ✅ Salvo | ✅ Salvo |
| Cadastral | **cpfMae** (marcado NOVO) | ❌ NÃO salvo no cache | ❌ NÃO salvo no Contato |
| Cadastral | **escolaridade** (marcado NOVO) | ❌ NÃO salvo no cache | ❌ NÃO salvo no Contato |
| Profissional | rendaEstimada, faixaSalarial | ✅ Salvo | ✅ Salvo |
| Profissional | profissao, setor, empresaAtual, cnpjEmpresa | ✅ Salvo | ✅ Salvo |
| Endereço | logradouro, bairro, cidade, uf, cep | ✅ Salvo | ✅ Salvo (montado como string) |
| Endereço | **tipoLogradouro** (marcado NOVO) | ❌ NÃO salvo | ❌ NÃO salvo |
| Participações | participacoesEmpresas[] | ✅ Salvo | ✅ Salvo (JSON) |
| Redes Sociais | redesSociais[] | ✅ Salvo | ✅ Salvo (JSON) |

**GAP-05:** `cpfMae`, `escolaridade` e `tipoLogradouro` foram adicionados à interface com comentário "NOVO" mas não foram incluídos no objeto `dadosCache` (linha 456-478 de processamento.rotas.ts) nem no create do Contato. A Assertiva os retorna, eles chegam no objeto em memória, mas são descartados antes de persistir.

**GAP-06:** O schema do Contato tem `estadoCivil String?` que nunca é preenchido por nenhuma etapa — a Assertiva retorna `estadoCivil` em dados cadastrais (via `cadastro.estadoCivil` implícito) mas o mapeamento não inclui esse campo.

---

## ETAPA 4 — Persistência no Contato (vincular-leads-minerados)

### O que chega da Assertiva e NÃO é mapeado para o Contato

| Campo Assertiva | Campo Contato | Situação |
|-----------------|---------------|----------|
| `enriquecido.escolaridade` | Não existe no schema | Schema precisaria de migration |
| `enriquecido.cpfMae` | Não existe no schema | Schema precisaria de migration |
| Histórico profissional completo | Apenas dado mais recente | Assertiva retorna array, salva só o índice 0 |

### O que está no schema do Contato mas nunca é preenchido

| Campo | Motivo | Impacto |
|-------|--------|---------|
| `estadoCivil` | Mapeamento ausente | Dado útil para perfil do proprietário |
| `perfilInvestidor` | Nunca calculado | Boolean que poderia ser derivado de participacoesEmpresas |
| `anoConstituicao` | Scraper não captura | Dado do imóvel útil para negociação |
| `valorVenal` | Scraper não captura (ver GAP-03) | Preço de referência do imóvel |
| `areaConstruida` | Scraper não captura (ver GAP-03) | Metragem do apartamento |

---

## ETAPA 5 — Exibição no ProprietarioDetalhes (UI)

### Campos no Contato que NUNCA chegam ao operador

| Campo | Está no Contato? | Exibido na UI? | Impacto operacional |
|-------|------------------|----------------|---------------------|
| `ppe` | ✅ | ❌ | Compliance — saber se é PEP é crítico para captação |
| `obitoProvavel` | ✅ | ❌ | Evitar prospectar contato com óbito provável |
| `estadoCivil` | ✅ (schema) | ❌ | Contexto para abordagem |
| `setor` | ✅ | ❌ | Setor de atuação profissional |
| `cnpjEmpresa` | ✅ | ❌ | Possibilidade de venda B2B/pessoa jurídica |
| `participacoesEmpresas` | ✅ (JSON) | ❌ | Societário — revela capacidade financeira |
| `redesSociais` | ✅ (JSON) | ❌ | LinkedIn, Instagram — contexto de abordagem |
| `endereco` | ✅ (residencial) | ❌ | Endereço de correspondência diferente do imóvel |
| `perfilInvestidor` | ✅ (schema) | ❌ | Flag de high-value prospect |
| `anoConstituicao` | ✅ (schema) | ❌ | Idade do imóvel para negociação |

### Dados do Empreendimento nunca cruzados com Contato

O `Contato` tem `campanhaId` → `Campanha` tem `empreendimentoId` → `EmpreendimentoConhecimento` tem `briefingCompleto` e `briefingEstruturado`. Nenhuma dessas informações do empreendimento (nome, tipo, localização, dados estruturais) aparece no card do proprietário no CRM — o operador não sabe qual empreendimento o proprietário tem.

**GAP-07:** O `nomeEdificio` exibido no ProprietarioDetalhes vem do dado de mineração (nome na prefeitura), mas não é cruzado com o `EmpreendimentoConhecimento` para exibir o nome comercial do empreendimento, valor de tabela, tipo de imóvel do empreendimento etc.

---

## Resumo de Gaps por Prioridade

### 🔴 CRÍTICO — Dados coletados que são descartados no pipeline

| Gap | Onde se perde | Dado perdido |
|-----|--------------|--------------|
| GAP-03 | Scraper IPTU | `valorVenal`, `areaConstruida` — reconhecido como "N/D - futuro improvement" |
| GAP-05 | Cache/Contato | `cpfMae`, `escolaridade` — marcados NOVO na interface mas nunca persistidos |

### 🟠 ALTO — Dados no banco que nunca chegam ao operador

| Gap | Onde está | Dado não exibido |
|-----|-----------|-----------------|
| GAP-UI-1 | Contato | `ppe` (compliance), `obitoProvavel` |
| GAP-UI-2 | Contato | `participacoesEmpresas`, `redesSociais` (perfil financeiro e social) |
| GAP-UI-3 | Contato | `setor`, `cnpjEmpresa` (dados profissionais completos) |
| GAP-UI-4 | Contato | `endereco` residencial (diferente do imóvel) |

### 🟡 MÉDIO — Dados disponíveis não cruzados entre contextos

| Gap | Contexto | Oportunidade perdida |
|-----|----------|---------------------|
| GAP-01 | Seleção de edifício | Imovel table tem pavimentos, elevadores, vagas — não exibidos na seleção |
| GAP-02 | EmpreendimentoConhecimento | Dados físicos do Imovel nunca alimentam o briefing da IA |
| GAP-07 | ProprietarioDetalhes | Empreendimento vinculado via campanha nunca é exibido no card do proprietário |
| GAP-06 | Schema Contato | `estadoCivil`, `perfilInvestidor`, `anoConstituicao` no schema mas nunca preenchidos |

### 🟢 BAIXO — Melhorias de enriquecimento futuro

| Gap | Dado | Ação |
|-----|------|------|
| GAP-04 | Scraper usa 3 regex em página rica | Adicionar captura de `valorVenal`, `areaConstruida` |
| Histórico profissional | Assertiva retorna array, salva só índice 0 | Salvar histórico completo em JSON |

---

## Mapa Visual do Ciclo

```
PREFEITURA                ASSERTIVA                  BANCO                   TELA
─────────────────────────────────────────────────────────────────────────────────
nome ─────────────────────────────────────────────► nome ──────────────────► ✅
cpf ──────────────────────────────────────────────► cpf ───────────────────► ✅
endereco_correspondencia ─────────────────────────► enderecoImovel ────────► ✅
tipoImovel ───────────────────────────────────────► tipoImovel ────────────► ✅
apartamento/bloco/box/unidade ────────────────────► apartamento... ────────► ✅
valorVenal ──────── NÃO CAPTURADO ─────────────────► (existe no schema) ───► ❌ GAP-03
areaConstruida ──── NÃO CAPTURADO ─────────────────► (existe no schema) ───► ❌ GAP-03
anoConstituicao ─── NÃO CAPTURADO ─────────────────► (existe no schema) ───► ❌

                         telefones[] ─────────────► telefonesJson ─────────► ✅
                         emails[] ────────────────► emailsJson ────────────► ✅
                         score ───────────────────► scoreAssertiva ────────► ✅ (parcial)
                         dataNascimento/idade/sexo► dataNascimento... ─────► ✅
                         signo ───────────────────► signo ─────────────────► ✅
                         situacaoCadastral ───────► situacaoCadastral ─────► ✅
                         nomeMae ─────────────────► nomeMae ───────────────► ✅
                         obitoProvavel ───────────► obitoProvavel ─────────► ❌ NÃO EXIBIDO
                         ppe ─────────────────────► ppe ───────────────────► ❌ NÃO EXIBIDO
                         cpfMae (NOVO) ───────────► ❌ NÃO SALVO ──────────► ❌ GAP-05
                         escolaridade (NOVO) ─────► ❌ NÃO SALVO ──────────► ❌ GAP-05
                         rendaEstimada ───────────► rendaEstimada ─────────► ✅
                         faixaSalarial ───────────► faixaSalarial ─────────► ✅
                         profissao ───────────────► profissao ─────────────► ✅
                         empresaAtual ────────────► empresaAtual ──────────► ✅
                         setor ───────────────────► setor ─────────────────► ❌ NÃO EXIBIDO
                         cnpjEmpresa ─────────────► cnpjEmpresa ───────────► ❌ NÃO EXIBIDO
                         endereco (residencial) ──► endereco ──────────────► ❌ NÃO EXIBIDO
                         participacoesEmpresas ───► participacoesEmpresas ─► ❌ NÃO EXIBIDO
                         redesSociais ────────────► redesSociais ──────────► ❌ NÃO EXIBIDO
                         estadoCivil ─────────────► (campo no schema?) ────► ❌ GAP-06

IMOVEL TABLE             nunca cruzado ────────────► empreendimento ────────► ❌ GAP-02
pavimentos/elevadores/vagas ──────────────────────► UI de seleção ─────────► ❌ GAP-01
```

---

## Próximos Passos Sugeridos

1. **[CRÍTICO - baixo esforço]** Adicionar 2 regex ao scraper para capturar `valorVenal` e `areaConstruida` da página da Prefeitura — já existe o ponto de extensão no código com comentário "N/D - futuro improvement"

2. **[CRÍTICO - baixo esforço]** Incluir `cpfMae` e `escolaridade` no objeto `dadosCache` em `processamento.rotas.ts` (linha 456-478) e adicionar campos ao schema do Contato com migration

3. **[ALTO - baixo esforço]** Exibir `ppe`, `obitoProvavel`, `setor`, `cnpjEmpresa`, `participacoesEmpresas`, `redesSociais` e `endereco` residencial no ProprietarioDetalhes — dados já estão no banco

4. **[MÉDIO - médio esforço]** Enriquecer tela de seleção de edifício com dados do `Imovel` table (pavimentos, elevadores, vagas) — melhora decisão de qual edifício minerar

5. **[MÉDIO - médio esforço]** Cruzar dados do `EmpreendimentoConhecimento` no card do ProprietarioDetalhes — exibir nome comercial, tipo e dados do empreendimento vinculado via campanha

6. **[MÉDIO - alto esforço]** Injetar dados estruturais do `Imovel` (pavimentos, elevadores, vagas, áreas) no `briefingEstruturado` do `EmpreendimentoConhecimento` — o agente IA passa a responder perguntas sobre infraestrutura do condomínio
