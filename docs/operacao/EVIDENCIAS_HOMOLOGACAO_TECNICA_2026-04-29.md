# Evidências — Homologação Técnica RAIO-X AS-IS

Data: 2026-04-29
Responsável: Engenharia

## 1) Eventos de observabilidade instrumentados

Confirmação em código (grep):
- `ia_auto_return_triggered` em `pacotes/backend/src/rotas/webhook.ts`
- `conversion_race_prevented` em `pacotes/backend/src/rotas/webhook.ts`
- `crm_sync_retry` em `pacotes/backend/src/servicos/crm-service.ts`
- `crm_missing_location` em `pacotes/backend/src/servicos/crm-service.ts`

## 2) Suíte focada de regressão crítica

Comando executado:
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm test -- --runInBand \
  src/servicos/__tests__/crm-service.test.ts \
  src/casos-de-uso/agentes/__tests__/mover-para-fase.usecase.test.ts \
  src/agentes/__tests__/orchestrator-queries.test.ts \
  src/agentes/__tests__/agent-chain.test.ts \
  src/rotas/__tests__/webhook-resilience.test.ts
```

Resultado:
- `Test Suites: 5 passed, 5 total`
- `Tests: 70 passed, 70 total`

## 3) Build backend

Comando executado:
```bash
npm run build
```

Resultado:
- Build TypeScript concluído com sucesso.

## 4) Conclusão técnica

- Falhas críticas 1-5: não reproduzidas na suíte focada de homologação técnica.
- Riscos altos: mitigação implementada e validada por testes + build.
- Pendência externa: aceite de dashboard/alertas com operação.
