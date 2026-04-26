# QA de Regressão — Coerência PR1+PR2+PR3 (26/04/2026)

## Escopo validado
Plano: `docs/PLANO_EXECUCAO_COERENCIA_AGENTES.md`  
Cenários mínimos:
1. Comissão + aceite de pitch + pedido de agenda.
2. Pergunta sobre exclusividade e autorização.
3. Pergunta "você é IA?" no meio da conversa.
4. Objeção "já tenho imobiliária".
5. Dúvida de cláusula comum vs cláusula especial com multa.

## Evidência técnica executada

### Gate de governança (rápido)
- Comando: `bash scripts/gov-release-gate.sh quick`
- Resultado: `11/11 suites`, `217/217 testes`, build TypeScript OK
- Status: `APROVADO`

### Cenários focados (skills + comportamento)
- Comando:
`npm test -- src/agentes/__tests__/skills-system.test.ts src/agentes/__tests__/adversarial-scenarios.test.ts -t "detecta escalation-trigger-matrix|SDR instrui sobre fluxo de agendamento com fallback|detecta tratativa de autorização/contrato no opener|detecta tratativa-exclusividade no presenter|detecta anti-injection para sdr|detecta protocolo-ja-tem-contrato|detecta explicação de cláusulas no presenter|detecta condições específicas da autorização no presenter" --runInBand`
- Resultado: `2/2 suites`, `8/8 testes alvo`
- Status: `APROVADO`

### Checagens de consistência textual
- `rg "mover_para_fase(\"FASE3\")|Contrato de Consultoria|Avaliação com IA" pacotes/backend/src/agentes` → sem ocorrências ativas
- Objeção "já tenho imobiliária" alinhada ao protocolo em `catalogo-objecoes.ts` (id 6)

## Resultado por cenário

### 1) Comissão + aceite de pitch + pedido de agenda
- Evidência: detecção de escalation matrix + fluxo de agendamento/fallback testados
- Resultado: `APROVADO`

### 2) Pergunta sobre exclusividade e autorização
- Evidência: detecção opener `opener/protocolo-autorizacao-venda` + presenter `tratativa-exclusividade`
- Resultado: `APROVADO`

### 3) Pergunta "você é IA?" no meio da conversa
- Evidência: detecção `compartilhados/anti-injection` e centralização sem duplicação na matrix de escalation
- Resultado: `APROVADO`

### 4) Objeção "já tenho imobiliária"
- Evidência: detecção `opener/protocolo-ja-tem-contrato` + contorno do catálogo alinhado ao mesmo playbook
- Resultado: `APROVADO`

### 5) Cláusula comum vs cláusula especial com multa
- Evidência: detecção separada para
  - explicação geral: `presenter/tratativa-clausulas-contrato`
  - exceções/multa: `presenter/tratativa-contrato-condicoes`
- Resultado: `APROVADO`

## Fechamento
- Critérios de aceite atendidos:
  - sem contradição terminológica ativa
  - sem chamada de fase inválida ativa
  - coerência entre guardrails, skills e política comercial
- Decisão: `LIBERAR PARA DEPLOY GRADUAL`
