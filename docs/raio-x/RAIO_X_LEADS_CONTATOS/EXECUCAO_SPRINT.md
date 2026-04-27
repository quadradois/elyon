# Execução da Sprint — Caminho B (Leads & Contatos)

## Objetivo da sprint

Implementar o Caminho B com segurança, mantendo o fluxo outbound do SDR estável e consolidando a experiência em `/proprietarios`.

## Sequência oficial (ordem de execução)

1. **T01 — Foundation DB/Webhook**
   - Corrigir seleção de contato no webhook (P1)
   - Tornar `campanhaId` opcional com migration (P2)
   - Adicionar guard para contato sem campanha (P3)

2. **T02 — API Unificada de Proprietários**
   - Entregar `GET /api/proprietarios`
   - Entregar `GET /api/proprietarios/:id`
   - Entregar `POST /api/proprietarios`

3. **T03 — Página /proprietarios (lista + kanban paginado)**
   - Hook `useProprietarios`
   - Lista funcional
   - Kanban com paginação por coluna

4. **T04 — Detalhe /proprietarios/:id**
   - Visão unificada Contato/Lead
   - Abas contextuais por estágio

5. **T05 — Sidebar e Redirects**
   - Nova arquitetura de informação
   - Redirects de rotas legadas

6. **T06 — Cleanup e deprecações**
   - Remover legado de `MissionControlLeads`
   - Migrar/remover status deprecated
   - Ajustar nomenclatura visível para “Proprietário”

7. **T07 — Regressão final do SDR**
   - Validar fluxo crítico ponta a ponta
   - Validar redirects e consistência de estágio

## Gates obrigatórios por fase

### Gate A — Segurança de dados
- Migration validada (`prisma validate`)
- Sem quebra de unique/constraints
- Cenários de concorrência e duplicidade testados

### Gate B — Compatibilidade funcional
- Endpoints existentes continuam respondendo
- Rotas antigas redirecionam sem 404/loop
- Fluxo SDR outbound intacto

### Gate C — Qualidade de entrega
- Critérios de pronto da tarefa atendidos
- Evidência anexada no `STATUS_EXECUCAO.md`
- Riscos remanescentes documentados

## Política de branch e PR

- Branch por tarefa: `feat/raio-x-tXX-<slug>`
- Preferência por commits pequenos e sem mistura de escopo
- PR com:
  - Contexto do problema
  - O que mudou
  - Como validar
  - Evidências (curl/log/print)
  - Riscos e rollback

## Critérios de saída para produção

- T01 a T07 concluídas
- Nenhum cenário crítico da T07 falhando
- Sem status deprecated no banco
- Sem regressão do agente SDR
