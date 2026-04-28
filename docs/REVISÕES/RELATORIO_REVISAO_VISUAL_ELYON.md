# Relatório de Revisão Visual — ELYON Platform
### SaaS/CRM Imobiliário · Design Review Estratégico 2026
> Elaborado com base na leitura completa de todos os arquivos de frontend  
> Stack: React · TypeScript · TailwindCSS · Lucide React

---

## 1. Resumo Executivo

O ELYON tem uma base visual sólida — estrutura de layout funcional, componentes bem nomeados e uma intenção clara de produto premium. O sistema já superou a fase de "protótipo funcional" e está entrando na fase onde a percepção de qualidade começa a diferenciar produto de concorrente.

O problema central não é a ausência de estilo, mas a **fragmentação**: o `index.css` define um sistema premium completo (gradientes, sombras, glass, variáveis CSS) que simplesmente não é usado. As páginas implementam estilos inline repetidamente. O resultado é um produto que parece ter sido construído por 3 times diferentes em 6 meses sem conversa entre si.

**O potencial de melhoria é alto e o custo de execução é baixo** — a maior parte das melhorias está em consolidar o que já existe, não em criar do zero.

A interface atual transmite: *"sistema funcional construído com cuidado"*.  
A interface que o produto merece transmite: *"copiloto inteligente que respeita o tempo do corretor"*.

---

## 2. Diagnóstico Geral

### Hierarquia Visual
- Todas as páginas têm o mesmo peso visual. Dashboard, lista de leads, configurações — tudo parece no mesmo nível de importância.
- Ausência de um elemento ancora em cada tela. O olho do usuário não sabe por onde começar.
- `CardTitle` usa `text-2xl` por padrão mas é usado com `text-base` em cards compactos — quebrando a escala tipográfica.
- Três padrões de cabeçalho de página coexistem sem critério.

### Consistência
- Dois sistemas de neutros: `slate-*` (85% do app) e `gray-*` (15%, vazando de Leads, EmptyState, Agenda).
- Três tons de azul-roxo (`blue`, `indigo`, `purple`) usados como "cor primária" em contextos equivalentes.
- Toggles visuais: 3 implementações diferentes para o mesmo componente (Switch do design system nunca é usado).
- Focus ring: 2 padrões diferentes dependendo da página.

### Espaçamento
- `p-4`, `p-6`, `p-8` usados sem critério semântico — elementos do mesmo nível hierárquico têm paddings diferentes.
- O wizard usa `p-8`, cards de lista usam `p-6`, seções de alerta usam `p-4` — correto por intuição, mas não documentado.
- `gap-3`, `gap-4`, `gap-6` misturados em grids do mesmo contexto.

### Tipografia
- Escala funcional mas sem personalidade. Usa apenas o sistema padrão Tailwind sem customização de fonte, tracking ou leading diferenciado.
- Texto de labels em formulários: `text-sm font-medium text-slate-700` — correto e consistente.
- Corpo de texto em tabelas/listas: alternância entre `text-sm` e `text-xs` sem critério de densidade.
- Ausência de uma fonte de destaque para números e métricas (os dashboards mostram métricas em fonte sans-serif genérica).

### Cores
- **Problema crítico:** `--primary` no CSS aponta para quase-preto. O Button `variant="default"` renderiza preto. Toda a aplicação sobrescreve para `blue-600` manualmente.
- 13 classes utilitárias premium definidas no CSS (`.card-premium`, `.glass`, `.gradient-text`, etc.) com **zero usos** no código.
- As variáveis CSS de gradiente (`--gradient-primary`, `--gradient-success`) existem mas não são consumidas — o código usa gradientes Tailwind inline repetidamente.

### Componentes
- `Card` levanta no hover (`-translate-y-0.5`) mesmo quando não é clicável — cria expectativa de interatividade falsa.
- `EmptyState` bem construído, usado em apenas 1 das 8 páginas que precisam dele.
- `Stepper` bem construído, não usado no Wizard de Captação (que implementou seus próprios indicadores de etapa).
- Loading states inconsistentes: algumas páginas usam skeleton (nenhuma), outras usam `Loader2` centralizado (correto), outras usam apenas texto.

