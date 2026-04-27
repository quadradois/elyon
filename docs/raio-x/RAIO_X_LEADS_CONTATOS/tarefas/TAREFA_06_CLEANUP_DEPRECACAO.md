# Tarefa: Limpeza — Deprecar Código Legado & Status Obsoletos

Base:
- docs/raio-x/RAIO_X_LEADS_CONTATOS.md

Escopo alvo:
- pacotes/frontend/src/paginas/MissionControlLeads.tsx
- pacotes/frontend/src/paginas/Leads.tsx
- pacotes/backend/prisma/schema.prisma
- pacotes/backend/prisma/migrations/ (nova migration)
- pacotes/frontend/src/ (todos os .tsx com string "Contato" visível ao usuário)

Problemas críticos (ordem):

1) [P6] MissionControlLeads importa Leads.tsx legado como lazy component interno
   `const LeadsLegadoLista = lazy(() => import('./Leads'))` dentro de `MissionControlLeads.tsx`
   cria um componente dentro de componente — estado duplicado, lógica duplicada, confusão
   para qualquer desenvolvedor que editar no futuro.

2) [P7] 5 valores de StatusLead deprecated estão vivos no banco e no frontend
   `QUALIFICADO`, `EM_NEGOCIACAO`, `CONTATANDO`, `CONVERTIDO`, `INATIVO` ainda existem
   no enum. Leads com esses status retornam badges com labels de mapeamento legado.
   Queries de filtro podem incluir ou excluir esses status de forma inconsistente.

3) Nomenclatura "Contato" ainda aparece na UI em múltiplos componentes
   Após a reestruturação, o usuário ainda vê "Contato" em labels, headers, toasts e
   placeholders — inconsistente com a nova nomenclatura "Proprietário".

Critérios de pronto:
- `MissionControlLeads.tsx` removido o import lazy de `Leads.tsx` e o viewMode `'lista'`; o componente passa a ter apenas Feed e Kanban (ou pode ser deprecado inteiramente se /proprietarios cobrir todos os casos)
- `Leads.tsx` marcado com comentário `// @deprecated — substituído por Proprietarios.tsx` no topo do arquivo (não deletar ainda — aguardar 1 sprint de observação em produção)
- Migration executa UPDATE de status deprecated: `QUALIFICADO → NOVO`, `EM_NEGOCIACAO → DOCUMENTACAO`, `CONTATANDO → TENTATIVA_AGENDAMENTO`, `CONVERTIDO → CAPTADO`, `INATIVO → ARQUIVADO`
- Enum `StatusLead` no schema remove os 5 valores deprecated após confirmar que 0 leads possuem esses status no banco
- Frontend: todos os `getStatusBadge` aliases legados removidos após migration de banco
- String "Contato" substituída por "Proprietário" nos textos visíveis ao usuário (labels, placeholders, toasts, headers) — sem alterar nomes de variáveis TypeScript nem chamadas de API

Restrições:
- Não deletar `Leads.tsx` nesta tarefa — apenas marcar como deprecated
- Não alterar nomes de variáveis, tipos TypeScript ou parâmetros de API (ex: `contatoId` permanece `contatoId`)
- Fazer backup via migration antes de executar UPDATE de status (comentar o SQL de rollback na migration)
- Não executar a remoção do enum antes de confirmar que 0 leads têm os status deprecated no banco
- Manter o mapeamento legado em `getStatusBadge` até a migration de banco estar aplicada em produção

Validação:
- Rodar antes da migration: `SELECT status, COUNT(*) FROM leads GROUP BY status` → confirmar contagem de leads com status deprecated
- Rodar migration e validar: `SELECT status, COUNT(*) FROM leads GROUP BY status` → 0 ocorrências dos 5 valores deprecated
- Rodar: `npx prisma validate` → sem erros após remoção dos valores do enum
- Rodar: `grep -r "QUALIFICADO\|EM_NEGOCIACAO\|CONTATANDO\|CONVERTIDO\|INATIVO" pacotes/frontend/src --include="*.tsx"` → 0 resultados
- Testar cenário: abrir `/dashboard/proprietarios` e `/dashboard/campanhas` → nenhum badge mostra valor deprecated ou "undefined"
- Testar cenário: filtro por status na listagem de Proprietários funciona corretamente com os novos valores
- Testar cenário: buscar a string "Contato" na UI em produção → nenhum texto visível ao usuário deve usar essa palavra (verificar em telas principais: header, cards, modais)

Entrega:
- Primeiro mostrar o SELECT de contagem dos status deprecated antes de qualquer mudança.
- Depois aplicar a migration de UPDATE e confirmar 0 deprecated.
- Depois remover os aliases legados do frontend e mostrar diff.
- Por último substituir strings "Contato" → "Proprietário" nos textos de UI e mostrar diff.
