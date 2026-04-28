# Solicitação de Implementação — Divisão de Responsabilidades: Comunicação vs Dados (Proprietários)

## Contexto e Motivação

Atualmente as páginas de proprietários misturam dois domínios distintos na mesma tela:

- **Comunicação** (chat, modo de atendimento, ações rápidas)
- **Dados e pipeline** (qualificação SPIN, negociação, contrato, histórico, imóvel)

Isso gera sobrecarga cognitiva para o usuário operacional, que precisa se comunicar com o proprietário e ao mesmo tempo visualizar dados cadastrais pesados na mesma interface.

A decisão de design aprovada é separar esses dois domínios em páginas distintas com responsabilidades claras.

---

## Objetivo

Dividir as páginas de proprietários em:

| Página | Foco | Público |
|---|---|---|
| `/dashboard/proprietarios` | **Comunicação** — chat, modo de atendimento, ações rápidas | Atendente em fluxo operacional |
| `/dashboard/proprietarios/:id` | **Dados e pipeline** — cadastro, qualificação, negociação, contrato, histórico | Revisão aprofundada do lead |

---

## Arquivos Afetados

- `pacotes/frontend/src/componentes/leads/PreviewLead.tsx`
- `pacotes/frontend/src/paginas/ProprietarioDetalhes/index.tsx`

---

## Mudança 1 — `PreviewLead.tsx`: Padrão para aba de Chat

### O que fazer

No componente `PreviewLead`, alterar o estado inicial da aba ativa de `'resumo'` para `'chat'`:

```tsx
// Antes
const [aba, setAba] = useState<AbaPreview>('resumo');

// Depois
const [aba, setAba] = useState<AbaPreview>('chat');
```

### Por quê

O painel direito do Mission Control (`/dashboard/proprietarios`) é a interface de comunicação do usuário. Ao clicar em um lead, ele deve cair direto no chat — não em dados de SPIN ou Cockpit Operacional.

As outras abas (IA, Contato, Imóvel, Timeline, Docs) continuam disponíveis para consulta rápida, mas comunicação é a prioridade.

### Critério de pronto

- [ ] Ao selecionar qualquer lead no feed, o painel direito abre diretamente na aba **Chat**
- [ ] As demais abas continuam funcionando normalmente
- [ ] Nenhuma regressão no `ChatPanel`

---

## Mudança 2 — `ProprietarioDetalhes/index.tsx`: Remover sidebar de conversa

### O que fazer

Remover o bloco da sidebar de conversa do layout da página de detalhe. A estrutura atual é:

```tsx
<main>
  <div className="flex gap-6">
    <div className="flex-1 min-w-0">
      {/* tabs de dados — MANTÉM */}
    </div>

    <div className="w-[400px] flex-shrink-0">
      {/* sidebar de conversa — REMOVER ESTE BLOCO INTEIRO */}
    </div>
  </div>
</main>
```

Após a remoção, o layout deve ser full-width:

```tsx
<main>
  <div className="max-w-[1600px] mx-auto px-6 py-6">
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* tabs de dados — full width */}
    </div>
  </div>
</main>
```

### Estados e funções a remover (junto com o bloco da sidebar)

| Item | Tipo | Motivo |
|---|---|---|
| `mensagensRef` | `useRef` | Só usado para scroll da sidebar |
| `novaMensagem` | `useState` | Input de mensagem da sidebar |
| `enviando` | `useState` | Loading do envio da sidebar |
| `mensagensOrdenadas` | `useMemo` | Lista de mensagens da sidebar |
| `enviarMensagem` | função | Handler de envio da sidebar |

### Imports a remover (se não usados em outro lugar no arquivo)

- `useRef` (de `react`)
- `Textarea` (de `../../componentes/ui/textarea`)
- `Send` (de `lucide-react`)

> **Atenção:** Verificar antes de remover `MessageSquare` — está em uso nos botões "WhatsApp" e "Chat do Lead" no header.

### O que NÃO remover

- O botão **"Chat do Lead"** no header (abre o `ChatModal` em tela cheia) — continua disponível para quem precisar conversar a partir da página de detalhe
- O componente `ChatModal` e seu `Suspense` wrapper
- O estado `chatOpen` e `setChatOpen`
- A função `tempoRelativo` — verificar se é usada em alguma das abas antes de remover

### Por quê

A conversa com o proprietário pertence ao fluxo operacional rápido do Mission Control. A página `/dashboard/proprietarios/:id` é acessada quando o usuário precisa revisar dados, qualificação, negociação e histórico — não para se comunicar. Remover a sidebar elimina a ambiguidade e foca a página em seu domínio.

### Critério de pronto

- [ ] A página `/dashboard/proprietarios/:id` exibe apenas header + 7 abas (Atendimento, Proprietário, Imóvel, Qualificação, Negociação, Contrato, Atividades) em layout full-width
- [ ] Nenhuma das 7 abas apresenta regressão de dados
- [ ] O botão "Chat do Lead" no header ainda abre o `ChatModal` corretamente
- [ ] Nenhum erro de TypeScript ou referência a estados removidos
- [ ] Build sem erros (`npm run build` ou equivalente)

---

## Ordem de implementação sugerida

1. Mudança 2 (remover sidebar) — maior impacto, zero risco de regressão no chat
2. Mudança 1 (tab padrão) — mudança de 1 linha, testar visualmente

---

## Testes de regressão mínimos

- [ ] Abrir Mission Control → selecionar lead → painel abre no Chat
- [ ] Enviar mensagem pelo ChatPanel no Mission Control funciona
- [ ] Navegar para `/dashboard/proprietarios/:id` → página full-width sem sidebar
- [ ] Clicar em "Chat do Lead" no header da página de detalhe → ChatModal abre corretamente
- [ ] Todas as 7 abas de dados carregam sem erro
- [ ] Modo de atendimento (IA/Humano/Pausado) na aba Atendimento funciona

---

## Referência visual

| Antes | Depois |
|---|---|
| Mission Control: painel direito abre em dados IA | Mission Control: painel direito abre direto no Chat |
| Detalhe: dados + sidebar de conversa lado a lado | Detalhe: apenas dados em full-width |
