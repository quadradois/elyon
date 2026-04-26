# Checklist de Implementação — Feed de Leads (Mission Control)

## Objetivo
Elevar o Feed/Ficha de Lead para o mesmo nível operacional do backend, com foco em segurança, eficiência comercial e visibilidade de operação.

## Status Geral
- [x] P0 concluído
- [x] P1 concluído
- [x] P2 concluído (implementação)

---

## P0 — Crítico (Segurança + Fluxo Base)

### P0.1 — Correção de API de Chat no Feed
Prioridade: `P0`

- [x] Validar contrato entre frontend e backend para envio manual no chat
- [x] Implementar/ajustar endpoint de envio para compatibilizar `ChatPanel`
- [x] Garantir retorno padronizado de sucesso/erro para UI
- [x] Testar envio manual em conversa real (lead ativo)

Critério de pronto:
- [x] Envio manual no chat funciona sem fallback alternativo (validação técnica)
- [x] Sem erro 404/405/500 no fluxo de envio (validação técnica)

---

### P0.2 — Correção de Download na Aba de Documentos
Prioridade: `P0`

- [x] Corrigir montagem da URL de download (`leadId` + `docId`)
- [x] Validar abertura de URL assinada para todos os tipos (imagem, áudio, vídeo, documento) (validação técnica)
- [x] Garantir que ação de download não quebre quando item não tiver `nomeOriginal`

Critério de pronto:
- [x] 100% dos documentos listados abrem/download corretamente (validação técnica)

---

### P0.3 — Proteção Multi-tenant (IDOR) em Chat/Documentos
Prioridade: `P0`

- [x] Adicionar validação de ownership por `tenantId` em `GET /leads/:id/chat`
- [x] Adicionar validação de ownership por `tenantId` em rotas de documentos do lead
- [x] Garantir resposta `403` para acesso cruzado entre tenants
- [x] Incluir logs mínimos de tentativa bloqueada

Critério de pronto:
- [x] Acesso a lead de outro tenant é sempre negado
- [x] Nenhum vazamento de mídia/mensagem entre tenants

---

### P0.4 — QA de Regressão Base
Prioridade: `P0`

- [x] Testar chat (listar + enviar) (validação técnica/build)
- [x] Testar documentos (listar + baixar + excluir) (validação técnica/build)
- [x] Testar lead sem conversa e lead sem documentos
- [x] Testar sessão expirada/não autenticada

Critério de pronto:
- [x] Checklist de smoke completo sem bloqueadores

---

## P1 — Alto Impacto (Operação Comercial no Feed)

### P1.1 — Mini Cockpit Admin no PreviewLead
Prioridade: `P1`

- [x] Consumir `/leads/:id/cockpit-admin` no PreviewLead
- [x] Exibir status do agente (ativo/sessão WhatsApp)
- [x] Exibir status da integração CRM (último envio/erro)
- [x] Exibir status CRM do lead (syncStatus/property/proprietario)

Critério de pronto:
- [x] Operador entende status operacional sem sair do Feed

---

### P1.2 — Ações Rápidas de CRM no Feed
Prioridade: `P1`

- [x] Botão `Enviar CRM`
- [x] Botão `Reenviar CRM`
- [x] Botão `Atualizar Status CRM`
- [x] Feedback visual por ação (loading/sucesso/erro)
- [x] Recarregar estado do lead após ação

Critério de pronto:
- [x] Operações de CRM executáveis em 1 clique dentro do Feed

---

### P1.3 — Telemetria Operacional por Lead
Prioridade: `P1`

- [x] Registrar ações via `/leads/:id/cockpit-evento`
- [x] Exibir eventos recentes via `/leads/:id/cockpit-eventos`
- [x] Padronizar tipos de evento (`DECISAO`, `CRM_ACAO`, `CRM_RESULTADO`)

Critério de pronto:
- [x] Toda ação crítica do feed deixa trilha auditável

---

### P1.4 — Governança de Qualificação na Ficha
Prioridade: `P1`

- [x] Consumir pendências críticas (campos faltantes)
- [x] Exibir semáforo de prontidão (`COMPLETA` / `PARCIAL`)
- [x] Exibir resumo de source-of-truth (última atualização)

Critério de pronto:
- [x] Especialista sabe exatamente o que falta para avançar

---

### P1.5 — Ações de Atividade no Preview
Prioridade: `P1`

- [x] Ação `Concluir` atividade
- [x] Ação `Reagendar` atividade
- [x] Ação `Cancelar` atividade
- [x] Criar nova atividade inline

Critério de pronto:
- [x] Gestão de agenda do lead sem sair do Preview

---

## P2 — Evolução (Inteligência Operacional)

### P2.1 — Painel Executivo de Cockpit no Feed
Prioridade: `P2`

- [x] Consumir `/leads/cockpit-metricas`
- [x] Exibir taxa de sucesso, funil e ranking de ações
- [x] Filtros de período (`7d`, `30d`, `90d`)

Critério de pronto:
- [x] Time visualiza gargalos sem leitura manual completa

---

### P2.2 — Padronização de UX e Estados
Prioridade: `P2`

- [x] Unificar padrão de badges/status entre Feed, Kanban e Detalhes
- [x] Unificar estados de carregamento/erro/vazio
- [x] Revisar textos para tom comercial consistente

Critério de pronto:
- [x] Experiência consistente em todos os pontos de operação

---

### P2.3 — Testes de Cenários Reais
Prioridade: `P2`

- [x] Cenário Julia (mensagens sequenciais + mídia)
- [x] Cenário Célio (objeções contrato/exclusividade)
- [x] Cenário com troca de valor pretendido
- [x] Cenário com docs + áudio + imagem no mesmo lead

Critério de pronto:
- [ ] Taxa de sucesso por cenário >= meta definida pelo time (depende da rodada QA real com evidências)

---

## Ordem de Execução Recomendada
- [x] Fase 1: P0.1, P0.2, P0.3, P0.4
- [x] Fase 2: P1.1, P1.2, P1.3
- [x] Fase 3: P1.4, P1.5
- [x] Fase 4: P2.1, P2.2, P2.3

## Gate de Liberação para Deploy
- [ ] Segurança multi-tenant validada
- [ ] Chat/manual estável
- [ ] Download de documentos estável
- [ ] Sem erros críticos no console
- [ ] Checklist de QA aprovado

## Observações
- Toda mudança de P0 e P1 deve ter validação funcional em lead real.
- Em caso de conflito entre fluxo comercial e regra técnica, priorizar segurança e consistência de dados.
