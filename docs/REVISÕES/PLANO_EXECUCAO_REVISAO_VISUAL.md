# Plano de Execução — Revisão Visual ELYON
### Baseado em: RELATORIO_REVISAO_VISUAL_ELYON.md
> Stack: React · TypeScript · TailwindCSS · Lucide React  
> Raiz frontend: `pacotes/frontend/src/`

---

## Visão Geral

**Objetivo:** Transformar o ELYON de "sistema funcional" em "copiloto premium" consolidando o sistema de design que já existe no codebase mas não está sendo usado.

**Princípio-guia:** Nenhuma feature nova. Zero dependências externas novas. O trabalho é de conexão e consistência — não de criação do zero.

**Duração estimada:** 4–5 semanas de trabalho focado  
**Risco geral:** Baixo (sem breaking changes de API ou lógica de negócio)

---

## Estrutura de Fases

```
Fase 1 — Fundação          (Semana 1) — invisível ao usuário
Fase 2 — Consistência      (Semana 2) — "ficou melhor" sem saber o que mudou
Fase 3 — Dashboard         (Semana 3) — usuário percebe organização
Fase 4 — Mobile            (Semana 4) — necessário antes de crescer mobile
Fase 5 — Polimento Premium (contínuo) — diferenciais competitivos
```

---

## Fase 1 — Fundação

> **Meta:** Sem mudança visual para o usuário. Corrigir a raiz técnica dos problemas de inconsistência.

### Tarefa 1.1 — Corrigir token `--primary`
**Arquivo:** `src/index.css`  
**Esforço:** 5 min  
**Impacto:** Elimina ~40 sobrescritas manuais de `bg-blue-600` em cascata

**O problema:**
```css
/* ATUAL — quase-preto */
--primary: 222.2 47.4% 11.2%;

/* DEVE SER — blue-600 */
--primary: 217.2 91.2% 59.8%;
--primary-foreground: 0 0% 100%;
```

**Atenção pós-mudança:** Revisar todos os usos de `text-primary` e `bg-primary` que possam ter sido escritos assumindo contraste invertido (texto claro sobre fundo escuro). Verificar especificamente:
- `componentes/ui/button.tsx` — variant default
- `layouts/LayoutDashboard.tsx` — item ativo da sidebar
- `componentes/ui/badge.tsx` — variant default

---

### Tarefa 1.2 — Eliminar `gray-*`, unificar em `slate-*`
**Arquivos afetados:** 116 ocorrências em 20+ arquivos  
**Esforço:** ~1h com busca global  
**Impacto:** Coerência visual imediata em todas as páginas

**Mapeamento direto:**
| De | Para |
|---|---|
| `gray-50` | `slate-50` |
| `gray-100` | `slate-100` |
| `gray-200` | `slate-200` |
| `gray-300` | `slate-300` |
| `gray-400` | `slate-400` |
| `gray-500` | `slate-500` |
| `gray-600` | `slate-600` |
| `gray-700` | `slate-700` |
| `gray-800` | `slate-800` |
| `gray-900` | `slate-900` |

**Arquivos prioritários** (maior concentração de `gray-*`):
- `paginas/Leads.tsx`
- `componentes/ui/empty-state.tsx`
- `paginas/Agenda.tsx`

**Estratégia de execução:**
```bash
# Verificar antes
grep -rn "gray-" src/paginas/ src/componentes/ --include="*.tsx" | wc -l

# Substituição arquivo por arquivo (não usar sed global — revisar contexto)
# Após cada arquivo: verificar se o visual faz sentido com slate
```

---

### Tarefa 1.3 — Criar componente `PageHeader`
**Arquivo novo:** `src/componentes/ui/page-header.tsx`  
**Esforço:** ~45 min  
**Impacto:** Remove os 3 padrões de cabeçalho coexistentes

**API do componente:**
```tsx
interface PageHeaderProps {
  title: string
  description?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  breadcrumb?: { label: string; href?: string }[]
}
```

**Padrão visual:**
```tsx
<div className="flex items-start justify-between mb-6">
  <div className="flex items-center gap-3">
    {icon && (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        {icon}
      </div>
    )}
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {description && (
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      )}
    </div>
  </div>
  {actions && <div className="flex items-center gap-2">{actions}</div>}
</div>
```

