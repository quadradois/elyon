# Plano de implementação — Copilot de Agenda do Especialista

## Contexto técnico

- **Runtime**: Node.js 20, TypeScript 5.3, Express.
- **Persistência**: PostgreSQL com Prisma 5.7.
- **Mensageria**: Evolution/WhatsApp por sessão vinculada ao tenant; jobs internos executados a cada minuto.
- **IA**: provedores já encapsulados no backend, mas efeitos de agenda passam por `executarComandoAgenda`.
- **Estado atual**: `Atividade` concentra compromisso e confirmação do corretor; o webhook inbound resolve apenas leads; confirmação por especialista ocorre pelo link público; o scheduler já envia convite, lembrete de SLA e remaneja para fallback.
- **Testes**: Jest unitário e integração, TypeScript build e gates de arquitetura.
- **Restrições**: compatibilidade com o link atual, rollout por tenant/cutoff, outbound comercial de leads permanece inalterado, nenhuma dependência de calendário pessoal.

## Verificação da constituição

| Princípio | Decisão do plano | Estado |
|---|---|---|
| Tenant seguro | Resolver sessão → tenant → usuário por telefone; toda consulta inclui tenant | Aprovado |
| Mudança incremental | Preservar rota/link e campos legados; introduzir fluxo sob feature gate | Aprovado |
| Evidência | Testes unitários, integração de webhook, concorrência, replay e smoke | Aprovado |
| Main auditável | Branch e PR dedicados; sem alteração manual de produção | Aprovado |
| Migração segura | Migração aditiva; versão anterior ignora novas tabelas; rollback desliga gate | Aprovado |
| Observabilidade/privacidade | Métricas sem PII, auditoria de efeito e mensagens sanitizadas | Aprovado |

Nenhuma violação constitucional foi identificada.

## Arquitetura proposta

1. O webhook valida a sessão e extrai telefone/conteúdo como hoje.
2. Um roteador de ator procura um especialista ativo no tenant e um contexto de agenda acionável.
3. Se houver contexto de especialista e o gate estiver ativo, o Copilot interpreta a mensagem em intenção estruturada.
4. Um serviço determinístico resolve a solicitação, revalida estado/versão/tenant e executa o comando.
5. Efeitos para lead ou especialista entram no outbox existente, com destino explícito e idempotência.
6. Sem contexto de especialista, o processamento atual do lead continua sem mudança.
7. O link público chama o mesmo serviço de decisão, preservando compatibilidade e concorrência segura.

## Fases de entrega

### Fase A — Fundamentos e convite conversacional

- Criar gate `AGENDA_SPECIALIST_COPILOT_ENABLED` reaproveitando o escopo do piloto.
- Persistir convites versionados e eventos de conversa do especialista.
- Centralizar decisão de confirmar/recusar em serviço usado por WhatsApp e link.
- Enriquecer convite com imóvel e resumo sanitizado; manter link como alternativa.
- Rotear respostas simples (`confirmar`, `recusar`, `não posso`) antes do fluxo de lead.
- Cobrir colisão de papel, múltiplos convites e reentrega.

### Fase B — Contraproposta e substituição

- Persistir contraproposta sem alterar o compromisso.
- Consultar disponibilidade e pedir aceite explícito ao lead.
- Revalidar horário e executar reagendamento atômico após aceite.
- Tratar cancelamento da participação do especialista e fallback.

### Fase C — Lembretes e consultas

- Produzir lembrete T-60 para lead e especialista via outbox.
- Invalidar lembretes obsoletos por estado/versão.
- Permitir consulta da própria agenda e detalhes mínimos.
- Publicar métricas operacionais e guia de piloto.

## Componentes afetados

- `prisma/schema.prisma` e nova migração aditiva.
- `rotas/webhook.ts` para roteamento do ator antes da resolução do lead.
- `rotas/leads.ts` para reutilizar o serviço determinístico no link.
- Novo serviço de identidade/contexto do especialista.
- Novo serviço de intenção e comando do Copilot.
- `jobs/job-confirmacao-corretor.ts` para template contextual e lembretes.
- `servicos/coerencia-agenda-estado.ts` apenas quando necessário para novas transições; preservar ledger e locks atuais.
- `servicos/efeitos-agenda-outbox.ts` para destinatários especialistas já modelados.
- Métricas e testes de privacidade.

## Estratégia de testes

- Unitários: normalização de telefone, intenção, desambiguação, template, sanitização, gate e regras de estado.
- Integração: especialista confirma/recusa por webhook; link e WhatsApp concorrentes; fallback; contraproposta/aceite; lembrete deduplicado.
- Segurança: tenant cruzado, remetente não cadastrado, telefone duplicado, token antigo e consulta de outro especialista.
- Compatibilidade: gate desligado mantém o comportamento existente; link continua funcional.
- Smoke do piloto: convite real, resposta real, notificação ao lead, fallback e lembrete.

## Rollout

1. Implantar schema e código com gate desligado.
2. Validar migração, scheduler e link legado.
3. Ativar somente no tenant piloto e para eventos após cutoff.
4. Observar por 24 horas confirmação/recusa antes de habilitar contraproposta.
5. Habilitar lembretes após validar deduplicação e canal.

## Rollback

- Desligar `AGENDA_SPECIALIST_COPILOT_ENABLED` restaura imediatamente o roteamento atual e o link como caminho principal.
- Novas tabelas permanecem inertes; a versão anterior do backend não depende delas.
- Não reverter schema automaticamente; remover somente em mudança posterior aprovada.

## Gate pós-design

O desenho mantém tenant no servidor, migração aditiva, comandos idempotentes, compatibilidade do link, outbox para efeitos e rollout reversível. Gate aprovado para decomposição em tarefas.
