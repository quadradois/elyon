# Checklist Técnica — Execução por Arquivo (RAIO-X AS-IS)

Data: 2026-04-29
Referência: `docs/planos/PLAN_EXECUCAO_TECNICA_RAIOX_ASIS_POR_ARQUIVO.md`

## Sprint 1

### `rotas/webhook.ts`
- [x] Implementar `shouldAutoReturnToIA(...)` com critérios explícitos.
- [x] Atualizar `modoAtendimento` para `IA` quando elegível.
- [x] Registrar auditoria de retorno automático.
- [x] Bloquear fallback de conversão quando orquestrador já decidiu no turno.
- [x] Garantir idempotência por chave de turno/lote.
- [x] Injetar resumo estruturado da fase humana no contexto do orquestrador.

### `agentes/admin-agent.ts`
- [x] Ajustar prompt para exigir `CAPTADO` apenas após `enviar_para_crm` com sucesso.
- [x] Definir instrução explícita para falha de CRM (não avançar fase).

### `ferramentas/sdr-tools-agents.ts`
- [x] Remover bloqueio `status !== 'CAPTADO'` na `enviar_para_crm`.
- [x] Validar pré-condições reais de envio (dados mínimos obrigatórios).
- [x] Bloquear `mover_para_fase(CAPTADO)` sem `crmSyncStatus='synced'`.

### `servicos/crm-service.ts`
- [x] Remover fallback `Goiânia/GO`.
- [x] Retornar/enviar `null` para localização incompleta.
- [x] Adicionar logs estruturados para localização ausente.
- [x] Implementar retry com backoff para falhas transitórias.

## Sprint 2

### `rotas/webhook.ts` + `agentes/orchestrator.ts`
- [x] Implementar fallback DB quando cache Redis estiver vazio.
- [x] Reidratar trilha mínima de tools críticas.
- [x] Reidratar schemaState após fase HUMANO.

### `agentes/agent-chain.ts`
- [x] Incluir versão/hash do briefing no `cacheKey`.
- [x] Invalidar cache ao detectar alteração de briefing/config.

## Sprint 3

### Testes
- [x] Teste: retorno automático HUMANO → IA.
- [x] Teste: CRM retry e recuperação.
- [x] Teste: bloqueio CAPTADO sem CRM sync.
- [x] Teste: concorrência de conversão no mesmo contato.

### Observabilidade
- [x] Emitir `ia_auto_return_triggered`.
- [x] Emitir `conversion_race_prevented`.
- [x] Emitir `crm_sync_retry`.
- [x] Emitir `crm_missing_location`.
- [ ] Validar dashboard/alertas com operação.

## Gate final

- [x] Falhas críticas 1-5 não reproduzem em homologação.
- [x] Riscos altos cobertos por mitigação implementada.
- [x] Evidências de testes anexadas.

## Status atual (2026-04-29)

- Sprint 1 concluída em código e build.
- Sprint 2 concluída em código e build.
- Sprint 3 concluída em código e testes/build (dashboard operacional pendente de validação com operação).
- `jest` focado executado com sucesso:
  - `src/servicos/__tests__/crm-service.test.ts`
  - `src/casos-de-uso/agentes/__tests__/mover-para-fase.usecase.test.ts`
  - `src/agentes/__tests__/orchestrator-queries.test.ts`
  - `src/agentes/__tests__/agent-chain.test.ts`
  - `src/rotas/__tests__/webhook-resilience.test.ts`
- `npm run build` executado com sucesso no backend.
- Gate técnico concluído (falhas críticas e riscos altos validados via suíte focada).
- Pendência externa única: validação de dashboard/alertas com operação.