---

### Tarefa 1.4 — Corrigir hover no `Card` padrão
**Arquivo:** `src/componentes/ui/card.tsx` (linha 11)  
**Esforço:** 10 min  
**Impacto:** Remove expectativa de interatividade falsa

**Atual:**
```tsx
"rounded-xl border border-slate-200/80 bg-white ... hover:shadow-[...] hover:-translate-y-0.5"
```

**Solução — separar em duas variantes:**
```tsx
// Card padrão: sem hover
const cardVariants = cva(
  "rounded-xl border border-slate-200 bg-white shadow-soft transition-all duration-200",
  {
    variants: {
      interactive: {
        true: "cursor-pointer hover:shadow-medium hover:-translate-y-0.5",
        false: ""
      }
    },
    defaultVariants: { interactive: false }
  }
)
```

**Após criar variante:** Adicionar `interactive` apenas nos cards de:
- `MeusAgentes.tsx` — cards de agente (clicáveis)
- `Campanhas.tsx` — cards de campanha (clicáveis)
- `KanbanLeads.tsx` — cards do kanban (arrastáveis)

---

### Tarefa 1.5 — Verificar e consolidar tokens CSS
**Arquivo:** `src/index.css` e `src/design-system/tokens.css`  
**Esforço:** 20 min  
**Ação:** Auditoria — confirmar que `--shadow-soft`, `--shadow-medium`, `--shadow-premium` estão definidos e que o `tailwind.config.js` já os mapeia (confirmado: já mapeado).

**Verificação rápida:**
```bash
grep -n "shadow-soft\|shadow-medium\|shadow-premium" src/index.css
# Deve retornar as definições
# O tailwind.config.js já tem os extend.boxShadow configurados
```

---

**Critério de conclusão da Fase 1:**
- [ ] `--primary` aponta para blue-600
- [ ] Zero ocorrências de `gray-*` no código (exceto em comentários)
- [ ] `PageHeader` exportado de `componentes/ui/`
- [ ] `Card` tem variante `interactive` separada
- [ ] Todos os tokens CSS de sombra verificados e funcionais

---

## Fase 2 — Consistência

> **Meta:** Mudanças visíveis mas silenciosas. O usuário percebe que "ficou melhor" sem identificar o que mudou.

### Tarefa 2.1 — Aplicar `PageHeader` em todas as páginas
**Arquivos:** Todas as `paginas/*.tsx` (20+ arquivos)  
**Esforço:** ~2h  
**Ordem sugerida:** Dashboard → Leads → Campanhas → demais

**Padrão de importação:**
```tsx
import { PageHeader } from "@/componentes/ui/page-header"
```

**Remover ao aplicar:** Os `<div className="mb-6/8">`, `<h1>`, `<p>` de cabeçalho existentes que variam por página.

---

### Tarefa 2.2 — `EmptyState` em todas as páginas
**Componente existente:** `src/componentes/ui/empty-state.tsx` (bem construído, 1/8 páginas usando)  
**Esforço:** ~1h  

**Páginas que precisam:**
| Página | Condição para empty | Tipo sugerido |
|---|---|---|
| `Leads.tsx` | Sem leads na lista/kanban | `users` |
| `Campanhas.tsx` | Sem campanhas | `mail` |
| `Listas.tsx` | Sem listas criadas | `list` |
| `MeusAgentes.tsx` | Sem agentes | `bot` |
| `Agenda.tsx` | Sem eventos no dia | `calendar` |
| `Blacklist.tsx` | Lista vazia | `shield` |
| `Mineracao.tsx` | Sem resultados | `search` |

**Padrão:**
```tsx
{dados.length === 0 && !carregando && (
  <EmptyState
    icon="users"
    title="Nenhum lead encontrado"
    description="Ajuste os filtros ou importe novos leads para começar."
    action={{ label: "Importar leads", onClick: () => {} }}
  />
)}
```

---

### Tarefa 2.3 — Padronizar loading de botão
**Esforço:** ~30 min (busca + substituição)  
**Padrão universal:** `<Loader2 className="w-4 h-4 mr-2 animate-spin" />`