### Responsividade
- Layout desktop bem estruturado.
- Sidebar não colapsa para mobile — ocupa tela inteira quando aberta em viewport pequeno.
- Wizard de Captação (`Captacao.tsx`) tem grids `grid-cols-3` e `grid-cols-4` sem breakpoints responsivos.
- Kanban de leads (`KanbanLeads.tsx`) tem scroll horizontal sem indicador visual de que há mais colunas.
- Nenhuma página tem layout otimizado para uso one-handed (corretor com celular na mão).

### Clareza Operacional
- Dashboard inicial (`DashboardProspeccao`) mistura métricas, atalhos rápidos e status — sem separação clara entre "o que aconteceu" e "o que fazer agora".
- Notificações existem mas a área de alertas do SDR não tem caminho claro de resolução.
- Status do WhatsApp aparece na sidebar mas o impacto operacional de "desconectado" não é comunicado nas telas afetadas.

### Percepção de Valor
- O produto resolve problemas complexos (mineração de dados, agentes de IA, automação) mas a interface não comunica isso visualmente.
- Ausência de microinterações significativas — cada ação parece igual às outras em termos de feedback.
- Não há "momento uau" na interface — um novo usuário que acessa pela primeira vez não percebe o poder do produto pelo visual.

---

## 3. Pontos Fortes Atuais

**Preservar sem alterar:**

- **Estrutura da sidebar com seções colapsáveis** — accordion exclusivo bem implementado, estado persistido em localStorage, tooltips no modo compacto. É uma sidebar de qualidade.
- **Componente `Stepper`** — bem construído, suporta orientação horizontal/vertical, status de erro, ícones customizáveis. Precisa apenas ser usado.
- **Componente `EmptyState`** — ícones contextuais por tipo, animação de entrada, ação opcional, sparkle decorativo. Perfeito para o produto.
- **Tokens de sombra no CSS** (`--shadow-soft`, `--shadow-medium`, `--shadow-premium`) — escala bem calibrada, basta conectar ao Tailwind config e usar.
- **Sistema de notificações** — `NotificacoesDropdown` com tempo relativo, tipos de alerta, animação de entrada.
- **`WhatsAppStatusBadge`** — indicador sempre visível na sidebar, com estado de conexão em tempo real.
- **Escala de neutros `slate-*`** — escolha correta e sofisticada. Apenas precisa ser aplicada 100% consistentemente.
- **Design token de radius** — `--radius: 0.5rem` alinhado com `rounded-xl` nos componentes principais. Coerente.
- **Paleta de cores de status** no `badge.tsx` — `success`, `warning`, `destructive`, `outline` bem definidos.
- **Hierarquia de navegação** — 3 seções (Prospecção, Atendimento, Gestão) com itens de destaque no topo e base. Arquitetura de informação correta.

---

## 4. Principais Oportunidades de Melhoria

### 4.1 Corrigir o token `--primary` e liberar o sistema de design
**Impacto:** Elimina 40+ sobrescritas manuais de `bg-blue-600` no código. O Button passa a funcionar corretamente sem override. Toda mudança futura de cor primária vira 1 linha de CSS.

### 4.2 Ativar o sistema premium que já existe
**Impacto:** `.card-premium`, `.btn-premium`, `.glass`, variáveis de gradiente e sombra já estão no CSS. Usá-los substitui dezenas de linhas de Tailwind inline por classes semânticas. Reduz inconsistência e manutenção.

### 4.3 Criar `PageHeader` como componente único
**Impacto:** Todas as páginas ganham cabeçalho consistente. Título, ícone, subtítulo, ação principal e breadcrumb num único lugar. Elimina os 3 padrões coexistentes.

### 4.4 Dashboard estratégico: separar "métricas" de "ações"
**Impacto:** O usuário que abre o sistema de manhã precisa de 2 coisas: saber o que aconteceu + saber o que fazer. Hoje estão misturados. Separar em 2 zonas visuais claras muda a eficiência operacional.

### 4.5 Hierarquia de superfícies: 3 níveis, não 1
**Impacto:** Atualmente tudo é `bg-white` com `border`. Um sistema de 3 superfícies (`bg-slate-50` para página, `bg-white` para cards, `bg-slate-50` para campos internos) cria profundidade sem usar sombra pesada.

