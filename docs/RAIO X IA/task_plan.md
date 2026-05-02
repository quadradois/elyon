# Plano da Auditoria RAIO-X IA / Agentes

## Objetivo

Organizar a avaliação do módulo de agentes e transformar achados em um pacote de decisão pronto para priorização e implementação futura.

## Escopo

Arquivos analisados principalmente:

- `/root/elyon/pacotes/backend/src/agentes`
- `/root/elyon/pacotes/backend/src/ferramentas`
- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes`

## Fases

| Fase | Status | Resultado esperado |
|---|---|---|
| 1. Levantamento de arquitetura | Completo | Mapa de agentes, orquestrador, memória, handoff e tools. |
| 2. Identificação de riscos | Completo | Riscos críticos, altos, médios e baixos classificados. |
| 3. Documentação executiva | Completo | Relatório principal e matriz de riscos nesta pasta. |
| 4. Priorização | Completo | Backlog P0/P1/P2 por impacto x esforço. |
| 5. Plano TO-BE | Completo | Fases de evolução e critérios de aceite. |
| 6. Detalhamento P0 | Completo | Tickets técnicos P0 criados com escopo, evidências e critérios de aceite. |
| 7. Revisão do Git | Completo | Worktree revisado antes de implementação; relatório criado em `07-revisao-estado-git.md`. |
| 8. Code review `Contato -> Lead` | Completo | Refatoração revisada; relatório criado em `08-code-review-refatoracao-contato-lead.md`. |
| 9. Implementação P0 | Pendente | Criar worktree limpo ou estabilizar refatoração antes de alterar backend. |

## Decisões Tomadas

| Decisão | Motivo |
|---|---|
| Concentrar artefatos em `/root/elyon/docs/RAIO X IA` | Organização e rastreabilidade. |
| Não alterar backend nesta etapa | Pedido explícito da auditoria inicial e boa prática antes de implementação. |
| Priorizar P0 antes de qualquer feature | Há riscos operacionais em IDs, opt-out e isolamento por tenant. |

## Próximos Passos Recomendados

1. Revisar `02-matriz-riscos.md` com foco nos riscos críticos.
2. Transformar cada P0 de `03-backlog-priorizado.md` em ticket técnico pequeno. **Concluído em `06-tickets-p0.md`.**
3. Decidir se as mudanças atuais `Contato -> Lead` serão estabilizadas ou isoladas. **Recomendação atual: isolar P0 em worktree limpo e tratar a unificação como épico separado.**
4. Implementar P0 com testes antes/depois, após decisão explícita sobre branch/worktree.
5. Rodar plano de testes de `05-testes-recomendados.md`.
6. Reavaliar Go/No-Go para piloto controlado.