**Verificar e corrigir:**
```bash
grep -rn "animate-spin\|Loader2" src/paginas/ --include="*.tsx"
# Normalizar todos para w-4 h-4 (não w-3, w-5, w-6)
```

---

### Tarefa 2.4 — Substituir toggles custom pelo `Switch` do design system
**Arquivo de referência:** `src/componentes/ui/switch.tsx` (já existe)  
**Esforço:** ~45 min  

**Localizar implementações custom:**
```bash
grep -rn "toggle\|rounded-full.*cursor-pointer\|bg-gray.*rounded-full" src/paginas/ --include="*.tsx"
```

**Padrão correto:**
```tsx
import { Switch } from "@/componentes/ui/switch"

<div className="flex items-center gap-2">
  <Switch
    id="notif-email"
    checked={ativo}
    onCheckedChange={setAtivo}
  />
  <label htmlFor="notif-email" className="text-sm font-medium text-slate-700">
    Notificações por e-mail
  </label>
</div>
```

---

### Tarefa 2.5 — Corrigir acessibilidade básica: `aria-label` + `htmlFor`
**Esforço:** ~30 min  
**Impacto:** Mínimo de acessibilidade + SEO interno

**Botões icon-only sem aria-label:**
```bash
grep -rn "<Button.*size=\"icon\"\|MoreVertical\|MoreHorizontal\|Pencil\|Trash2\|Eye" src/ --include="*.tsx" | grep -v "aria-label"
```

**Formulários sem `htmlFor`:**
```bash
grep -rn "<label" src/ --include="*.tsx" | grep -v "htmlFor"
```

**Padrão:**
```tsx
<Button size="icon" variant="ghost" aria-label="Mais opções">
  <MoreVertical className="w-4 h-4" />
</Button>

<label htmlFor="campo-nome" className="text-sm font-medium text-slate-700">
  Nome completo
</label>
<Input id="campo-nome" ... />
```

---

### Tarefa 2.6 — Desabilitar item "Conversas" (rota em construção)
**Arquivo:** `src/layouts/LayoutDashboard.tsx` ou config de sidebar  
**Esforço:** 5 min

```tsx
// Encontrar o item "Conversas" na config de navegação e adicionar:
{
  label: "Conversas",
  href: "/dashboard/conversas",
  icon: <MessageSquare />,
  disabled: true,          // ← adicionar
  badge: "Em breve",       // ← opcional
}
```

---

### Tarefa 2.7 — Substituir inputs nativos de `Blacklist.tsx`
**Arquivo:** `src/paginas/Blacklist.tsx`  
**Esforço:** 20 min  
**Trocar:** `<select>` nativo e `<input>` raw pelo `Select` e `Input` do design system

---

**Critério de conclusão da Fase 2:**
- [ ] `PageHeader` aplicado em 100% das páginas principais
- [ ] `EmptyState` aplicado em todas as 7 páginas listadas
- [ ] Zero loading spinners com tamanho divergente
- [ ] Zero toggles custom (todos usando `Switch`)
- [ ] Todos os botões icon-only têm `aria-label`
- [ ] Todos os `<label>` têm `htmlFor` associado
- [ ] "Conversas" desabilitado no menu

---

## Fase 3 — Dashboard e Hierarquia

> **Meta:** Mudanças visíveis. O usuário percebe que ficou mais organizado e eficiente.

### Tarefa 3.1 — Refatorar `DashboardProspeccao` com 3 zonas
**Arquivo:** `src/paginas/DashboardProspeccao.tsx`  
**Esforço:** ~3h  

**Estrutura de zonas:**
```
┌─────────────────────────────────────────────────────────┐
│ ZONA 1 — O que importa hoje (3 cards horizontais, topo) │
│  [Agendamentos do dia] [Conversas abertas] [Alertas]    │
├─────────────────────────────────────────────────────────┤
│ ZONA 2 — Performance (4 cards de KPI)                   │
│  [Conversão] [Leads semana] [Campanhas ativas] [SDR]    │
├─────────────────────────────────────────────────────────┤
│ ZONA 3 — Ações rápidas (lateral/rodapé)                 │
│  [Nova mineração] [Nova campanha] [Ver leads quentes]   │
└─────────────────────────────────────────────────────────┘
```

