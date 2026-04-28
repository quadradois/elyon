# Finalização — Agenda / Atendimento (2026-04-28)

## Escopo Entregue

- Correção de resposta duplicada no webhook com ajuste de processamento por lote.
- Aumento de robustez de lock/mutex Redis para evitar concorrência em processamento longo.
- Remoção de fallback com link falso de Google Meet no agendamento.
- Criação de ações completas na agenda:
  - Aprovar
  - Cancelar
  - Reagendar
  - Propor Horário
- Migração do modal para drawer lateral direito na Agenda.
- Implementação de motivos de reagendamento + templates + placeholders inteligentes:
  - `[nome]`
  - `[data_hora]` (alias: `[data]`)
  - `[dia_semana]`
- Preview da mensagem final antes de envio ao cliente.
- Polimento visual e reorganização das seções do drawer.

## Checklist de Homologação (UAT)

1. Abrir Agenda e clicar em um evento `PENDENTE`.
2. Verificar abertura do drawer lateral direito.
3. Clicar em `Aprovar` e confirmar mudança de status + mensagem WhatsApp (quando sessão conectada).
4. Clicar em `Cancelar` com e sem motivo e validar status `CANCELADO`.
5. Clicar em `Reagendar` com novo horário e validar atualização no calendário + aviso ao cliente.
6. Clicar em `Propor Horário`:
   - selecionar motivo
   - preencher novo horário
   - testar mensagem padrão
   - testar mensagem personalizada com placeholders
7. Validar bloqueio quando mensagem personalizada não contém `[data_hora]`/`[data]`.
8. Validar preview final da mensagem antes do envio.
9. Validar que não há envio de link fake quando Google Calendar não está ativo.
10. No WhatsApp, enviar duas mensagens sequenciais e validar resposta sem perda de contexto.

## Observações Operacionais

- Se Google Calendar estiver indisponível, o agendamento permanece no CRM sem link automático.
- Mensagens ao cliente são enviadas somente quando há sessão WhatsApp conectada no tenant.

## Arquivos Alterados

- `pacotes/backend/src/rotas/webhook.ts`
- `pacotes/backend/src/lib/redis-cache.ts`
- `pacotes/backend/src/ferramentas/sdr-tools-agents.ts`
- `pacotes/backend/src/rotas/agenda.ts`
- `pacotes/frontend/src/servicos/apiAgenda.ts`
- `pacotes/frontend/src/paginas/Agenda.tsx`
- `pacotes/frontend/src/componentes/ui/drawer.tsx`

