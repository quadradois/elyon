# 01 - RAIO-X IA / Agentes

Data: 2026-05-02  
Escopo: `/root/elyon/pacotes/backend/src/agentes`  
Modo: análise e recomendação, sem alteração de código.

## 1. Resumo Executivo

O módulo de agentes do backend Elyon apresenta uma arquitetura relativamente madura para agente comercial imobiliário: usa OpenAI Agents SDK, structured outputs, tools com pré-validação, memória via Redis, filtros de resposta, handoff e telemetria.

A avaliação recomenda **No-Go para autonomia plena** no estado atual. O sistema pode evoluir para piloto controlado, mas apenas após resolver riscos críticos relacionados a identidade de registros (`contatoId` vs `leadId`), persistência de opt-out, isolamento por tenant e ações irreversíveis executadas por tools.

### Fatos

- Existem dois agentes principais: `SDR` e `ADMIN`.
- Existe um `knowledge_agent` exposto como tool do SDR.
- O orquestrador executa guardrails, monta contexto, injeta skills/objeções/sentimento, executa o agente e filtra a resposta.
- Tools podem alterar banco, mover fase, gerar contrato, agendar, enviar CRM e criar leads indicados.

### Hipóteses

- O sistema foi desenhado para captação outbound de proprietários imobiliários.
- Os maiores riscos operacionais estão menos no prompt e mais nos contratos de tool/use case.
- A autonomia atual é adequada para conversação assistida, mas não para ações irreversíveis sem policy engine ou aprovação humana.

## 2. Objetivo Real Do Agente

O objetivo real do agente é conduzir um proprietário frio até uma oportunidade captável e operacionalizável.

| Etapa | Objetivo |
|---|---|
| Prospecção | Abrir conversa e reduzir resistência inicial. |
| Descoberta | Confirmar intenção, valor, ocupação, metragem e status de anúncio. |
| Diagnóstico SPIN | Mapear situação, problema, implicação e necessidade. |
| Pitch | Apresentar modelo comercial conectado às dores do lead. |
| Agendamento | Marcar atendimento com corretor humano. |
| Onboarding | Coletar documentos, contrato, dados do imóvel e CRM. |

Evidência: `/root/elyon/pacotes/backend/src/agentes/sdr-agent.ts:65` define a missão completa do SDR.

## 3. Arquitetura Atual

| Componente | Papel |
|---|---|
| `orchestrator.ts` | Controla o turno e coordena guardrails, memória, execução, filtros e telemetria. |
| `sdr-agent.ts` | Agente comercial principal: prospecção, descoberta, SPIN, pitch e agendamento. |
| `admin-agent.ts` | Agente operacional: onboarding, contrato, dados do imóvel e CRM. |
| `knowledge-agent.ts` | Subagente consultivo para objeções e dados de empreendimentos. |
| `agent-chain.ts` | Cria cadeia de agentes, cache e handoff SDR -> ADMIN. |
| `input-builder.ts` | Monta input com histórico, lead record, briefing, estado e guardrails. |
| `conversation-cache.ts` | Redis/fallback para histórico, schema state e agente ativo. |
| `response-filters.ts` | Sanitiza resposta final e aplica fallback. |
| `tool-wrapper.ts` | Pré-validação, enriquecimento de erro e auditoria de tools. |

## 4. Fluxo Operacional Atual

1. `processarMensagemOrquestrada` recebe mensagens, config e contexto.
2. `executarGuardrailsEntrada` avalia blacklist, spam, opt-out e comprador.
3. O orquestrador resolve agente inicial por status/cache.
4. `construirInputSdk` monta histórico e contexto.
5. São injetadas instruções táticas: sentimento, objeção, skill, learning bank e PAOL quando habilitados.
6. `executarAgenteComRetry` roda o agente com limite de turnos e fallback de provedor.
7. `persistirHistoricoSdk` salva histórico e métricas de tools/handoff.
8. `extrairRespostaECot` extrai structured output.
9. `aplicarFiltrosRespostaOrchestrator` limpa resposta final.
10. Telemetria e outcomes são registrados.

Evidências principais:

- `/root/elyon/pacotes/backend/src/agentes/orchestrator.ts:160`
- `/root/elyon/pacotes/backend/src/agentes/orchestrator.ts:202`
- `/root/elyon/pacotes/backend/src/agentes/orchestrator.ts:578`
- `/root/elyon/pacotes/backend/src/agentes/orchestrator.ts:655`

## 5. Persona E Qualidade Conversacional

### Pontos fortes

- Persona clara: corretor/consultor humano com tom de WhatsApp.
- Regras explícitas: uma pergunta por mensagem, máximo 3 linhas, sem jargão, ler histórico antes de responder.
- Filtros pós-resposta reduzem vazamento de metadados, CoT, narração de handoff e linguagem inadequada.

### Riscos

- A instrução de não revelar identidade como IA cria risco ético/compliance em outbound.
- O `ADMIN` ainda contém um exemplo com várias perguntas numa única mensagem, em conflito com a regra de WhatsApp.
- A persona busca parecer humana demais, o que pode aumentar desconfiança se o lead perguntar diretamente se é IA.

## 6. Tools Disponíveis E Riscos