**Separação semântica dos cards:**
```tsx
// Card de urgência (zona 1) — borda colorida por tipo
<Card className="border-l-4 border-l-amber-500">

// Card de KPI (zona 2) — tipografia de métrica
<Card>
  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Taxa de conversão</p>
  <p className="text-3xl font-bold tabular-nums text-slate-900">94%</p>
</Card>

// Card de ação rápida (zona 3) — interativo com hover
<Card interactive className="cursor-pointer">
```

---

### Tarefa 3.2 — Tipografia de KPI (`tabular-nums` + hierarquia)
**Arquivos:** `DashboardProspeccao.tsx`, `DashboardAgentes.tsx`  
**Esforço:** 30 min  

**Padrão de KPI:**
```tsx
// ANTES
<p className="text-2xl font-bold text-blue-600">94%</p>
<p className="text-sm text-gray-500">taxa de sucesso</p>

// DEPOIS
<p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900">94%</p>
<p className="text-xs font-medium uppercase tracking-wide text-slate-500 mt-0.5">
  Taxa de sucesso
</p>
```

**Aplicar em:** Todos os números de métrica em ambos os dashboards.

---

### Tarefa 3.3 — Skeleton Loading nas páginas principais
**Componente existente:** `src/componentes/ui/skeleton.tsx` (existe, não usado)  
**Esforço:** ~2h  
**Páginas prioritárias:** Dashboard, Leads, Campanhas

**Regra crítica (ver Risco 4 do relatório):** O skeleton DEVE espelhar o layout exato do conteúdo. Construir do componente real para baixo.

**Padrão para card de KPI:**
```tsx
// Criar em: src/componentes/ui/skeletons/SkeletonKPI.tsx
export function SkeletonKPI() {
  return (
    <Card>
      <CardContent className="p-6">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}
```

**Padrão para linha de lead:**
```tsx
export function SkeletonLead() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-slate-100">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-40 mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  )
}
```

---

### Tarefa 3.4 — Hierarquia de superfícies (3 níveis)
**Arquivos:** `layouts/LayoutDashboard.tsx` + páginas  
**Esforço:** ~1h  

**Sistema:**
```
Nível 0 — Página:         bg-slate-50    (fundo do layout)
Nível 1 — Card:           bg-white       (componente Card padrão)
Nível 2 — Campo interno:  bg-slate-50 + border (dentro de cards)
```

**No layout:**
```tsx
// LayoutDashboard.tsx — área de conteúdo
<main className="flex-1 bg-slate-50 min-h-screen p-6">
```

**Em formulários aninhados dentro de cards:**
```tsx
<div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
  <Input ... />
</div>
```

---

### Tarefa 3.5 — Mover "Meu Plano" para o rodapé da sidebar
**Arquivo:** Config de navegação da sidebar  
**Esforço:** 15 min  

Itens operacionais (prospecção, agentes, campanhas) na navegação principal.  
"Meu Plano" + "Upgrade" no rodapé junto ao perfil do usuário — padrão SaaS (Notion, Linear, Vercel).

---

**Critério de conclusão da Fase 3:**
- [ ] Dashboard tem 3 zonas visuais claras
- [ ] Todos os KPIs usam `tabular-nums` e hierarquia diferenciada
- [ ] Skeleton loading em Dashboard, Leads e Campanhas
- [ ] Fundo da página é `bg-slate-50` (não `bg-white`)
- [ ] "Meu Plano" movido para rodapé da sidebar

---

## Fase 4 — Mobile e Responsividade

> **Meta:** Necessário antes de crescer a base de usuários mobile. Corretor usa o produto em campo.

### Tarefa 4.1 — Corrigir sidebar em mobile
**Arquivo:** `src/layouts/LayoutDashboard.tsx`  
**Esforço:** ~2h  

**Problemas a resolver:**
1. Sem overlay escuro ao abrir
2. Sidebar preenche 100% da tela sem botão de fechar explícito
3. Sem swipe para fechar
4. Não fecha ao navegar para outra rota

