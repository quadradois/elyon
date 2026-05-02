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

## Revalidacao Pos-Estabilizacao

- `src/casos-de-uso/agentes/__tests__/converter-para-lead.usecase.test.ts` -> **PASS (6/6)**

Leitura tecnica:

- A suite foi realinhada ao contrato canônico atual (entidade `lead`).
- Reexecução sequencial confirmou estabilidade funcional nos testes críticos pós-P0.

## Reavaliacao Dos Riscos Criticos P0

- R-CRIT-01 (`contatoId` vs `leadId` em conversao): **Mitigado**.
- R-CRIT-02 (`qualificar_lead` com entidade errada): **Mitigado**.
- R-CRIT-03 (opt-out sem persistencia no guardrail): **Mitigado**.
- R-CRIT-04 (cross-tenant em tools sensiveis): **Mitigado**.
- R-CRIT-05 (CRM/contrato/CAPTADO sem policy): **Mitigado** com policy deterministica + aprovacao humana.

## Condicoes Obrigatorias Para Piloto

1. Manter `AGENT_REQUIRE_MANUAL_APPROVAL_*` habilitado para CRM/contrato/CAPTADO.
2. Manter `AGENT_AUTO_CAPTADO_AFTER_CRM=false` ate estabilidade operacional comprovada.
3. Manter monitoramento de estabilidade de testes em execucao sequencial no CI quando houver suites longas.
4. Monitorar taxa de bloqueio por `TENANT_OWNERSHIP_DENIED` e `MANUAL_APPROVAL_REQUIRED` por tenant/campanha.

## Decisao

- **Go (piloto controlado): SIM**
- **Go (autonomia plena): NAO**

## Proximo Passo Recomendado

Executar piloto controlado de 7 dias com monitoramento reforçado, focando em:

- taxa de bloqueio por policy (`MANUAL_APPROVAL_REQUIRED`) e ownership (`TENANT_OWNERSHIP_DENIED`);
- taxa de fallback e handoff por fase do funil;
- revisão diária de eventos de bloqueio de ações irreversíveis.
