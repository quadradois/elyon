# Checklist de Qualidade — Leads & Contatos

## Definition of Ready (antes de começar uma tarefa)

- Escopo da tarefa está claro e sem ambiguidade
- Arquivos alvo confirmados
- Critérios de pronto entendidos
- Restrições técnicas entendidas
- Cenários de validação definidos

## Definition of Done (para concluir uma tarefa)

- Implementação completa do escopo da tarefa
- Critérios de pronto atendidos
- Testes/cenários da própria tarefa executados
- Sem regressão nos fluxos existentes citados na tarefa
- Evidências registradas no `STATUS_EXECUCAO.md`

## Checklist de PR

- Branch segue padrão `feat/raio-x-tXX-<slug>`
- Commits possuem escopo claro
- PR descreve claramente o que mudou e por quê
- Inclui passo a passo de validação
- Inclui resultado dos cenários críticos
- Inclui risco residual e plano de rollback

## Checklist técnico transversal

- Backend:
  - `prisma validate` sem erro
  - Sem uso de `$queryRawUnsafe`
  - Endpoints legados preservados quando exigido

- Frontend:
  - Rotas novas funcionando
  - Redirects sem loop
  - Sem erro no console em cenários principais

- Dados:
  - Migrations reversíveis/documentadas
  - Queries de conferência executadas
  - Ausência de status deprecated (quando aplicável)

## Go/No-Go para produção

- Todos os itens T01-T07 em `DONE`
- T07 sem falha em cenário crítico
- Sem bloqueio aberto de severidade alta
- Aprovado por responsável técnico e produto
