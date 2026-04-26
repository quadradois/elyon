# 📋 Relatório de Pendências — Elyon Platform
> **Gerado em:** 24/04/2026  
> **Versão analisada:** 0.2.2  
> **Escopo:** `pacotes/backend` + `pacotes/frontend`

---

## Resumo Executivo

| Categoria | Qtd | Impacto |
|---|---|---|
| 🔴 TODOs críticos (Asaas / Auth) | 6 | Alto |
| 🟠 Dados mockados em produção | 3 | Alto |
| 🟡 Features incompletas | 5 | Médio |
| 🔵 Dívida técnica | 4 | Baixo |

---

## 🔴 TODOs Críticos

### 1. Integração Asaas — Billing incompleto

Os endpoints de cobrança existem, criam transações no banco, mas **não geram o link de pagamento real**. O usuário recebe uma simulação.

- `pacotes/backend/src/rotas/rotas-billing.ts:198` — `POST /assinatura/assinar`: link de pagamento Asaas não implementado  
- `pacotes/backend/src/rotas/rotas-billing.ts:1270` — `POST /admin/billing/ajuste-manual`: idem  
- `pacotes/frontend/src/paginas/Upgrade.tsx:185` — Botão de upgrade simula `setTimeout` em vez de chamar a API  
- `pacotes/frontend/src/componentes/ModalPagamentoPIX.tsx:54` — Modal PIX não faz polling para confirmar o pagamento

```typescript
// rotas-billing.ts:198 — situação atual
// TODO: Integrar com Asaas para gerar link de pagamento
// linkPagamento: asaasLink, // TODO
```

---

### 2. WebSocket sem autenticação real

O serviço de WebSocket aceita conexões sem validar o JWT e usa dados hardcoded para identificar o usuário conectado.

- `pacotes/backend/src/servicos/websocket.ts:44` — JWT não é validado no handshake  
- `pacotes/backend/src/servicos/websocket.ts:57` — `usuarioId` hardcoded como `'temp'`  
- `pacotes/backend/src/servicos/websocket.ts:58` — `nome` hardcoded como `'Usuário'`  

```typescript
// websocket.ts — situação atual
usuarioId: 'temp', // TODO: extrair do token
nome: 'Usuário',  // TODO: buscar do banco
```

---

### 3. Cancelamento de assinatura no Asaas ausente

Ao cancelar um tenant/cliente, a assinatura no Asaas não é encerrada — apenas o registro no banco é alterado.

- `pacotes/backend/src/servicos/servico-gestao-clientes.ts:282`

---

### 4. Notificação WebSocket de alertas SDR não implementada

Quando um alerta crítico é criado pelo SDR, o sistema deveria emitir um evento em tempo real. Isso não ocorre.

- `pacotes/backend/src/servicos/metricas-sdr.ts:110`

---

### 5. Listagem de múltiplos agentes no Frontend

A página `MeusAgentes` espera uma lista de agentes mas o backend retorna apenas um objeto `{ agente: ... }`. Está com tratamento provisório.

- `pacotes/frontend/src/paginas/MeusAgentes.tsx:56`

```typescript
// MeusAgentes.tsx — comentário no código
// TODO: Backend needs to support listing multiple agents.
// Currently GET /api/agentes returns { agente: ... } (single).
```

---

### 6. Código legado em `leads.ts`

Trecho marcado para remoção após rebuild completo — ainda presente.

- `pacotes/backend/src/rotas/leads.ts:11`

---

## 🟠 Dados Mockados em Produção

### 7. Endpoint `/api/metricas-agentes/workers` retorna dados falsos

O endpoint de performance dos workers retorna valores **hardcoded** (45 conversas, 94% taxa de sucesso, etc.) que não refletem nenhum dado real.

- `pacotes/backend/src/rotas/metricas-agentes.ts:200`

```typescript
// Situação atual — dados inventados
workers: [
  { nome: 'SDR Worker', conversasHoje: 45, taxaSucesso: '94%', ... },
  { nome: 'Documentos Worker', conversasHoje: 12, taxaSucesso: '98%', ... }
]
```

---

### 8. MapaService com fallback para mock

Quando a API de mapas de Goiânia fica indisponível (sem cache), o sistema retorna uma lista de imóveis falsa ao invés de retornar erro.

- `pacotes/backend/src/servicos/mapa.ts:538, 1396, 1481, 1546`

---

### 9. Extração de documentos DOCX não implementada

Ao indexar documentos Word no RAG, o sistema retorna um placeholder de texto. O agente Knowledge não consegue ler arquivos `.docx`.