**Solução mínima viável:**
```tsx
// Adicionar overlay
{sidebarAberta && (
  <div
    className="fixed inset-0 z-20 bg-black/50 lg:hidden"
    onClick={() => setSidebarAberta(false)}
  />
)}

// Sidebar como drawer mobile
<aside className={cn(
  "fixed inset-y-0 left-0 z-30 w-64 transition-transform duration-300 lg:relative lg:translate-x-0",
  sidebarAberta ? "translate-x-0" : "-translate-x-full"
)}>

// Fechar ao navegar (no item de menu)
onClick={() => {
  navigate(href)
  if (isMobile) setSidebarAberta(false)
}}
```

---

### Tarefa 4.2 — Breakpoints responsivos em grids fixos
**Arquivos prioritários:** `Captacao.tsx`, `DashboardProspeccao.tsx`, `MeusAgentes.tsx`  

**Buscar:**
```bash
grep -rn "grid-cols-[3-9]\|grid-cols-1[0-9]" src/paginas/ --include="*.tsx"
```

**Padrão responsivo:**
```tsx
// ANTES
<div className="grid grid-cols-3 gap-4">

// DEPOIS
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

// Para grids de 4 colunas
<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
```

---

### Tarefa 4.3 — Kanban: indicador de scroll horizontal
**Arquivo:** `src/componentes/KanbanLeads.tsx`  
**Esforço:** 20 min  

```tsx
// Container do kanban
<div className="relative">
  <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200">
    {/* colunas */}
  </div>
  {/* Indicador "scroll para ver mais" apenas em mobile */}
  <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-slate-50 pointer-events-none lg:hidden" />
</div>
```

---

### Tarefa 4.4 — `LeadDetalhes` otimizado para one-handed
**Arquivo:** `src/paginas/LeadDetalhes/index.tsx`  
**Esforço:** ~2h  

**Ajustes para tela mobile:**
- Ações primárias (ligar, enviar WhatsApp, agendar) em barra fixa no rodapé da tela
- Conteúdo com scroll vertical livre
- Botões de ação com `h-12 min-w-12` (zona de toque adequada — mínimo 44px)

```tsx
{/* Barra de ações mobile — fixed bottom */}
<div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex gap-2 lg:hidden">
  <Button className="flex-1" variant="default">
    <Phone className="w-4 h-4 mr-2" /> Ligar
  </Button>
  <Button className="flex-1" variant="outline">
    <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
  </Button>
</div>
```

---

### Tarefa 4.5 — Wizard de Captação: corrigir modal em mobile
**Arquivo:** `src/componentes/agentes/WizardCriacaoAgente.tsx`  
**Esforço:** 30 min  

```tsx
// ANTES
<Dialog>
  <DialogContent className="max-w-4xl">

// DEPOIS
<Dialog>
  <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] sm:w-full">
    <div className="max-h-[80vh] overflow-y-auto">
```

---

**Critério de conclusão da Fase 4:**
- [ ] Sidebar mobile tem overlay, fecha ao navegar, fecha ao clicar overlay
- [ ] Zero `grid-cols-N` sem breakpoints responsivos
- [ ] Kanban tem indicador de scroll em mobile
- [ ] `LeadDetalhes` tem barra de ações fixa no rodapé em mobile
- [ ] Wizard não transborda em viewport 375px

---

## Fase 5 — Polimento Premium

> **Meta:** Elevar de "bom" para "premium". Diferenciais competitivos de percepção de valor.

### Tarefa 5.1 — Ativar `.card-premium` e classes CSS existentes
**Arquivo:** `src/index.css` (verificar classes definidas)  

Aplicar `.card-premium` nos cards de destaque:
- Card de "Prospecção com IA" no dashboard
- Cards de agentes premium em `MeusAgentes.tsx`
- Seção de destaque em `DashboardAgentes.tsx`

---

### Tarefa 5.2 — Microinteração na conversão de lead
**Arquivo:** `src/paginas/LeadDetalhes/`  
**Esforço:** ~1h  

Momento de vitória — quando lead muda para status "Convertido":
```tsx
import confetti from 'canvas-confetti' // única dependência nova aceita aqui

const aoConverterLead = async () => {
  await atualizarStatusLead('convertido')
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.6 },
    colors: ['#2563EB', '#7C3AED', '#10B981']
  })
}
```

> **Atenção:** Usar apenas neste momento específico. Não generalizar para outros eventos.

---

### Tarefa 5.3 — Breadcrumb em páginas de detalhe
**Arquivos:** `LeadDetalhes`, `CampanhaDetalhes`, `ContatoDetalhes`  

