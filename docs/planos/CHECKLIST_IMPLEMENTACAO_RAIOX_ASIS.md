# Checklist de Implementação — RAIO-X AS-IS

Data: 2026-04-29  
Referência: `docs/planos/PLAN_IMPLEMENTACAO_RAIOX_ASIS.md`

## 1) Preparação

- [ ] Validar escopo P0/P1/P2 com produto e operação.
- [ ] Definir responsáveis técnicos por épico.
- [ ] Criar feature flags para cada correção crítica.
- [ ] Publicar plano de rollback por correção.

## 2) Épico A — Retorno Humano → IA

- [ ] Implementar gatilho automático de retorno para `modoAtendimento = IA`.
- [ ] Definir regras de elegibilidade de retorno (tempo, status, pendências).
- [ ] Persistir resumo estruturado da negociação humana.
- [ ] Garantir que Admin Agent consuma contexto estruturado na retomada.
- [ ] Registrar auditoria de handoff e retorno.
- [ ] Testar cenário real: humano negocia, IA retoma sem intervenção manual.

## 3) Épico B — Concorrência de conversão

- [ ] Unificar a autoridade de conversão por turno.
- [ ] Bloquear execução simultânea (mutex/chave idempotente por evento).
- [ ] Eliminar janela de corrida entre tool e fallback.
- [ ] Registrar `ALREADY_LEAD` com telemetria.
- [ ] Validar com teste de concorrência (mensagens simultâneas do mesmo contato).

## 4) Épico C — CRM e CAPTADO

- [ ] Remover fallback hardcoded de cidade/estado.
- [ ] Ajustar parse de endereço para retornar `null` quando incompleto.
- [ ] Tratar `null` no payload e no contrato de integração CRM.
- [ ] Inverter fluxo: `CAPTADO` somente após sucesso de `enviar_para_crm`.
- [ ] Implementar retry com backoff para falhas transitórias.
- [ ] Validar que não há lead `CAPTADO` sem CRM sincronizado.

## 5) Épico D — Histórico, state e cache

- [ ] Definir fallback de histórico quando Redis expirar.
- [ ] Reconstituir tool history mínima a partir de dados persistidos.
- [ ] Garantir atualização de `schemaState` após fase humana.
- [ ] Implementar invalidação de cache de agent-chain por mudança de briefing.
- [ ] Testar reboot/expiração Redis sem regressão de contexto.

## 6) Épico E — Observabilidade e qualidade

- [ ] Instrumentar métricas de retomada IA, erro CRM, retry, conversão e latência.
- [ ] Criar alertas para falhas repetidas de CRM sync.
- [ ] Adicionar suíte E2E dos fluxos críticos.
- [ ] Registrar evidências de homologação por cenário.
- [ ] Executar checklist de go-live antes do deploy.

## 7) Gate de Go-live

- [ ] Todas as falhas críticas (1-5) sem reprodução em homologação.
- [ ] Riscos altos (1-4) com mitigação validada.
- [ ] Métricas e logs disponíveis em dashboard operacional.
- [ ] Plano de rollback testado.
- [ ] Aprovação final de engenharia + operação.