### 4.6 Tipografia com personalidade para métricas
**Impacto:** Números de KPI em fonte `tabular-nums` com weight diferenciado comunicam "dado importante" instantaneamente. É uma mudança de 2 classes que transforma a percepção do dashboard.

### 4.7 Microinterações nos estados de sucesso
**Impacto:** Quando o agente converte um lead, quando uma campanha é disparada, quando um contrato é enviado — esses momentos merecem feedback visual que celebra a ação. Hoje são todos iguais a um toast genérico.

---

## 5. Análise por Área

---

### 5.1 Dashboard

**Estado atual:** `DashboardProspeccao.tsx` e `DashboardAgentes.tsx` existem como páginas separadas. O dashboard principal mistura 3 tipos de conteúdo sem hierarquia clara: métricas de volume, atalhos de ação rápida e status operacional.

**Problemas identificados:**
- Métricas de volume (total de leads, conversas) e ações urgentes (alertas, agendamentos do dia) ficam no mesmo nível visual.
- Cards de KPI não usam tipografia de destaque para os números — o valor `"94%"` tem o mesmo peso visual que o label `"taxa de sucesso"`.
- O gradiente `from-blue-600 to-purple-600` em `DashboardAgentes` é o único elemento visualmente rico da tela, mas está isolado — não cria sistema.
- Ausência de "zona de decisão" — o corretor não sabe qual é a primeira ação a tomar ao abrir o sistema.
- Gráfico de barras usa `bg-blue-500 rounded-t-md` inline, sem componente de visualização adequado. Funciona, mas parece provisório.

**Direção recomendada:**
```
Zona 1 — O que importa hoje (topo, horizontal)
  [Agendamentos do dia] [Conversas abertas] [Alertas críticos]

Zona 2 — Performance (meio)
  [Taxa de conversão] [Leads na semana] [Campanhas ativas]

Zona 3 — Ações rápidas (lateral ou rodapé)
  [Nova mineração] [Nova campanha] [Ver leads quentes]
```

---

### 5.2 Sidebar e Navegação

**Estado atual:** Bem estruturada. Accordion exclusivo, tooltips no modo compacto, WhatsApp status, user menu com dropdown. É o componente mais maduro da interface.

**Problemas identificados:**
- "Dashboard" é o único item fora de seção — aparece acima das seções com estilo diferente (azul sólido), mas não tem seção própria. Cria inconsistência hierárquica.
- "Prospecção com IA" e "Meu Plano" têm `destaque: true` com gradiente amarelo-laranja. O estilo de destaque é correto para 1 item — mas com 2, perde o efeito.
- Quando sidebar está fechada (72px), os separadores de seção viram `<div>` vazio com `border-t` — semanticamente vazio, sem tooltip de seção.
- `Conversas` aparece no menu mas a rota `/dashboard/conversas` redireciona para "Página em construção". O item deveria estar desabilitado ou com badge "em breve".
- "Meu Plano" como item de gestão mistura configuração de conta com ferramentas operacionais. Em SaaS premium, o upgrade fica em área separada (ícone de coroa no rodapé, não no menu principal).

**Pontos fortes:** O accordion exclusivo é uma decisão correta e rara — evita que o menu fique longo demais. A persistência do estado no localStorage é detalhe de qualidade.

---

### 5.3 Listagens e Tabelas

**Estado atual:** Leads, Campanhas, Listas e Blacklist usam padrões visuais diferentes para o mesmo tipo de conteúdo.

**Problemas identificados:**

**Leads.tsx:**
- Mistura 2 sistemas de neutros (`gray-*` e `slate-*`) na mesma tela.
- Status badges implementados inline com string de classes `bg-purple-100 text-purple-700 border-purple-200` — não usa o `Badge` do design system.
- View toggle (kanban/lista) usa `rounded-md px-3 py-1.5` custom em vez do `Button` do sistema.
- Filtros (select nativo) têm estilo diferente dos `Select` do design system.
- A linha de separação entre cards de lead no modo lista usa border-bottom, mas sem hover state de linha completo.

