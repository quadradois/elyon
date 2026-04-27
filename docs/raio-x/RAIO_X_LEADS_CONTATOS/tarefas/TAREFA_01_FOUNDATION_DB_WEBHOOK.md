# Tarefa: Foundation — DB Migration & Correções de Webhook

Base:
- docs/raio-x/RAIO_X_LEADS_CONTATOS.md

Escopo alvo:
- pacotes/backend/prisma/schema.prisma
- pacotes/backend/prisma/migrations/ (nova migration)
- pacotes/backend/src/rotas/webhook.ts

Problemas críticos (ordem):

1) [P1] Bug: proprietário em 2 campanhas usa briefing errado
   Webhook.ts → `buscarContatoProspeccao` → query usa `ORDER BY atualizadoEm DESC LIMIT 1`.
   Quando o mesmo telefone está em 2 campanhas ativas, o agente usa o briefing da campanha
   modificada mais recentemente, não da campanha onde a conversa está acontecendo.

2) [P2] Schema: `campanhaId` required impede Proprietários manuais
   `model Contato` no schema.prisma tem `campanhaId String` (non-nullable).
   Impede corretor de cadastrar proprietário avulso sem criar campanha primeiro.

3) [P3] Ausência de guard: Contato sem campanha poderia acionar o agente
   Após P2 ser corrigido, um Contato com `campanhaId = null` que recebesse mensagem
   entraria no webhook sem `knowledgeBase`, fazendo o agente responder sem briefing.

Critérios de pronto:
- `campanhaId` é `String?` no schema — migration aplicada sem erros em staging
- Constraint `@@unique([campanhaId, telefone])` funciona com `campanhaId` nulo (partial unique via raw SQL na migration)
- Webhook: contato com `statusProspeccao IN ('CONTATANDO', 'RESPONDEU', 'INTERESSADO')` tem prioridade sobre `atualizadoEm DESC` na seleção
- Webhook: se `contato.campanhaId === null` → chama `registrarIgnorado(telefone, 'sem_campanha_vinculada', contatoId)` e retorna sem acionar agente
- Nenhuma tool do SDR foi alterada
- Agente continua recebendo `briefingCompleto` corretamente para contatos COM campanha

Restrições:
- Não alterar a assinatura das tools do SDR (`sdr-tools-agents.ts`)
- Não alterar a lógica de `processarMensagemOrquestrada`
- Manter compatibilidade total com o fluxo outbound existente (Campanha → Contato → SDR → Lead)
- Não remover a constraint unique — apenas torná-la partial (NULL não viola unique no Postgres)
- Não alterar endpoints de API existentes (`/api/contatos`, `/api/campanhas`)

Validação:
- Rodar: `npx prisma migrate dev --name add_campanha_opcional_contato` em staging
- Rodar: `npx prisma validate` após migration
- Testar cenário A: Contato COM campanhaId → webhook aciona agente com briefing correto (comportamento inalterado)
- Testar cenário B: Proprietário com campanhaId nulo recebe mensagem → webhook registra `sem_campanha_vinculada` e NÃO aciona agente
- Testar cenário C: Mesmo telefone em 2 campanhas, uma com status CONTATANDO e outra com atualizadoEm mais recente → agente usa o contato com status CONTATANDO
- Testar cenário D: Criar dois contatos com mesmo telefone, um com campanhaId nulo e outro com campanhaId preenchido → sem erro de unique constraint

Entrega:
- Primeiro corrigir P1 (fix da query no webhook) e mostrar diff + testar cenário C.
- Depois P2 (schema nullable) com a migration e testar cenário D.
- Por último P3 (guard no webhook) e testar cenário B.
- Cada fix é um commit separado.
