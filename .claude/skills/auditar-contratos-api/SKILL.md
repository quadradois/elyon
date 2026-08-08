---
name: auditar-contratos-api
description: Use quando um campo preenchido na tela do Elyon não aparece salvo, quando o briefing do empreendimento chega vazio ou incompleto para o agente SDR, ao revisar uma rota nova antes do merge, ou quando alguém pedir para auditar contrato/integração entre backend e frontend, campos órfãos, payload ignorado ou rota 404 silenciosa.
---

# Auditar contratos backend ↔ frontend

O Elyon não tem OpenAPI nem tipos compartilhados: `pacotes/compartilhado/` só tem README. O
contrato entre as camadas existe apenas como convenção, então ele se desfaz em silêncio — o
frontend manda `PATCH`, o Express não tem a rota, o axios engole o 404 no `catch`, e o usuário
vê um toast de sucesso.

**Princípio:** um campo só está integrado quando você consegue apontar as quatro pontas —
onde a UI coleta, onde a rota aceita, onde o Prisma grava, e quem lê depois. Faltando uma, o
campo é decorativo.

## Quando usar

- Usuário relata "preenchi e não salvou" / "o dado sumiu"
- Briefing do empreendimento sai incompleto para o agente SDR ou para o RAG
- Antes de mergear rota nova, campo novo em formulário, ou mudança de schema Zod
- Auditoria periódica da superfície de API

Não use para bug de lógica dentro de um handler que já está integrado — aí é debugging normal.

## Passo 1 — Inventário mecânico

```bash
node .claude/skills/auditar-contratos-api/extrair-contratos.mjs . 
node .claude/skills/auditar-contratos-api/extrair-contratos.mjs . --filtro campanhas
node .claude/skills/auditar-contratos-api/extrair-contratos.mjs . --orfas --json
```

Sai com código 1 quando há achado nas seções 1 ou 2 — serve em CI, mas quebra encadeamento com
`&&` no shell.

Ele cruza `app.use('/api/...')` + `router.<método>()` (seguindo `router.use()` aninhado) contra
todo `api.get/post/put/patch/delete` do frontend, e devolve quatro seções:

| Seção | O que é | Gravidade |
|---|---|---|
| 1. Rota fantasma | frontend chama, backend não expõe → **404 em runtime** | alta, sempre real |
| 2. Campo ignorado | vai no payload, não está no Zod/destructuring → **Zod descarta e responde 200** | alta, sempre real |
| 3. Casada por segmento variável | caminho tem `${var}` onde o backend declara literal | ruído, confira à mão |
| 4. Rota sem consumidor | backend expõe, nenhum `api.*` chama | informativo |

Seções 1 e 2 saem sem falso positivo conhecido. Seção 3 é quase sempre benigna
(`` `/agentes/${id}/${endpoint}` `` com `endpoint ∈ {ativar, pausar}`). Seção 4 inclui webhooks,
cron e uso interno — **nunca remova rota só porque apareceu ali**.

## Passo 2 — Rastreio de campo (o que o script não alcança)

O script para no nível da rota. Perda de campo *depois* da rota é manual. Para cada campo em
disputa, preencha as quatro pontas e pare na primeira que faltar:

| Ponta | Onde olhar | Falha típica |
|---|---|---|
| Coleta | `useState` / `<Input value=…>` do componente | campo só existe no state, nunca entra no payload |
| Aceita | schema Zod ou `const { … } = req.body` | Zod strip silencioso |
| Grava | `prisma.<modelo>.update/create` + `schema.prisma` | campo montado e nunca passado ao Prisma |
| Lê | agente, RAG, export, outra tela | grava e ninguém consome — campo morto |

Recipe por campo:

```bash
grep -rn "nomeDoCampo" pacotes/frontend/src pacotes/backend/src --include=*.ts --include=*.tsx
grep -n "nomeDoCampo" pacotes/backend/prisma/schema.prisma
```

Menos de quatro ocorrências distintas quase sempre significa ponta faltando.

## Passo 3 — Camada de transformação

Onde o Elyon mais perde campo não é na rota, é no conversor entre formatos. Sempre que existir
uma função `converterPara…` / `mesclar…` / `mapear…`, faça o diff explícito **tipo de entrada
× objeto de saída**, chave por chave. Uma chave presente na interface de entrada e ausente no
`return` é um campo perdido, e o TypeScript não reclama porque o retorno é `Record<string, any>`.

Caso de referência — `converterParaBriefingEstruturado` em `pacotes/backend/src/servicos/manus.ts:324`
recebe `BriefingEmpreendimentoJSON` e devolve `Record<string, any>`. O prompt em
`gerarPromptPesquisaEmpreendimento` pede à IA Manus `construtora`, `fase_obra` e
`previsao_entrega`; o conversor não os repassa. Eles sobrevivem só no texto de
`gerarResumoTextual`, então `knowledge-agent.ts` — que lê `briefingEstruturado` — nunca os vê.

## Passo 4 — Relatório

Uma linha por achado, nesta forma, ordenado por gravidade:

```
CLASSE | METODO /caminho ou campo | arquivo:linha (envia) → arquivo:linha (aceita) | efeito para o usuário
```

Sempre inclua o efeito em linguagem de negócio ("o corretor salva o briefing manual e a
campanha continua sem briefing"), não só o sintoma técnico. E marque explicitamente o que você
não conseguiu verificar — rota que depende de runtime, campo consumido por serviço externo.

## Erros comuns

| Erro | Correção |
|---|---|
| Tratar seção 4 como lista de remoção | webhooks e cron não têm `api.*`; confirme consumidor antes |
| Confiar no `catch` do frontend | `toast.error` genérico mascara 404 de rota inexistente; confira a rota, não o log |
| Aceitar o primeiro `z.object` do handler | schemas aninhados e `const schema` repetido entre handlers enganam; siga quem recebe `.parse(req.body)` |
| Parar quando o Prisma grava | gravar não é integrar; ache o leitor |
| Auditar só o que mudou no diff | drift entra por remoção no backend, sem tocar no frontend |

## Limites do script

Regex sobre TypeScript, não AST. Não enxerga: caminho montado em variável antes da chamada
(`` const url = `/x/${id}`; api.get(url) ``), `fetch()` direto, `axios` fora de
`pacotes/frontend/src/servicos/api.ts`, middleware que injeta campo no `req.body`, e campos
aninhados no payload (compara só o primeiro nível). Rota nova em pacote fora de
`pacotes/backend/src` fica invisível. Quando o script diz "nenhuma", isso significa "nenhuma
nas formas que ele lê" — o Passo 2 continua obrigatório para o campo que motivou a auditoria.