**Campanhas.tsx:**
- Cards de campanha são `bg-white p-6 rounded-xl` — correto, mas sem informação de status visual imediato (precisa ler o badge para saber o status).
- Filtro de busca usa `Loader2` posicionado com `absolute right-2 top-2.5` — posicionamento frágil que quebra se o input mudar de altura.
- Empty state é uma linha de texto simples, sem o `EmptyState` existente no design system.

**Padrão recomendado para todas as listagens:**
```
[Cabeçalho com PageHeader]
[Barra de ação: busca + filtros + botão primário]
[Contagem de resultados + estado de filtros ativos]
[Lista/Tabela com hover state]
[Paginação ou infinite scroll]
[Empty state com EmptyState component]
```

---

### 5.4 Formulários

**Estado atual:** Formulários de configuração (agente, imobiliária, campanha) são funcionais mas cansativos.

**Problemas identificados:**

- **Ausência de seções visuais**: formulários longos (ConfiguracaoAgente tem 6+ seções) não têm separação visual clara entre grupos de campos. Tudo flui como uma lista vertical sem respiração.
- **Labels não associados**: Login.tsx tem `<label>` sem `htmlFor` — o clique no label não foca o campo.
- **Validação reativa ausente**: erros só aparecem no submit. Campos como "nome do agente" poderiam validar ao sair do campo (onBlur).
- **Campos obrigatórios não marcados**: nenhum campo tem indicador `*` ou marcação visual de obrigatório.
- **Textarea sem contador**: EtapaPrompt mostra contador de caracteres — correto. Outros textareas longos (objetivo, contexto) não têm.
- **Select nativo vs Select do sistema**: `Captacao.tsx` usa `<select>` nativo com `className="w-full h-9 rounded-md border..."` em vez do componente `Select` do design system.
- **Wizard cansativo**: 8 etapas no Modo Avançado sem indicação de progresso em %. "Etapa 3 de 8" seria suficiente para reduzir ansiedade do usuário.

**Padrão recomendado:**
```
[Seção com título e descrição curta]
  [Campo 1]
  [Campo 2]
[Separador visual]
[Seção 2]
  ...
[Footer sticky com botões de ação]
```

---

### 5.5 Cards de Leads, Imóveis e Clientes

**Estado atual:** Cards de leads no modo lista são informativos mas densos. Cards de agentes em `MeusAgentes.tsx` são bem construídos.

**Problemas identificados:**

**Cards de Lead (Leads.tsx):**
- O avatar circular com inicial do nome é o elemento mais forte visualmente — mas não tem consistência de cor (sempre roxo `bg-purple-100`, independente de qualquer dado do lead).
- Informações de contato (telefone, último contato) usam `text-xs text-gray-400` — difícil de ler em movimento.
- Badge de temperatura (Quente/Frio/Neutro) e badge de status ficam ambos na mesma linha sem hierarquia — qual é mais importante?
- Ação principal ("ver detalhes") requer hover na linha inteira. Em mobile, não há como acessar sem tooltips.

**Cards de Agente (MeusAgentes.tsx):**
- Bem construídos — avatar com gradiente, badge de status, métricas de uso. Padrão correto.
- O dropdown de ações (`MoreVertical`) não tem `aria-label`.

**Kanban de Leads:**
- Colunas sem contagem de itens no header.
- Sem indicação de limite de WIP por coluna.
- Drag and drop não tem estado visual de "arrastando" explícito além do cursor.

---

### 5.6 Estados da Interface

**Estado atual:** Parcialmente implementado. Loading states razoáveis, empty states inconsistentes, error states frágeis, success states ausentes além do toast.

| Estado | Qualidade | Observação |
|---|---|---|
| Loading de página | ✅ Consistente | `Loader2 w-8 h-8 text-blue-600` centralizado |
| Loading inline (botão) | ⚠️ Inconsistente | 3 tamanhos diferentes |
| Skeleton loading | ❌ Ausente | Componente existe em `skeleton.tsx`, não é usado |
| Empty state | ⚠️ Inconsistente | `EmptyState` existe, usado em 1/8 páginas |
| Error state (formulário) | ⚠️ Parcial | Apenas no login — outras páginas só têm toast |
| Error state (API) | ⚠️ Parcial | Toast de erro genérico sem ação de retry |
| Success state | ❌ Ausente | Apenas toast — sem confirmação visual na tela |
| Hover state (lista) | ⚠️ Inconsistente | Algumas linhas têm hover, outras não |
| Disabled state | ✅ Presente | `disabled:opacity-50` no Button |
| Active/selected | ⚠️ Parcial | Checkboxes customizados sem estado visual claro |

