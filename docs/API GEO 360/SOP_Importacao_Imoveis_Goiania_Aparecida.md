# SOP — Importação de Imóveis (Geo360 / ICAD) — Goiânia e Aparecida de Goiânia

**Objetivo:** baixar a base imobiliária (inscrição/IPTU, proprietário, endereço, áreas, geolocalização)
de Goiânia e Aparecida de Goiânia a partir do portal público **Geo360/ICAD**, e mantê-la atualizada
num banco local — de forma **legal, idempotente e completa**.

Este documento é **agnóstico de linguagem/stack**. Implemente em Node, Python, Go, etc.

---

## 0. ⚖️ LIMITES LEGAIS E ÉTICOS (leia antes de codar)

1. **Use SOMENTE a interface pública pretendida** (host `cadastro.geo360.com.br`, autenticação
   `Authorization: Bearer`). Ela é o canal de consulta que o portal expõe ao cidadão.
2. **🚫 PROIBIDO usar o gateway PostgREST** (`apis-goiania.geo360.com.br/gateway/rest/...`).
   Esse gateway está **mal configurado** e expõe o banco interno inteiro — incluindo **PII sensível
   de terceiros** (CPF/filiação via SERPRO, cadastros de famílias vulneráveis, saúde, auditoria).
   Coletar dali é **violação da LGPD** e exploração de exposição de dados. Não use, mesmo que "funcione".
3. **LGPD — minimização:** trate apenas **dado imobiliário + nome e CPF do proprietário** (para
   identificação/validação). **Ignore** qualquer dado pessoal sensível. Base legal típica:
   **legítimo interesse** (art. 7º, IX) para prospecção, com **mecanismo de opt-out** e armazenamento
   seguro do CPF.
4. **Respeite o serviço:** limites conservadores de requisições, pausas, retomada. Não martele a API.
5. **Token compartilhado de terceiro:** a autenticação usa um e-mail de leitor da plataforma; se a
   plataforma revogar/rotacionar, a coleta para. Releia o token sempre; não fixe em código.

---

## 1. Arquitetura da API (4 endpoints)

Base de cadastro: `https://cadastro.geo360.com.br`
`{cidade}` = `goiania` ou `aparecidadegoiania`.

### 1.1 AUTH — obter token
```
GET https://plataforma.geo360.com.br/ouv/?q={email_leitor}
Header: no-token: true
→ { "authToken": "<UUID v4, validade ~1h>", "tnToken": "<base64 do tenant>" }
```
- E-mail observado que funciona p/ ambas as cidades: `leitor_aparecidadegoiania@vm2info.com`.
- **Renove o token a cada ~50 min** durante cargas longas.
- Em **todas** as chamadas seguintes envie `Authorization: Bearer {authToken}`.

### 1.2 SETOR — lista de setores cadastrais (semente do crawl)
```
GET https://cadastro.geo360.com.br/{cidade}/setor/      ← ATENÇÃO: BARRA FINAL obrigatória
Header: Authorization: Bearer {authToken}
→ [ { id, setor|codigo, nome, geom, id_distrito, ... }, ... ]
```
- **Sem a barra final responde 301** e parece vazio (foi o que enganou implementações antigas).
- Goiânia retorna ~228 setores (códigos de 3 dígitos: "101", "127", "324"...).

### 1.3 BAIRRO — dicionário de bairros (referência + polígonos)
```
GET https://cadastro.geo360.com.br/{cidade}/bairro/     ← BARRA FINAL
Header: Authorization: Bearer {authToken}
→ [ { id, codigo, nome, nome_formatado, codigo_zona, area_terreno, area_urbanizavel, geom }, ... ]
```
- Goiânia retorna ~1.221 bairros. Útil p/ resolver `id_bairro`→nome e p/ mapa de cobertura.

### 1.4 SEARCH (Fase 1) — descobrir imóveis por prefixo de inscrição
```
GET https://cadastro.geo360.com.br/search/{cidade}/imobiliario?inscricao_cartografica={prefixo}
Header: Authorization: Bearer {authToken}
→ [ { inscricao_cartografica, id_lote, id_imobiliario, geom (WKT POLYGON) }, ... ]
```
- A inscrição cartográfica (IPTU) é **hierárquica** (setor→quadra→lote→unidade) e o endpoint faz
  **match por PREFIXO**.
