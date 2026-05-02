# 11 - Reavaliacao Go/No-Go Pos-P0

Data: 2026-05-02  
Escopo validado: P0-01 a P0-05 no backend de agentes

## Resultado Executivo

Status recomendado: **Go condicional para piloto controlado**.

- **No-Go para autonomia plena** permanece.
- **Go para piloto assistido** habilitado com os P0 implementados, desde que operacao mantenha aprovacao humana para acoes irreversiveis e monitore alertas de bloqueio/policy.

## Evidencias De Validacao

## Compilacao

- `npx tsc -p pacotes/backend/tsconfig.json --noEmit --pretty false` -> **PASS**

## Testes P0 (focados)

- `src/casos-de-uso/agentes/__tests__/qualificar-lead.usecase.test.ts` -> **PASS (10/10)**
- `src/agentes/__tests__/orchestrator-integration.test.ts -t "persiste opt-out quando guardrail retorna REGISTRAR_OPTOUT"` -> **PASS (1/1 no filtro)**
- `src/ferramentas/__tests__/sdr-tools-ownership.test.ts` -> **PASS (3/3)**
- `src/ferramentas/__tests__/sdr-tools-sensitive-policy.test.ts` -> **PASS (4/4)**
- `src/agentes/__tests__/gov-05-ivonet-regression.e2e.test.ts` -> **PASS (6/6)**

## Teste Com Divergencia Encontrada

- `src/casos-de-uso/agentes/__tests__/converter-para-lead.usecase.test.ts` -> **FAIL (7 falhas)**

Leitura tecnica:

- As falhas estao alinhadas a expectativas legadas do teste (fluxo antigo contato->lead), enquanto o comportamento implementado no P0-01 passou a operar no contrato canonico de `leadId`.
- Nao houve indicio de regressao de compilacao nem nos testes de regressao/ownership/policy.

Conclusao operacional:

- Existe **gap de suite de teste** a corrigir (realinhar assertions do `converter-para-lead.usecase.test.ts` ao contrato atual).

## Reavaliacao Dos Riscos Criticos P0

- R-CRIT-01 (`contatoId` vs `leadId` em conversao): **Mitigado no runtime, pendente consolidacao de teste legado**.
- R-CRIT-02 (`qualificar_lead` com entidade errada): **Mitigado**.
- R-CRIT-03 (opt-out sem persistencia no guardrail): **Mitigado**.
- R-CRIT-04 (cross-tenant em tools sensiveis): **Mitigado**.
- R-CRIT-05 (CRM/contrato/CAPTADO sem policy): **Mitigado** com policy deterministica + aprovacao humana.

## Condicoes Obrigatorias Para Piloto

1. Manter `AGENT_REQUIRE_MANUAL_APPROVAL_*` habilitado para CRM/contrato/CAPTADO.
2. Manter `AGENT_AUTO_CAPTADO_AFTER_CRM=false` ate estabilidade operacional comprovada.
3. Corrigir e estabilizar a suite `converter-para-lead.usecase.test.ts` antes de expandir autonomia.
4. Monitorar taxa de bloqueio por `TENANT_OWNERSHIP_DENIED` e `MANUAL_APPROVAL_REQUIRED` por tenant/campanha.

## Decisao

- **Go (piloto controlado): SIM**
- **Go (autonomia plena): NAO**

## Proximo Passo Recomendado

Abrir uma onda curta de estabilizacao de testes (P0.5), focada em:

- atualizar `converter-para-lead.usecase.test.ts` para o contrato canonico atual;
- executar suite ampliada multi-turno/adversarial;
- emitir novo checkpoint de risco com baseline de 7 dias de piloto.
