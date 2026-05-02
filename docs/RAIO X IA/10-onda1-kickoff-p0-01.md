# 10 - Kickoff Onda 1 (P0-01)

Data: 2026-05-02
Status: Pronto para execucao tecnica
Escopo: preparar implementacao de `P0-01` com baixo risco e alta rastreabilidade

## Objetivo

Executar o primeiro corte de mitigacao critica (`contatoId` vs `leadId`) sem misturar com outras refatoracoes.

## Ticket Alvo

- Referencia: `06-tickets-p0.md` -> `P0-01 - Padronizar contatoId/leadId em converter_para_lead`
- Severidade: Critica
- Resultado esperado: contrato de ID canonico e comportamento idempotente validado por testes

## Branch/PR Strategy

- Branch sugerida: `fix/p0-01-contrato-id-converter-lead`
- Escopo maximo por PR:
  - ajuste de contrato na fronteira tool/use case
  - testes diretos do caso
  - nenhuma mudanca de produto fora do fluxo de conversao

## Checklist De Inicio (Definition of Ready)

- [ ] Dono tecnico da PR definido
- [ ] Revisor tecnico definido
- [ ] Contrato canonico decidido (`leadId` recomendado)
- [ ] Estrategia de compatibilidade com alias legado decidida (`contatoId`)
- [ ] Casos de teste listados antes de editar codigo

## Sequencia Tecnica Recomendada

1. Congelar contrato: escolher campo canonico e documentar no topo da PR.
2. Implementar adapter de entrada na fronteira (`tool -> usecase`) para resolver alias legado.
3. Garantir erro seguro quando nenhum ID valido existir.
4. Garantir idempotencia para entidade ja convertida.
5. Atualizar testes para sucesso, alias, inexistente e idempotencia.

## Comandos De Verificacao (Referencia)

```bash
# Tipagem backend
npx tsc -p pacotes/backend/tsconfig.json --noEmit --pretty false

# Testes direcionados do fluxo de agentes
npm --workspace @elyon/backend run test -- src/casos-de-uso/agentes
```

Se houver suite especifica para `converter-para-lead`, priorizar execucao isolada antes da suite ampla.

## Criterios De Aceite Da Onda 1

- `ConverterParaLeadUseCase` nao recebe `leadId` indefinido no caminho feliz.
- O fluxo aceita alias legado somente como compatibilidade temporaria (se decidido).
- Falha por ID invalido retorna erro claro, sem update parcial.
- Testes do fluxo passam localmente e no CI.
- Matriz de riscos reduz severidade do item de contrato de ID apos merge.

## Riscos Residuals A Vigiar

- Regressao em `qualificar_lead` por compartilhamento de convenções de ID.
- Falso positivo de sucesso quando ID canonico nao e resolvido corretamente.
- Mudancas acopladas com refatoracao `Contato -> Lead` fora do escopo da Onda 1.

## Decisao Operacional

Status: **Go para iniciar Onda 1 (P0-01)** desde que a PR mantenha escopo estrito e passe testes de contrato.
