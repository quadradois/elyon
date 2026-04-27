# Pacote de Execução — Leads & Contatos

Este diretório está organizado para execução técnica com rastreabilidade, qualidade e previsibilidade.

## Ordem recomendada de uso

1. **Contexto e decisões**
   - `RAIO_X_LEADS_CONTATOS.md`
2. **Plano operacional da sprint**
   - `EXECUCAO_SPRINT.md`
3. **Tarefas técnicas por frente**
   - `tarefas/TAREFA_01_FOUNDATION_DB_WEBHOOK.md`
   - `tarefas/TAREFA_02_API_PROPRIETARIOS.md`
   - `tarefas/TAREFA_03_PAGINA_PROPRIETARIOS.md`
   - `tarefas/TAREFA_04_DETALHE_PROPRIETARIO.md`
   - `tarefas/TAREFA_05_SIDEBAR_ROTAS.md`
   - `tarefas/TAREFA_06_CLEANUP_DEPRECACAO.md`
   - `tarefas/TAREFA_07_VALIDACAO_REGRESSAO.md`
4. **Controle de execução diária**
   - `STATUS_EXECUCAO.md`
5. **Qualidade e gates de release**
   - `CHECKLIST_QUALIDADE.md`

## Convenções de execução

- Branch por tarefa: `feat/raio-x-tXX-<slug>`
- Commits pequenos e rastreáveis (1 problema crítico por commit quando aplicável)
- PR com evidências: diff, logs, prints e resultados dos cenários de validação
- Sem alterar escopo de tarefa sem registrar em `STATUS_EXECUCAO.md`

## Resultado esperado

Ao final, o time deve conseguir responder rapidamente:
- O que já foi entregue?
- O que está em andamento?
- O que está bloqueado e por quê?
- O que falta para liberar produção com segurança?