- `pacotes/backend/src/rotas/documentos.ts:161`

```typescript
// Situação atual
return `[Documento Word - extração de texto em desenvolvimento. Arquivo: ${nomeArquivo}]`;
```

---

## 🟡 Features Incompletas / "Em Breve"

### 10. Rota `/dashboard/*` sem implementação

Qualquer rota de dashboard não mapeada explicitamente renderiza "Página em construção".

- `pacotes/frontend/src/App.tsx:393`

---

### 11. Configurações "Em Breve"

Três cards na página de Configurações apontam para funcionalidades não desenvolvidas:

- **Notificações** — Preferências de alertas
- **Aparência** — Tema / dark mode / cores
- **Segurança** — Troca de senha, 2FA, permissões

---

## 🔵 Dívida Técnica

### 12. Supressões `@ts-ignore` no código de produção

Erros de TypeScript sendo silenciados em vez de corrigidos:

- `pacotes/backend/src/rotas/whatsapp.ts:123` e `:125` — 2 supressões consecutivas  
- `pacotes/backend/src/rotas/documentos.ts:16` — Tipo do Prisma não reconhecido

---

### 13. `tsconfig.json` com opções deprecadas

As opções `moduleResolution: "node"` e `baseUrl` estão deprecadas e deixarão de funcionar no TypeScript 7.0.

- `pacotes/backend/tsconfig.json:16` — `moduleResolution: node` → migrar para `bundler` ou `node16`  
- `pacotes/backend/tsconfig.json:25` — `baseUrl` → usar `paths` relativo

---

### 14. 448 `console.log` nas rotas do backend

O backend não possui um logger estruturado (ex: `pino`, `winston`). Logs de debug misturados com logs de produção dificultam monitoramento e auditoria.

- Escopo: todos os arquivos em `pacotes/backend/src/rotas/`

---

### 15. Método `mockEnriquecimento` mantido no Assertiva service

Código de mock comentado ainda presente no serviço de produção da Assertiva — risco de ser reativado acidentalmente.

- `pacotes/backend/src/servicos/assertiva.ts:444`

---

## ✅ Checklist de Aprovação

> Marque cada item após revisão e decisão da equipe.

### 🔴 Críticos — Bloqueia funcionalidade paga

- [ ] **#1** — Implementar integração Asaas em `rotas-billing.ts` (geração de link real de pagamento)
- [ ] **#1** — Implementar polling de confirmação PIX no `ModalPagamentoPIX.tsx`
- [ ] **#1** — Conectar botão de Upgrade à API real em `Upgrade.tsx`
- [ ] **#2** — Implementar validação JWT no WebSocket e remover `usuarioId: 'temp'`
- [ ] **#3** — Implementar cancelamento de assinatura no Asaas ao desativar tenant
- [ ] **#4** — Emitir evento WebSocket ao criar alertas SDR críticos
- [ ] **#5** — Atualizar endpoint `GET /api/agentes` para retornar lista (`agentes: [...]`)
- [ ] **#6** — Remover código legado marcado em `leads.ts:11`

### 🟠 Importante — Dados falsos expostos

- [ ] **#7** — Substituir dados mockados do endpoint `/workers` por dados reais de logs
- [ ] **#8** — Avaliar estratégia do fallback mock no `MapaService` (erro explícito vs mock silencioso)
- [ ] **#9** — Implementar extração de DOCX com `mammoth.js` para RAG funcionar com Word

### 🟡 Melhorias — UX e produto

- [ ] **#10** — Mapear e implementar (ou remover) rota `/dashboard/*` em construção
- [ ] **#11** — Definir prazo/prioridade para: Notificações, Aparência e Segurança
- [ ] **#15** — Remover método `mockEnriquecimento` do `assertiva.ts` (ou mover para pasta de testes)

### 🔵 Dívida Técnica — Saúde do código

- [ ] **#12** — Corrigir os 3 `@ts-ignore` com tipagem adequada
- [ ] **#13** — Atualizar `tsconfig.json`: migrar `moduleResolution` e remover `baseUrl` deprecados
- [ ] **#14** — Introduzir logger estruturado (ex: `pino`) e substituir `console.log` nas rotas

---

## Notas

- Os **361 testes automatizados** continuam cobrindo bem a camada de agentes (~92.5%). As pendências acima são concentradas na camada de **infraestrutura de billing**, **WebSocket** e **features de produto** — áreas sem cobertura de testes atualmente.
- Os itens 🔴 críticos impactam diretamente a **geração de receita** (Asaas) e a **segurança** (WebSocket sem auth) — devem ser priorizados antes do próximo onboarding de cliente.