| Tool | Função | Risco |
|---|---|---|
| `ler_skill` | Carrega playbook Markdown. | Baixo |
| `qualificar_lead` | Atualiza/cria lead e dados SPIN. | Alto |
| `converter_para_lead` | Promove contato/lead. | Crítico |
| `registrar_optout` | Marca opt-out. | Alto |
| `agendar_followup` | Agenda recontato. | Médio |
| `mover_para_fase` | Move status/fase. | Alto |
| `registrar_indicacao` | Cria lead indicado. | Alto |
| `atualizar_dados_lead` | Atualiza CPF/email/endereço. | Alto |
| `agendar_reuniao_closer` | Agenda atendimento. | Alto |
| `enviar_link_agendamento` | Gera link fallback. | Médio |
| `consultar_preco_mercado` | Estima valor de mercado. | Médio |
| `encaminhar_corretor` | Pausa IA e cria tarefa humana. | Alto |
| `gerar_link_contrato` | Gera contrato. | Alto |
| `salvar_dados_imovel` | Atualiza dados do imóvel. | Alto |
| `enviar_para_crm` | Envia CRM e tenta mover CAPTADO. | Crítico |

## 7. Autonomia E Limites

### Autonomia atual

O agente pode executar ações com efeito real:

- Atualizar banco.
- Mover funil.
- Criar tarefas.
- Agendar reunião.
- Gerar contrato.
- Enviar CRM.
- Criar contatos por indicação.
- Acionar handoff humano.

### Limites existentes

- `maxTurns = 15` contra loops.
- Pré-validações de agendamento, conversão, follow-up e fase.
- Gate SPIN antes de avanço para fases avançadas.
- CAPTADO exige CRM sincronizado.
- Sanitização de outputs e histórico.

### Limite faltante

Não há, de forma consistente, uma policy engine determinística que autorize todas as ações críticas com base em tenant, fase, evidência e confirmação humana.

## 8. Memória E Contexto

| Tipo | Implementação |
|---|---|
| Histórico SDK | Redis + fallback memória, TTL de 6h, até 80 itens. |
| Agente ativo | Redis + fallback memória, TTL de 24h. |
| Schema state | Redis e persistência parcial no lead. |
| Briefing/RAG | Perfil do tenant, briefing de empreendimento, knowledge agent e skills Markdown. |

Ponto forte: o input builder injeta estado resumido e guardrails de não repetição.

Ponto fraco: há complexidade e ambiguidade entre `contatoId`, `leadId`, `leadRecord`, `contato` e `lead`.

## 9. Handoff Humano

Há dois mecanismos:

| Mecanismo | Descrição |
|---|---|
| Handoff SDK | SDR -> ADMIN. |
| Handoff humano | Tool `encaminhar_corretor`, muda `modoAtendimento` para `HUMANO` e cria tarefa. |

Risco: o guardrail de comprador promete encaminhar para corretor, mas não executa necessariamente a tool de handoff humano.

## 10. Riscos Críticos, Altos, Médios E Baixos

Resumo completo em `02-matriz-riscos.md`.

### Críticos

- Inconsistência `contatoId` vs `leadId` em tools/use cases.
- Opt-out via guardrail pode não ser persistido.
- Falta validação explícita de tenant ownership em tools sensíveis.
- Ações irreversíveis (`enviar_para_crm`, contrato, CAPTADO) dependem demais de decisão do agente.

### Altos

- Handoff humano pode ser prometido sem execução real em alguns caminhos.
- Agendamento local pode parecer confirmação operacional completa.
- Persona oculta IA/handoff, gerando risco de confiança/compliance.

### Médios

- Estimativa de mercado usa heurísticas amplas.
- Testes structured output ainda têm legados Opener/Presenter.
- PAOL deve ficar restrito enquanto não houver baseline robusto.

### Baixos

- Aliases legados de skills e terminologia podem gerar ruído.
- Alguns exemplos de prompt conflitam com regra de uma pergunta por mensagem.

## 11. Gaps Funcionais

- Opt-out transacional no caminho de guardrail.
- Handoff humano real e rastreável para comprador/desvio de persona.
- Confirmação humana para CRM/contrato/CAPTADO.
- UX clara para Google Calendar indisponível.
- Política explícita de quando a IA deve parar definitivamente.

## 12. Gaps Técnicos

- Contratos inconsistentes entre tools e use cases.
- Ausência de tenant ownership em camada de tool/use case.
- Logs podem carregar PII e raciocínio interno.
- Testes ainda não cobrem todos os fluxos multi-turno reais.
- Dependência de prompt para decisões críticas.

## 13. Gaps De Produto/UX

- Disclosure de IA não está resolvido.
- Handoff invisível pode melhorar fluidez, mas reduz transparência.
- Admin coleta dados demais em uma mensagem no exemplo de prompt.
- Falta fallback produto para “quero falar com humano agora”.

## 14. Oportunidades De Melhoria

1. Unificar contratos de identidade (`Contato`, `Lead`, `Prospect`) e IDs.
2. Criar camada `ToolPolicy` para autorização antes de qualquer efeito colateral.
3. Separar “resposta sugerida” de “ação executada”.
4. Transformar opt-out e handoff humano em fluxos determinísticos fora do LLM.
5. Introduzir evals multi-turno com rubricas.
6. Remover CoT de logs e substituir por justificativa resumida segura.

## 15. Testes Recomendados

Ver `05-testes-recomendados.md`.

## 16. Matriz Impacto x Esforço

Ver `03-backlog-priorizado.md`.

## 17. TO-BE Recomendado

Ver `04-plano-evolucao.md`.

## 18. Plano De Evolução Por Fases

Ver `04-plano-evolucao.md`.

## 19. Go / No-Go

Status atual: **No-Go para autonomia plena**.

Go condicional para piloto controlado somente se:

- P0 resolvidos.
- Monitoramento humano ativo.
- Ações irreversíveis com aprovação ou policy determinística.
- Testes de regressão multi-turno rodando.

## 20. Recomendação Final

O módulo tem boa base arquitetural, mas precisa endurecer contratos e governança antes de ampliar autonomia. O próximo passo de desenvolvimento deve ser P0 técnico, não nova feature conversacional.
