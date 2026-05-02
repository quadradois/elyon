# 03 - Backlog Priorizado

## Critério

Priorização por impacto x esforço, considerando risco operacional, compliance, confiança do lead e estabilidade técnica.

## P0 - Antes De Qualquer Expansão De Autonomia

| ID | Item | Impacto | Esforço | Critério de aceite |
|---|---|---:|---:|---|
| P0-01 | Padronizar `contatoId`/`leadId` em `converter_para_lead`. | Muito alto | Médio | Tool chama use case com contrato correto; testes cobrem sucesso, ID inválido e idempotência. |
| P0-02 | Padronizar `contatoId`/`leadId` em `qualificar_lead`. | Muito alto | Médio | Orquestrador e tool resolvem entidade correta; sem falha por tabela errada. |
| P0-03 | Persistir opt-out no caminho de guardrail. | Muito alto | Baixo/Médio | Ao detectar opt-out, lead/contato é marcado e conversa encerrada. |
| P0-04 | Validar tenant ownership em tools sensíveis. | Muito alto | Médio | Toda tool com efeito colateral valida `{ id, tenantId }`. |
| P0-05 | Bloquear ações irreversíveis sem approval/policy. | Muito alto | Médio | CRM, contrato e CAPTADO exigem estado mínimo e autorização determinística. |

## P1 - Estabilização Operacional

| ID | Item | Impacto | Esforço | Critério de aceite |
|---|---|---:|---:|---|
| P1-01 | Handoff humano real e rastreável. | Alto | Médio | Comprador/humano cria tarefa, notificação e SLA ou não promete transferência. |
| P1-02 | Reclassificar agendamento local. | Alto | Baixo | Sem Calendar ativo, mensagem diz “solicitação registrada”, não “confirmado”. |
| P1-03 | Atualizar tests structured output para SDR atual. | Médio | Baixo | Testes importam/espelham `SdrOutputSchema`, não Opener/Presenter legados. |
| P1-04 | Remover/limitar CoT em logs. | Médio | Baixo | Logs armazenam justificativa curta, sem raciocínio interno detalhado. |
| P1-05 | Definir política de disclosure de IA. | Alto | Médio | Prompt e skills alinhados com política aprovada. |

## P2 - Qualidade E Produto

| ID | Item | Impacto | Esforço | Critério de aceite |
|---|---|---:|---:|---|
| P2-01 | Criar evals conversacionais multi-turno. | Alto | Médio | Suite cobre descoberta, SPIN, objeção, agendamento, opt-out e humano. |
| P2-02 | Refinar prompt do Admin para uma pergunta por mensagem. | Médio | Baixo | Nenhum exemplo viola regra de WhatsApp. |
| P2-03 | Melhorar score/confiança da estimativa de preço. | Médio | Médio | Tool retorna confiança, fontes e fallback claro. |
| P2-04 | Criar painel de métricas por fase. | Médio | Médio | Taxa de fallback, tool failure, handoff e repetição visíveis por tenant. |

## P3 - Otimização E Aprendizado

| ID | Item | Impacto | Esforço | Critério de aceite |
|---|---|---:|---:|---|
| P3-01 | Ativar Learning Bank com governança. | Médio | Médio | Primeiro em shadow, depois A/B com limites. |
| P3-02 | Ativar PAOL apenas com baseline. | Médio | Médio | Sem influenciar ação crítica sem policy. |
| P3-03 | Limpar aliases legados de skills. | Baixo | Baixo | Sem quebra de compatibilidade. |

## Sequência Recomendada

1. Implementar P0-01 e P0-02 juntos, pois ambos tratam identidade de entidade.
2. Implementar P0-03 em seguida, por risco de compliance.
3. Implementar P0-04 antes de qualquer deploy amplo.
4. Implementar P0-05 antes de liberar CRM/contrato/CAPTADO autônomos.
5. Só então avançar para P1.
