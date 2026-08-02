# Quickstart: Validation of Agenda Lifecycle

## Preconditions

- Banco de teste isolado e migrado; nunca usar produção ou base compartilhada.
- Relógio controlável nos testes.
- Feature flags de efeitos externos desligadas.
- Dois tenants de teste para validar isolamento.

## Automated gates

1. Executar testes unitários da política temporal e máquina de estados.
2. Executar testes de integração dos comandos, concorrência, idempotência, ledger e outbox.
3. Executar testes das rotas e ferramentas do agente.
4. Executar testes do frontend para ações permitidas e mensagens.
5. Executar a matriz de 40 cenários da auditoria.
6. Executar lint, typecheck e build de backend/frontend.

## Critical manual rehearsal

Use `now = 2026-08-03T11:00:00Z` (08:00 em São Paulo):

1. Compromisso 08:01: cancelar deve funcionar antes do início.
2. Avançar para 08:01: cancelar e reagendar devem falhar; realizar e não compareceu devem aparecer.
3. Repetir cinco vezes o mesmo comando com a mesma chave: um único fato e um único efeito lógico.
4. Enviar dois comandos conflitantes com a mesma versão: apenas um deve vencer.
5. Solicitação sem responsável/fallback: deve aparecer na fila, sem confirmação ao Lead.
6. Proposta do operador: deve aguardar aceite do Lead.
7. Escolha explícita do Lead: deve aguardar especialista, sem segundo aceite do Lead.
8. Tentar acessar o compromisso pelo segundo tenant: resposta não deve revelar nem alterar o registro.

## Timed usability rehearsal

1. Entregar ao operador um compromisso vencido ainda sem desfecho.
2. Iniciar o cronômetro quando a lista da Agenda estiver visível.
3. Encerrar quando `REALIZADO` ou `NAO_COMPARECEU` estiver persistido e confirmado na tela.
4. Repetir cinco vezes com operadores representativos; todas as execuções devem terminar em menos de dois minutos e sem auxílio técnico.

## Local performance rehearsal

1. Preparar massa isolada com compromissos ativos e histórico representativo.
2. Executar no mínimo 1.000 decisões/comandos locais, sem incluir latência de WhatsApp ou Calendar.
3. Registrar p50, p95, p99, taxa de erro e conflitos esperados.
4. O p95 do comando local deve permanecer abaixo de 300 ms e a listagem não pode apresentar regressão estatisticamente relevante contra o baseline registrado.

## Pilot entry criteria

- Todos os checks e 40 cenários verdes.
- Nenhum escritor direto de estado fora do serviço central.
- Dashboard com rejeições, conflitos, duplicatas e vencidos sem desfecho.
- Runbook de rollback testado em homologação.
- Tenant piloto, responsáveis e janela de observação definidos.

## Pilot exit/rollback

Desligar a flag se houver transição temporal inválida, confirmação falsa, quebra de isolamento, duplicação de efeito ou crescimento não explicado da outbox. Preservar dados e exportar IDs de correlação para análise; não executar rollback destrutivo de schema.

## Wave 0 checkpoint — 2026-08-01

- Política temporal: 41 testes de fundação aprovados.
- Fronteiras cancelar/reagendar: 6 testes aprovados.
- Ferramenta do agente: 2 testes aprovados (`APPOINTMENT_STARTED` e conflito de versão).
- Frontend/API Agenda: 5 testes aprovados para `allowedActions` e contrato existente.
- Suíte comercial PostgreSQL isolada: 35/35 testes aprovados.
- Migration `20260801190000_agenda_lifecycle` aplicada com sucesso em PostgreSQL 15/pgvector isolado.
- Builds backend e frontend aprovados; nenhum efeito externo ou ambiente de produção foi ativado.

## Wave 1 checkpoint — 2026-08-01

- Endpoint canônico de visão e comandos com contrato HTTP validado: 4/4 testes.
- Concorrência: duas transições com a mesma versão resultam em um vencedor e uma rejeição; cinco replays geram um único fato.
- Guard arquitetural dos adaptadores: 5/5 testes.
- Matriz holística: 40/40 cenários, mais verificação de cardinalidade.
- Regressão comercial da Agenda em PostgreSQL isolado: 35/35 testes.
- Backend completo: 120 suítes e 1.057 testes aprovados.
- Frontend completo: 9 arquivos e 33 testes aprovados.
- Privacidade da observabilidade: reason codes não fechados viram `unknown`; PII não entra em labels.
- Benchmark local do envelope + política (5.000 iterações): p50 0,0058 ms; p95 0,0111 ms; p99 0,0289 ms.
- Builds de backend e frontend aprovados; `git diff --check` aprovado.
- Migração expand-only reaplicada com sucesso no PostgreSQL isolado.
- Flags continuam desligadas e nenhum efeito/ambiente de produção foi ativado.

## Pendências externas

- T059: ensaio cronometrado requer cinco operadores reais; protocolo está definido acima, mas não foi simulado como se fosse evidência humana.
- T062/T063: ativação das Ondas 0 e 1 exige autorização operacional no momento da execução, tenant/corte aprovados e janela observada.
