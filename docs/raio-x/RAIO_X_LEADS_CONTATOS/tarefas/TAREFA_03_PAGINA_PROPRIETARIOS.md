# Tarefa: Frontend — Página /proprietarios (Listagem Unificada)

Base:
- docs/raio-x/RAIO_X_LEADS_CONTATOS.md

Escopo alvo:
- pacotes/frontend/src/paginas/Proprietarios.tsx (arquivo novo)
- pacotes/frontend/src/componentes/KanbanLeads.tsx (refatoração de virtualização)
- pacotes/frontend/src/ganchos/useProprietarios.ts (arquivo novo)

Problemas críticos (ordem):

1) [P5-ui] Não existe visão unificada de todos os proprietários
   O corretor precisa navegar por Campanhas para ver Contatos e por /leads para ver
   Leads qualificados — são duas telas separadas sem nenhuma conexão visual.
   Resultado: sem forma de responder "quem são todas as pessoas que estou trabalhando agora?"

2) [P4] Kanban carrega 500 leads de uma tacada sem virtualização
   `Leads.tsx` linha com `const limit = viewMode === 'kanban' ? 500 : 50` — hardcoded.
   Com volume de dados real, isso trava o browser ao renderizar o board.

Critérios de pronto:
- Página `Proprietarios.tsx` renderiza em `/dashboard/proprietarios`
- Header: título "Proprietários", subtítulo descritivo, botão "Novo Proprietário"
- Métricas: chips com contagem por estágio (Em Prospecção / Respondeu / Qualificados / Captados)
- Filtros: tabs de estágio + select de campanha + input de busca (debounce 400ms)
- View Kanban (padrão): colunas por estágio, não por StatusLead. Cada coluna carrega 20 cards com scroll infinito independente (não carrega 500 de uma vez)
- View Lista (toggle): tabela compacta com colunas: Nome, Campanha, Estágio, Temperatura, Última interação
- Card do Proprietário: nome, campanha de origem, telefone, estágio badge, temperatura (🔥/⚡/❄️), tempo desde última interação
- Clicar no card navega para `/dashboard/proprietarios/:id`
- Hook `useProprietarios` encapsula fetch, paginação, filtros e recarregamento
- Kanban com colunas paginadas: `GET /api/proprietarios?estagio=Em Prospecção&page=1&limit=20`

Restrições:
- Não alterar `MissionControlLeads.tsx` nem `Leads.tsx` nesta tarefa (será feito na TAREFA_06)
- Não alterar `KanbanLeads.tsx` de forma que quebre o uso atual em `Leads.tsx`/`MissionControlLeads.tsx` — criar nova prop `paginadoPorColuna?: boolean` que ativa o novo comportamento sem remover o antigo
- Reutilizar componentes existentes: `CardLeadPriorizado`, `EstadoListaLeads`, `BarraComando` onde possível
- Não criar CSS customizado — usar apenas classes Tailwind existentes no projeto
- Manter o padrão de loading: `Loader2` com `animate-spin` (padrão do projeto)

Validação:
- Rodar: acessar `/dashboard/proprietarios` → página carrega sem erros no console
- Testar cenário: com 0 proprietários → estado vazio com CTA "Novo Proprietário"
- Testar cenário: filtrar por estágio "Qualificados" → apenas proprietários com `virouLead: true`
- Testar cenário: filtrar por campanha específica → apenas proprietários daquela campanha
- Testar cenário: scroll infinito no Kanban → ao chegar no fim de uma coluna, carrega mais 20 sem recarregar outras colunas
- Testar cenário: buscar por nome → debounce de 400ms + resultados corretos
- Testar cenário: clicar num card → navega para `/dashboard/proprietarios/:id`

Entrega:
- Primeiro criar `useProprietarios.ts` com o hook e mostrar a tipagem dos dados retornados.
- Depois criar `Proprietarios.tsx` com view Lista funcionando.
- Por último adicionar view Kanban paginado e mostrar diff do KanbanLeads.