- **Não há paginação nem CPF aqui.** Do `geom` extraia o **centróide → lat/lng**.
- **Não trunca:** verificado que `pai == soma dos filhos` (ex.: `'32'`=49.136 == Σ`'320'..'329'`).
- Prefixo de **1 dígito é amplo demais** (timeout/erro). Use **2–3 dígitos**.

### 1.5 DETALHE (Fase 2) — ficha completa por imóvel
```
GET https://cadastro.geo360.com.br/{cidade}/lote/busca_imoveis_all/{id_imobiliario}/
Header: Authorization: Bearer {authToken}
→ objeto único com todos os campos (ver §3)
```
- Chave de entrada = `id_imobiliario` (vindo do Search). 1 chamada por imóvel.

> **Acesso por IPTU específico:** Search com a inscrição **completa** retorna 1 resultado →
> pega `id_imobiliario` → Detalhe. (IPTU → id → ficha.)

---

## 2. Fluxo de extração (cascata)

```
1. AUTH → token
2. SETOR/  → semente de prefixos (ou use "00".."99")
3. Para cada prefixo  → SEARCH  → salva {inscricao, id_imobiliario, lat, lng}   (Fase 1)
4. Para cada id_imobiliario salvo → DETALHE → enriquece {cpf, nome, bairro, área...} (Fase 2)
5. BAIRRO/ → dicionário (1x)
```
Separe **Fase 1 (descoberta)** de **Fase 2 (enriquecimento)** — assim a Fase 2 é retomável e
incremental (só processa o que falta).

---

## 3. Mapa de campos do DETALHE → seu banco

| Campo na API (`busca_imoveis_all`) | Destino | Observação |
|---|---|---|
| `inscricao_cartografica___imobiliario` | **inscricao (IPTU)** | **CHAVE ÚNICA** (14 dígitos em Goiânia; 17 em Aparecida) |
| `cpf_cnpj` | cpf_cnpj | 11 díg = CPF, 14 = CNPJ |
| `nome___pessoa` | nome | proprietário |
| `tipo___pessoa` | tipo_pessoa | 1=física, 2=jurídica |
| `nome___bairro` | bairro | **sempre presente** (use ESTE, não "nome_bairro") |
| `endereco_completo` | endereco | "blob" de texto |
| `nome___logradouro` | logradouro | logradouro limpo |
| `complemento` | complemento | "APT301 BL-1" |
| `area_construida_privativa___imobiliario` | area_construida | **vem como STRING** → `parseFloat` |
| `area_terreno_privativa` | area_terreno | float |
| `tipo_edificacao` | tipo_edificacao | int |
| `nr_lote`, `id_bairro`, `id_quadra`, `id_setor` | ids internos | úteis p/ dedup/território |
| `cep_inicial` | cep | **quase sempre null** — a API não entrega CEP aqui |
| `numero_cadastro___imobiliario` | numero_cadastro | **quase sempre null** |

**Guarde também o JSON cru** (`raw`) numa coluna JSONB — assim, se quiser um campo novo amanhã,
reprocessa do salvo sem re-raspar.

---

## 4. Modelo de dados sugerido (genérico)

```
imoveis (
  inscricao        VARCHAR PRIMARY KEY,   -- IPTU, chave única
  cidade           VARCHAR,
  cpf_cnpj, nome_pessoa, tipo_pessoa,
  endereco, logradouro, complemento, bairro, cep,
  area_construida DOUBLE, area_terreno DOUBLE, tipo_edificacao INT,
  nr_lote, id_bairro, id_quadra, id_setor,
  latitude DOUBLE, longitude DOUBLE,
  raw JSONB,
  versao_enriquecimento INT DEFAULT 0,    -- controle de reprocessamento (ver §6)
  detalhe_em TIMESTAMP,
  atualizado_em TIMESTAMP
)
bairros ( cidade, id_bairro, codigo, nome, nome_formatado, geom, ... )  -- chave (cidade, id_bairro)
```
- **Chave = inscrição (IPTU)**, pois é única por imóvel e não se repete.
- Índices úteis: `cpf_cnpj`, `bairro`, `(cidade, versao_enriquecimento)`.