**Maior gap:** Skeleton loading. Em páginas com carregamento de dados (Leads, Campanhas, Dashboard), o usuário vê uma tela em branco por ~500ms antes do conteúdo. Skeletons eliminam essa percepção de "sistema lento".

---

### 5.7 Responsividade

**Estado atual:** Projetado primariamente para desktop (sidebar 256px + conteúdo). Tablet e mobile são afterthoughts.

**Problemas críticos:**

- **Sidebar em mobile**: `fixed inset-y-0 left-0 w-64` ocupa toda a tela quando aberta em viewport 375px. Não há overlay, não há botão de fechar explícito, não há swipe para fechar.
- **Grids sem breakpoints**: `Captacao.tsx` usa `grid-cols-3` e `grid-cols-4` sem `sm:` ou `md:` — em tablet 768px ficam espremidos.
- **Header fixo**: `h-16 sticky top-0` é correto para desktop mas em mobile consome 10% da altura da viewport.
- **Kanban horizontal**: O scroll horizontal do Kanban de leads não tem indicador visual ("←→ scroll") — em mobile o usuário pode não perceber que há mais colunas.
- **Wizard em mobile**: O `WizardCriacaoAgente` usa modal `max-w-4xl` — em mobile fica 100% da tela sem padding lateral.
- **Tabelas**: Nenhuma tabela tem padrão de "colapsar em cards" para mobile.

**Oportunidade:** O produto é usado por corretores em campo. A tela de `LeadDetalhes` (onde o corretor anota observações depois de uma visita) deveria ser otimizada para uso one-handed com botões de ação em zona de polegar.

---

## 6. Recomendações de Direção Visual

### Paleta de Cores

**Manter:** Azul como cor primária de ação.

```
Primário:     blue-600 (#2563EB) — ações, links, estados ativos
Secundário:   blue-50  (#EFF6FF) — backgrounds de destaque suave
Acento:       violet-600 (#7C3AED) — modo avançado, IA, automação
Sucesso:      emerald-600 (#059669)
Atenção:      amber-500 (#F59E0B)
Erro:         red-600 (#DC2626)
Neutro:       slate-* (exclusivamente, eliminar gray-*)

Superfícies:
  Página:     slate-50 (#F8FAFC)
  Card:       white (#FFFFFF)
  Campo:      white + border slate-200
  Elevado:    white + shadow-soft
```

### Tipografia

Sem adicionar fontes externas, explorar o máximo do Inter (padrão Tailwind):

```
Page title:     text-2xl font-bold tracking-tight text-slate-900
Section title:  text-lg font-semibold text-slate-800
Card title:     text-base font-semibold text-slate-900
Body:           text-sm text-slate-600 leading-relaxed
Label:          text-sm font-medium text-slate-700
Caption:        text-xs text-slate-500
Metric (KPI):   text-3xl font-bold tabular-nums text-slate-900
Metric label:   text-xs font-medium uppercase tracking-wide text-slate-500
```

A diferença entre `tracking-tight` nos títulos e `tracking-wide` nos labels de métricas cria hierarquia sem mudar fonte.

### Espaçamento (escala semântica)

```
xs:  4px  (gap-1)  — elementos internos de componentes
sm:  8px  (gap-2)  — ícone + label, chips
md: 12px  (gap-3)  — campos dentro de formulários
lg: 16px  (p-4)    — padding interno de alertas e seções compactas
xl: 24px  (p-6)    — padding de cards padrão
2xl: 32px (p-8)    — padding de wizards e containers de página
page: 32px (p-8)   — padding de conteúdo da página
```

### Bordas

```
Botões:      rounded-lg (8px)
Cards:       rounded-xl (12px)
Modais:      rounded-2xl (16px)
Avatares:    rounded-full
Badges:      rounded-full
Inputs:      rounded-lg (8px)
Sidebar:     0 (toca as bordas do viewport)
```

