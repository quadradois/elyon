# Tarefa: Frontend — Reorganização do Sidebar & Rotas

Base:
- docs/raio-x/RAIO_X_LEADS_CONTATOS.md

Escopo alvo:
- pacotes/frontend/src/layouts/LayoutDashboard.tsx
- pacotes/frontend/src/App.tsx
- pacotes/frontend/src/paginas/detalhes-campanha/CampanhaDetalhes.tsx

Problemas críticos (ordem):

1) [P5-nav] Sidebar fragmenta o funil em 3 seções desconexas
   "Prospecção com IA" e "Listas" ficam numa seção, "Campanhas" e "Leads" em outra.
   São partes do mesmo funil mas o corretor precisa pular entre seções para acompanhar
   uma única pessoa do início ao fim.

2) [P5-nav] Rota `/campanhas/:cid/contatos/:ctid` tem 3 níveis de profundidade
   Interna e externamente referenciada. Precisa de redirect para `/proprietarios/:ctid`.

3) [P5-nav] "Listas" como item autônomo no menu adiciona etapa desnecessária
   O fluxo correto é: Mineração → Campanha (com importação de Lista dentro dela).
   Listas como item de menu de primeiro nível cria a impressão de ser um módulo independente.

Critérios de pronto:
- Sidebar tem 4 seções: **Captação** (Mineração, Campanhas), **Funil** (Proprietários, Agenda), **Gestão** (Carteira, Relatórios, Cockpit IA), **Config** (Agentes, WhatsApp, Configurações, Créditos)
- "Prospecção com IA" (`/captacao`) removido do menu — rota mantida com redirect para `/mineracao`
- "Listas" removido do menu principal — funcionalidade preservada dentro de CampanhaDetalhes
- "Leads" e "Conversas" removidos como itens autônomos — substituídos por "Proprietários"
- Redirects em `App.tsx`: `/leads` → `/proprietarios`, `/leads/:id` → `/proprietarios/:id`, `/campanhas/:cid/contatos/:ctid` → `/proprietarios/:ctid`, `/captacao` → `/mineracao`
- `CampanhaDetalhes.tsx` possui botão "Importar de Lista" visível e funcional na aba principal (o `ModalImportarLista` já existe — apenas expor o acesso)
- Item "Proprietários" no sidebar fica ativo (highlight) quando a rota atual for `/proprietarios` ou `/proprietarios/:id`
- Nenhum link interno no codebase aponta para rotas antigas (verificar com grep)

Restrições:
- Não alterar a lógica de autenticação nem o sistema de collapse do sidebar (`elyon_sidebar_collapsed` no localStorage)
- Não remover as rotas antigas do `App.tsx` — apenas adicionar `<Navigate>` como elemento de redirect (as rotas precisam existir para o redirect funcionar)
- Não alterar CampanhaDetalhes além de expor o botão de importar lista (sem refatorar a página inteira)
- Manter a rota `/dashboard/listas/:id` funcionando (apenas sem link no menu)
- Não alterar rotas do painel admin (`/admin/*`)

Validação:
- Rodar: acessar `/dashboard/leads` → redireciona automaticamente para `/dashboard/proprietarios`
- Rodar: acessar `/dashboard/leads/abc123` → redireciona para `/dashboard/proprietarios/abc123`
- Rodar: acessar `/dashboard/campanhas/X/contatos/Y` → redireciona para `/dashboard/proprietarios/Y`
- Rodar: `grep -r "/dashboard/leads" pacotes/frontend/src --include="*.tsx" --include="*.ts"` → retornar 0 ocorrências de links hardcoded (exceto nos próprios arquivos de redirect)
- Testar cenário: clicar em "Proprietários" no sidebar → vai para `/proprietarios` e item fica destacado
- Testar cenário: em CampanhaDetalhes, clicar "Importar de Lista" → modal de importação abre normalmente
- Testar cenário: sidebar collapse/expand preserva estado no localStorage igual ao comportamento atual

Entrega:
- Primeiro mostrar o diff de `LayoutDashboard.tsx` com nova estrutura de menu antes de aplicar.
- Depois aplicar redirects em `App.tsx` e confirmar com os testes de rota.
- Por último expor o botão de lista em `CampanhaDetalhes.tsx`.
