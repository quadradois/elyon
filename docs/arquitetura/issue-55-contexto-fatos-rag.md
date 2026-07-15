# Issue #55 — contexto versionado de fatos RAG

## Decisao

O caminho webhook → lote duravel → orquestrador transporta fatos persistidos no
contrato `RagFact@1.0`. Historico, briefing estruturado, fatos RAG e instrucoes
operacionais permanecem campos e secoes distintos. IDs internos participam de
deduplicacao e desempate, mas nunca sao formatados no prompt.

Cada fato informa conteudo, origem, instante de recuperacao, instante da fonte
quando conhecido, confianca, tenant, `leadId`, validade opcional, relevancia e
versao. `Lead.id` e a identidade canonica. Tenant e Lead sao obtidos da sessao
Evolution confiavel e do Lead resolvido pelo fluxo; texto do modelo nunca amplia
esse escopo.

## Policy deterministica

Defaults iniciais: confianca minima `0.70`, no maximo 5 fatos e 4.000 caracteres.
A ordenacao usa relevancia, confianca, temporalidade e ID interno como desempate
estavel. Sao descartados, com reason code, fatos invalidos, cross-tenant,
cross-Lead, expirados, abaixo da confianca e excedentes dos limites. O mesmo lote
e o mesmo conjunto persistido produzem a mesma secao de prompt.

Fatos sao evidencias potencialmente incompletas ou desatualizadas. Eles nao
autorizam tools ou mutacoes, nem substituem confirmacao do usuario em operacoes
sensiveis. Essa regra integra a propria secao entregue ao agente.

## Seguranca e observabilidade

As metricas `elyon_rag_facts_recovery_total`,
`elyon_rag_facts_selected_total`, `elyon_rag_facts_discarded_total` e
`elyon_rag_facts_truncated_total` registram apenas contagens e reason codes. Logs
de falha nao incluem texto, telefone, UUID ou conteudo recuperado. Ausencia ou
falha do RAG degrada para historico e briefing, sem interromper o atendimento.

## Evidencias

- unitarios cobrem isolamento, expiracao, confianca, ordenacao, truncamento e
  ausencia de ID interno no prompt;
- baseline PostgreSQL/pgvector e Redis reais substitui XF-B05 por gate positivo,
  atravessando o caminho real ate o contexto do orquestrador;
- doubles impedem chamadas externas e comprovam as fronteiras entre historico,
  briefing e fatos.

## Riscos, rollout e rollback

Riscos principais: perda de recall pelo filtro estrito, aumento de tokens e
fontes antigas sem `leadId`. O rollout deve observar descartes por reason code,
latencia e truncamento antes de ajustar os defaults. Fontes sem identidade
canonica ficam fail-closed.

Rollback: desabilitar a recuperacao no chamador e voltar ao fluxo degradado de
historico + briefing. O contrato nao cria schema nem migration e sua retirada nao
afeta a consolidacao duravel da #54. Nao reintroduzir a string RAG misturada ao
briefing como mecanismo de rollback.