```tsx
<PageHeader
  title={lead.nome}
  breadcrumb={[
    { label: "Leads", href: "/dashboard/leads" },
    { label: lead.nome }
  ]}
/>
```

---

### Tarefa 5.4 — Microinteração no disparo de campanha
**Arquivo:** `src/componentes/PainelDisparo.tsx`  
**Esforço:** 45 min  

Substituir toast genérico por:
1. Barra de progresso preenchendo (mesmo que simulada para <2s)
2. Ícone de check com fade-in
3. Texto "Campanha disparada para X contatos" com counter animado

---

### Tarefa 5.5 — Revisão final de contraste (WCAG AA)
**Esforço:** ~1h  

Verificar manualmente (ou com ferramenta como axe):
- Texto `text-slate-400` sobre `bg-white` — ratio mínimo 4.5:1
- Badges coloridos com texto branco — ratio mínimo 4.5:1
- Placeholder de inputs — ratio mínimo 3:1

Ajustar tonalidades que não atingem o mínimo.

---

**Critério de conclusão da Fase 5:**
- [ ] Cards de destaque usam `.card-premium` ou equivalente
- [ ] Conversão de lead tem microinteração de celebração
- [ ] Páginas de detalhe têm breadcrumb funcional
- [ ] Disparo de campanha tem feedback visual rico
- [ ] Contraste WCAG AA em todos os textos principais

---

## Quick Wins — Executar Antes da Fase 1

Melhorias de 0–15 minutos que podem ser feitas imediatamente:

| # | Ação | Arquivo | Tempo |
|---|---|---|---|
| QW1 | Corrigir `--primary` para blue-600 | `src/index.css` | 2 min |
| QW2 | Remover `hover:-translate-y-0.5` do Card padrão | `componentes/ui/card.tsx:11` | 2 min |
| QW3 | Adicionar `tabular-nums` nas métricas do dashboard | `DashboardProspeccao.tsx` | 10 min |
| QW4 | Desabilitar item "Conversas" no menu | config sidebar | 5 min |
| QW5 | Corrigir `htmlFor` no `Login.tsx` | `paginas/Login.tsx` | 5 min |
| QW6 | `window.confirm` → dialog inline em `buscarPorCodigo` | `Captacao.tsx` | 20 min |

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Corrigir `--primary` quebra componentes com contraste invertido | Média | Alto | Revisar `button.tsx`, `badge.tsx`, `LayoutDashboard.tsx` antes de commitar |
| Dark mode parcial piora experiência | Baixa | Alto | Remover todas as classes `dark:` se não implementar completo |
| Animações causando jank em listas de 200+ itens | Baixa | Médio | Aplicar `will-change` apenas onde necessário; testar com dados reais |
| Skeletons com layout errado causando CLS | Média | Médio | Construir skeleton a partir do componente real; testar na rede lenta |
| Mobile-first quebrando layout desktop | Baixa | Alto | Testar desktop primeiro ao adicionar breakpoints; viewport 1440px |

---

## Checklist de Definition of Done por Tarefa

Toda tarefa é considerada concluída apenas quando:

- [ ] Mudança não quebra nenhuma rota existente
- [ ] Testado em Chrome (desktop 1440px)
- [ ] Testado em Chrome DevTools mobile (375px)
- [ ] Sem `console.error` novo no DevTools
- [ ] TypeScript compila sem erros (`tsc --noEmit`)
- [ ] Sem regressão visual nas páginas adjacentes

---

## Ordem de Execução Recomendada

```
Semana 1:  QW1 → QW2 → QW3 → QW4 → QW5 → Tarefa 1.1 → 1.2 → 1.3 → 1.4 → 1.5
Semana 2:  Tarefa 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7
Semana 3:  Tarefa 3.1 → 3.2 → 3.3 → 3.4 → 3.5
Semana 4:  Tarefa 4.1 → 4.2 → 4.3 → 4.4 → 4.5
Contínuo:  Tarefa 5.1 → 5.2 → 5.3 → 5.4 → 5.5
```

---

*Plano gerado em 2026-04-28 com base no RELATORIO_REVISAO_VISUAL_ELYON.md*