### Sombras

Usar as variáveis já definidas, conectando ao Tailwind:
```
Repouso:     --shadow-soft    (cards padrão)
Hover:       --shadow-medium  (cards com hover)
Elevado:     --shadow-premium (modais, dropdowns)
Glow ação:   --shadow-glow-primary (botão primário em hover)
```

Regra: **nunca usar sombra + borda ao mesmo tempo** em cards de mesmo nível.

### Estilo dos Cards

```
Card padrão:    bg-white + border border-slate-200 + rounded-xl + shadow-soft
Card clicável:  + cursor-pointer + hover:shadow-medium + hover:-translate-y-0.5
Card destaque:  + border-blue-200 + bg-blue-50/30
Card crítico:   + border-red-200 + bg-red-50/30
Card IA/copilot:+ border-violet-200 + bg-violet-50/20 (para seções de agente)
```

### Estilo dos Botões

```
Primary:   bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-glow-primary
Secondary: bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200
Outline:   border border-slate-300 bg-white rounded-lg hover:bg-slate-50
Ghost:     transparent rounded-lg hover:bg-slate-100
Danger:    bg-red-600 text-white rounded-lg hover:bg-red-700
```

Todos: `font-medium text-sm h-10 px-4 transition-all duration-150`

### Estilo dos Formulários

```
Container de seção:  bg-white rounded-xl p-6 border border-slate-200
Título de seção:     text-sm font-semibold text-slate-900 uppercase tracking-wide
Label:               text-sm font-medium text-slate-700 mb-1.5
Input:               h-10 rounded-lg border-slate-300 focus:ring-blue-500 focus:border-blue-500
Erro inline:         text-xs text-red-600 mt-1 flex items-center gap-1
Obrigatório:         * em text-red-500 após o label
```

### Microinterações Recomendadas

**Apenas onde têm significado semântico:**

```
Botão primário submit:  pulse glow ao carregar (feedback de "aguardando")
Lead convertido:        confetti leve (só neste momento de vitória)
WhatsApp conectado:     ondulação verde no indicador de status
Campanha disparada:     barra de progresso preenchendo + ✓ com fade
Upload de documento:    barra de progresso real (não simulada)
Nova mensagem no chat:  bolha com bounce sutil
Arrastar card no Kanban: sombra aumenta + item placeholder no destino
```

---

## 7. Priorização das Melhorias

### 🔴 Crítico — Impacto direto em percepção de qualidade e usabilidade

**1. Corrigir `--primary` e liberar o Button sem overrides**
- Por que: Elimina a raiz de 40+ inconsistências. Um change, efeito em todo o produto.

**2. Padronizar o sistema de neutros (eliminar `gray-*`)**
- Por que: Coerência visual imediata. Afeta todas as páginas.

**3. Implementar Skeleton Loading nas páginas principais**
- Por que: Elimina a percepção de "sistema lento". Leads, Campanhas, Dashboard.

**4. Criar `PageHeader` e aplicar em todas as páginas**
- Por que: Remove os 3 padrões de cabeçalho. Unifica a identidade visual.

**5. Usar `EmptyState` em todas as páginas que precisam**
- Por que: O componente existe e é bom. Basta aplicar.

**6. Corrigir sidebar em mobile (overlay + fechar ao navegar)**
- Por que: A sidebar ocupa tela inteira em mobile sem saída clara.

---

### 🟠 Importante — Elevam significativamente a qualidade percebida

**7. Remover hover de `Card` para cards não-clicáveis**
- Por que: Elimina expectativa de interação falsa.

**8. Substituir toggles custom pelo `Switch` do design system**
- Por que: 3 implementações para 1 componente.

**9. Padronizar loading de botão**
- Por que: `Loader2 w-4 h-4 mr-2 animate-spin` universal.

**10. Dashboard: separar zona de métricas e zona de ações**
- Por que: O corretor precisa saber imediamente o que fazer ao abrir o sistema.

**11. Tipografia de KPI com `tabular-nums` e hierarquia diferenciada**
- Por que: Métricas são o coração do dashboard — merecem destaque visual.

