# 09 - Plano de Execucao P0 (Sem Alterar Backend)

Data: 2026-05-02
Status: Pronto para iniciar execucao
Escopo: Preparacao operacional para implementar P0 com seguranca

## Objetivo

Definir a sequencia minima e segura para implementar os tickets P0 ja detalhados em `06-tickets-p0.md`, sem misturar escopos e com criterio claro de validacao.

## Premissas (Fatos)

- A auditoria RAIO-X foi concluida e os riscos P0 estao documentados.
- O repositorio esta atualmente com `working tree clean`.
- Existe recomendacao de `No-Go` para autonomia plena ate fechar P0.
- O pacote de testes recomendado ja existe em `05-testes-recomendados.md`.

## Hipoteses Operacionais

- O time vai optar por implementar P0 em branch dedicada.
- A refatoracao ampla `Contato -> Lead` nao sera expandida durante o P0 (somente correcoes necessarias).
- O deploy sera gradual e com feature flags quando aplicavel.

## Sequencia Recomendada (Impacto x Risco)

1. P0-01 Contratos de ID (`contatoId` vs `leadId`)
2. P0-02 Persistencia de opt-out
3. P0-03 Validacao de tenant ownership nas tools sensiveis
4. P0-04 Guardrails de alto impacto com aprovacao/policy deterministica
5. P0-05 Observabilidade e auditoria minima obrigatoria

## Gate de Inicio (Definition of Ready)

Cada ticket P0 so deve iniciar quando:

- Escopo funcional estiver fechado em 1-2 servicos principais.
- Criticos de seguranca e regressao estiverem mapeados.
- Testes de aceitacao do ticket estiverem descritos antes do codigo.
- Dono tecnico e revisor estiverem definidos.

## Gate de Conclusao por Ticket (Definition of Done)

- Testes unitarios/integ. do escopo passam.
- Nao quebra suites de agentes existentes.
- Logs de auditoria minimos ativos para acao sensivel.
- Evidencia de validacao anexada (comandos e resultado).
- Risco residual registrado na matriz de riscos.

## Ordem de Execucao de Testes (por ticket)

1. Testes do modulo alterado.
2. Testes dos casos de uso de agentes.
3. Verificacao de tipos (`tsc --noEmit`).
4. Smoke de frontend/backend impactado.

Referencia: `05-testes-recomendados.md`.

## Criticos de Governanca

- Proibido alterar mais de 1 P0 por PR quando houver risco de regressao cruzada.
- Proibido misturar refatoracao estrutural com correcao de seguranca.
- Obrigatorio registrar decisoes arquiteturais que mudem contratos.

## Decisao Recomendada de Execucao

Status sugerido: **Go para implementar P0 em ondas curtas**, mantendo **No-Go para autonomia plena** ate fechar criterios minimos de P0-01..P0-04.

## Proximo Passo Imediato

Abrir PR/branch da Onda 1 com apenas:

- P0-01 (contrato de ID)
- testes associados
- atualizacao objetiva da matriz de riscos apos merge