---

## 5. Algoritmo de descoberta (cold-start, sem nenhum dado)

A inscrição é hierárquica e o Search casa por prefixo → faça **varredura em árvore de prefixos**,
**auto-verificável**:

```
fila = setores do /setor/   (ou "00".."99")
enquanto fila não vazia:
    p = fila.pop()
    try:
        imoveis = SEARCH(prefixo=p)
        se vazio: descarta (galho morto)
        senão: salva (Fase 1); guarda contagem[p]
    catch (timeout / "amplo demais"):
        se len(p) < PROF_MAX (ex. 8): empurra p+"0".."9" na fila   # desce 1 nível
        senão: registra LACUNA (cobertura incompleta!)
```
**Invariante de completude:** quando descer um pai que respondeu, `contagem[pai] == Σ contagem[filhos]`.
Discrepância = a API truncou → erro logado (não confie cegamente). Persiste o status de cada prefixo
(`PENDENTE/FEITO/LACUNA`) numa tabela de progresso para **retomar** sem reprocessar.

> Por que não confiar só na lista de setores: implementações antigas perderam setores inteiros
> (ex.: ~9 mil imóveis em 4 setores) por confiar numa lista manual incompleta. A árvore + invariante
> garante e prova a cobertura.

---

## 6. Idempotência, versão e reprocessamento

- Dê um **número de versão de esquema** (`versao_enriquecimento`). Defina `VERSAO_ATUAL` (ex.: 2).
- A Fase 2 processa **`where versao_enriquecimento < VERSAO_ATUAL`** (não "where cpf is null").
  Assim, quando você melhorar o parser/adicionar campo, **basta subir a versão** e o reprocessamento
  pega todo mundo. (Erro clássico: filtrar por "sem CPF" → registros que já tinham CPF nunca recebem
  os campos novos.)
- Ao gravar com sucesso, marque `versao_enriquecimento = VERSAO_ATUAL`.
- Falha de **rede/5xx/429** → **não marque** a versão (reentra depois). Falha **4xx definitiva** (lote
  sem ficha) → marque como processado p/ não revisitar eternamente.
- `UPSERT` por inscrição (idempotente). Rodar 2x não duplica.
- Ao promover um setor, selecione os imóveis pelos `id_imobiliario` retornados pelo Search. Não use
  `inscricao LIKE 'setor%'`: em Aparecida, o código do setor não ocupa o início da inscrição.

---

## 7. Robustez, rate limiting e retomada

- **Concorrência:** Search com **1 em paralelo** (respostas grandes); Detalhe com **~10–15** em
  paralelo. Pausas curtas entre lotes (ex.: 80–300 ms).
- **Token:** renove a cada ~50 min; em **401**, re-autentique e tente de novo.
- **Retentativas:** backoff exponencial em timeout/5xx/429; sem retry em 4xx definitivo.
- **Volume aproximado:** Goiânia ~**828 mil** imóveis, Aparecida ~**285 mil** → ~**1,1 milhão** de
  chamadas de Detalhe. Faça em **janelas** (ex.: cron noturno, N por noite) — não tudo de uma vez.
- **Checkpoint:** salve progresso (Fase 1 por prefixo; Fase 2 pela versão) para sobreviver a quedas.

---

## 8. Variações entre municípios (Goiânia × Aparecida)

A estrutura é a mesma, mas **valide o retorno de cada cidade** — há diferenças:
- **Sufixos de campo:** Goiânia usa `area_construida_privativa___imobiliario`; Aparecida pode usar
  `area_construida_privativa` (sem `___imobiliario`). Faça o parser tolerar ambos (`campo ?? variante`).
- **Geometria:** o `geom` pode vir como **WKT** (`POLYGON((...))`) numa cidade e **WKB hexadecimal**
  noutra — detecte o formato antes de extrair o centróide.