**12. Aplicar `aria-label` nos botões icon-only**
- Por que: Acessibilidade mínima. Afeta todos os botões de ação das tabelas.

---

### 🔵 Polimento — Elevam a experiência de "bom" para "premium"

**13. Ativar `.card-premium`, `.btn-premium` do CSS nos elementos certos**
- Por que: O sistema já existe. Basta conectar.

**14. Conectar variáveis de sombra ao Tailwind config e usar**
- Por que: Substitui shadow inline arbitrário por tokens semânticos.

**15. Implementar `PageHeader` com breadcrumb nas páginas de detalhe**
- Por que: Contexto de localização em páginas profundas.

**16. Grids responsivos em `Captacao.tsx` e demais páginas com `grid-cols-N` fixo**
- Por que: Previne quebra em tablet.

**17. Microinteração no momento de conversão de lead**
- Por que: Celebra a vitória do corretor — aumenta engajamento emocional com o produto.

**18. `LeadDetalhes` otimizado para mobile one-handed**
- Por que: É a tela mais usada em campo.

---

## 8. Quick Wins

Melhorias de alto impacto, baixo risco, implementáveis em horas:

| # | Melhoria | Esforço | Impacto |
|---|---|---|---|
| 1 | Corrigir `--primary` em `index.css` para blue-600 | 2 min | 🔴 Alto |
| 2 | Substituir `gray-*` por `slate-*` em `EmptyState.tsx` | 15 min | 🟠 Médio |
| 3 | Adicionar `aria-label` nos 15+ botões icon-only críticos | 20 min | 🟠 Médio |
| 4 | Usar `<EmptyState>` em Leads, Campanhas, Listas, MeusAgentes | 30 min | 🟠 Médio |
| 5 | Remover `hover:-translate-y-0.5` do `Card` padrão | 2 min | 🟡 Baixo |
| 6 | Adicionar `tabular-nums` nas métricas do dashboard | 10 min | 🟡 Baixo |
| 7 | `setLocaisSelecionados([])` no reset de nova mineração | 2 min | 🔴 Alto (bug) |
| 8 | Substituir `window.confirm` em `buscarPorCodigo` por inline state | 20 min | 🟠 Médio |
| 9 | Adicionar `htmlFor` + `id` nos labels do Login | 5 min | 🟡 Baixo |
| 10 | Desabilitar item "Conversas" no menu (rota em construção) | 5 min | 🟠 Médio |

---

## 9. Riscos e Cuidados

### Risco 1: Refatoração de cores quebrando estados específicos
Ao corrigir `--primary`, verificar todos os componentes que dependem de `text-primary` e `bg-primary` diretamente. Alguns podem ter sido escritos assumindo que `--primary` é preto (contraste invertido).

### Risco 2: Dark mode pela metade ser pior que ausente
A tentação de implementar dark mode incrementalmente deve ser resistida. 2% implementado + 98% branco parece bug, não feature. Ou é completo, ou as classes `dark:` são removidas.

### Risco 3: Microinterações afetando performance em listas longas
Animações em listas de 200+ itens (leads, mineração) podem causar jank. Usar `will-change: transform` apenas em elementos que realmente animam, e testar com dados reais antes de aplicar.

### Risco 4: Skeleton loading com estrutura errada
Skeletons que não correspondem ao layout real do conteúdo (tamanhos errados, número de linhas diferente) causam CLS (Cumulative Layout Shift) — pior que não ter skeleton. Construir skeleton a partir do componente real.

### Risco 5: Acessibilidade parcial sendo pior que ausente
Adicionar `aria-label` em apenas alguns botões cria inconsistência no navegação por teclado. Ao iniciar acessibilidade, cobrir uma área completa por vez.

### Risco 6: Gradientes excessivos no modo "ativação do sistema premium"
O CSS já tem `--gradient-premium-dark: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)` — um azul muito escuro. Usar com cuidado — pode parecer pesado demais para um CRM que o corretor usa 8h por dia.

### Risco 7: Mobile-first quebrando o desktop
Ao adicionar breakpoints nas grids de `Captacao.tsx`, testar em desktop primeiro. Grids que funcionam em mobile mas ficam muito esparsos em 1440px são igualmente problemáticos.

---

