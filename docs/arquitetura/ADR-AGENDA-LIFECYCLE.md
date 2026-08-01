# ADR: autoridade única para o ciclo de vida da Agenda

**Status**: Aceito para implementação incremental
**Data**: 2026-08-01
**Escopo**: Ondas 0 e 1 do ciclo de vida da Agenda

## Contexto

Agenda, ferramentas do agente, links públicos e jobs possuem pontos de escrita distintos. O serviço `coerencia-agenda-estado.ts` já oferece transação serializável, versão, ledger e outbox, porém cancelamento e reagendamento ainda podem ser executados depois do início do compromisso.

## Decisão

1. `AgendaPolicy` é a autoridade pura para estado, fase temporal e ações permitidas.
2. O instante exato de `agendadoPara` inicia a fase `INICIADO`; cancelar e reagendar deixam de ser permitidos.
3. `coerencia-agenda-estado.ts` permanece como executor transacional único e invoca a política antes de qualquer mutação.
4. Rotas, ferramentas, links e jobs tornam-se adaptadores: consultam `allowedActions` e enviam comandos, sem reproduzir regras.
5. Toda mudança registra ledger/milestone e todo efeito externo nasce na outbox depois do fato local.
6. A ativação usa flags por tenant, desligadas por padrão. Efeitos e no-show permanecem independentes e desligados durante a contenção.

## Fases temporais

- `FUTURO`: relógio confiável anterior ao início.
- `INICIADO`: relógio igual ou posterior ao início e anterior ao fim derivado.
- `ENCERRADO`: relógio igual ou posterior ao fim derivado.

A fase é derivada e não persistida.

## Consequências

- Cancelamentos e reagendamentos tardios são rejeitados com código estável e sem mutação.
- Clientes recebem ações calculadas no servidor.
- Dados e consumidores legados continuam legíveis durante a migração.
- Calendar por tenant/especialista permanece na Onda 2 e só consumirá eventos canônicos.

## Rollout

1. Publicar flags desligadas.
2. Ativar somente a política no tenant piloto após testes da Onda 0.
3. Migrar escritores um a um na Onda 1.
4. Ativar comandos centrais somente após zero escritores diretos conhecidos.
5. Desligar flags diante de transição inválida, confirmação falsa, quebra de isolamento ou duplicação.