- **Setores:** a lista e a faixa de prefixos diferem por cidade — rode a descoberta por cidade.
- **Inscrição:** Goiânia usa 14 dígitos; Aparecida de Goiânia usa 17 dígitos. Preserve zeros à esquerda.
- O **e-mail/token** observado serve para as duas, mas confirme o tenant retornado.

---

## 9. Pseudocódigo de referência

```pseudo
token = AUTH(email)                       # §1.1, renovar a cada ~50min

# ---- Fase 1: descoberta ----
fila = SETOR(cidade) or ["00".."99"]
while fila:
    p = fila.pop()
    try:
        for im in SEARCH(cidade, p):      # §1.4
            (lat,lng) = centroide(im.geom) # WKT/WKB
            UPSERT imoveis (inscricao=im.inscricao_cartografica, cidade,
                            id_imobiliario=im.id_imobiliario, lat, lng)  # versao=0
    except too_broad_or_timeout:
        if len(p) < 8: fila += [p+d for d in "0".."9"]
        else: log LACUNA(p)
    sleep(300ms)

# ---- Fase 2: enriquecimento (incremental/idempotente) ----
for row in SELECT inscricao,id_imobiliario FROM imoveis
           WHERE cidade=cidade AND versao_enriquecimento < VERSAO_ATUAL:
    d = DETALHE(cidade, row.id_imobiliario)       # §1.5
    if d:
        UPDATE imoveis SET cpf_cnpj=d.cpf_cnpj, nome_pessoa=d.nome___pessoa,
            bairro=d.nome___bairro, logradouro=d.nome___logradouro,
            complemento=d.complemento, area_construida=parseFloat(d.area_construida_privativa___imobiliario),
            area_terreno=d.area_terreno_privativa, tipo_edificacao=d.tipo_edificacao,
            cep=formatCep(d.cep_inicial), raw=d, versao_enriquecimento=VERSAO_ATUAL,
            detalhe_em=now()
        WHERE inscricao=row.inscricao
    else:  # 200 vazio / 4xx → sem ficha, marca processado
        UPDATE imoveis SET versao_enriquecimento=VERSAO_ATUAL WHERE inscricao=row.inscricao

# ---- Dicionário de bairros (1x) ----
for b in BAIRRO(cidade): UPSERT bairros(cidade, id_bairro=b.id, nome=b.nome, ...)
```

---

## 10. Verificação (como saber que deu certo)

- **Cold-start num setor pequeno:** rode num prefixo de 2 díg pequeno; confira `folhas somam o pai`
  e `total == count no banco`.
- **Invariante de regressão (Goiânia):** `'32'`→**49.136**, `'324'`→**6.002**.
- **Completude:** zero LACUNAS no log; total Goiânia ~**828 mil**, Aparecida ~**285 mil**.
- **Enriquecimento:** `count(bairro is null)` deve cair a ~0; `versao_enriquecimento < VERSAO_ATUAL`
  converge a 0; `cep`/`numero_cadastro` ficam nulos (esperado).
- **Idempotência:** rodar a Fase 2 duas vezes → a 2ª processa 0.

---

## 11. Checklist de implementação

- [ ] Cliente HTTP com header `Bearer` + renovação de token (~50 min) + retry/backoff.
- [ ] Tabela `imoveis` (PK = inscrição) + `bairros` + tabela de progresso de prefixos.
- [ ] Fase 1: varredura de prefixos com descida adaptativa + invariante de completude.
- [ ] Fase 2: enriquecimento por `versao_enriquecimento < VERSAO_ATUAL` (idempotente, UPSERT).
- [ ] Parser tolerante a variações Goiânia/Aparecida (sufixos de campo, WKT/WKB).
- [ ] Guardar `raw` (JSONB) para reprocesso futuro.
- [ ] Janela/cron para não sobrecarregar (1,1M chamadas no total).
- [ ] **Isolar URL/credencial do fornecedor num único arquivo de config.**
- [ ] **NUNCA** chamar o gateway PostgREST; **LGPD**: só imóvel + nome/CPF, com opt-out.

---

_Gerado a partir de engenharia reversa da interface pública do Portal Geo360/ICAD (Goiânia e
Aparecida de Goiânia). Use de forma responsável e em conformidade com a LGPD._