## 10. Plano Sugerido para a Próxima Fase de Implementação

### Fase 1 — Fundação (1 semana)
*Sem mudança visual para o usuário, apenas base técnica*

1. Corrigir `--primary` em `index.css` → blue-600
2. Eliminar `gray-*` → `slate-*` em todos os arquivos
3. Conectar variáveis CSS de sombra ao `tailwind.config.js` (extend.boxShadow)
4. Criar `PageHeader` como componente unificado
5. Remover `hover:-translate-y-0.5` do `Card` padrão; criar variante `Card.Clickable`

### Fase 2 — Consistência (1 semana)
*Mudanças visíveis mas silenciosas — usuário nota que "ficou melhor" sem saber o que mudou*

6. Aplicar `PageHeader` em todas as páginas
7. Substituir todos os empty states inline pelo `EmptyState` existente
8. Padronizar loading de botão com `Loader2 w-4 h-4 mr-2 animate-spin`
9. Substituir toggles custom pelo `Switch` do design system
10. Substituir inputs nativos de `Blacklist.tsx` pelo `Input` do design system
11. Adicionar `aria-label` em todos os botões icon-only
12. Associar `label` + `htmlFor` em todos os formulários

### Fase 3 — Dashboard e Hierarquia (1 semana)
*Mudanças visíveis — usuário percebe que ficou mais organizado*

13. Refatorar `DashboardProspeccao` com 3 zonas claras
14. Aplicar tipografia de KPI (`tabular-nums`, pesos diferenciados)
15. Implementar Skeleton Loading em Leads, Campanhas e Dashboard
16. Separar "Meu Plano" do menu principal (rodapé da sidebar)
17. Desabilitar item "Conversas" (rota em construção)

### Fase 4 — Mobile e Responsividade (1 semana)
*Necessário antes de crescer base de usuários mobile*

18. Corrigir sidebar em mobile (overlay + swipe para fechar)
19. Adicionar breakpoints responsivos nos grids de `Captacao.tsx`
20. Otimizar `LeadDetalhes` para uso one-handed
21. Tabelas: padrão "colapsar em cards" para viewport < 768px

### Fase 5 — Polimento Premium (contínuo)
*Elevação da percepção de valor — diferenciais competitivos*

22. Ativar `.card-premium` nos cards de destaque
23. Microinteração na conversão de lead
24. Microinteração no disparo de campanha
25. Breadcrumb em páginas de detalhe
26. Revisão final de contraste e acessibilidade

---

## 11. Conclusão

O ELYON já tem os ingredientes de um produto premium. O sistema de design está definido — gradientes, sombras, variáveis, animações, empty states, steppers — tudo já existe no codebase. O problema é que esse sistema foi construído mas nunca foi *habitado* pelo produto.

A lacuna entre o CSS que existe e o CSS que é usado representa meses de trabalho acumulado que ainda não gerou valor visual. A boa notícia é que aproveitar esse trabalho tem custo muito baixo — é uma questão de conexão, não de criação.

O caminho para transformar o ELYON de "sistema funcional" para "copiloto premium" não passa por adicionar glassmorphism ou animações elaboradas. Passa por **três princípios simples**:

**1. Um token, um comportamento.** Quando `--primary` significa azul em todo o produto, quando `slate-*` é o único cinza, quando `p-6` é sempre o padding de card — o produto parece construído por uma mente coesa, não por contribuições acumuladas.

**2. O componente que já existe deve ser o único.** O `EmptyState` existe. O `Switch` existe. O `Stepper` existe. Enquanto cada página reinventa esses elementos, o produto parece inconsistente independente de quão bonito cada implementação individual seja.

**3. A hierarquia serve ao corretor, não ao designer.** O corretor que abre o sistema às 8h da manhã precisa de 3 informações em 3 segundos: o que aconteceu, o que está pendente, o que fazer agora. Toda decisão de design deve ser avaliada por esse critério.

Um produto AI-first não precisa de partículas flutuantes ou gradientes animados para transmitir inteligência. Precisa de **clareza** — a sensação de que o sistema entende o contexto do usuário e apresenta as informações certas, no momento certo, sem ruído.

Esse é o ELYON que esse codebase já tem capacidade de entregar.
