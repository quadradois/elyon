# Tarefa: Backend — API Unificada de Proprietários

Base:
- docs/raio-x/RAIO_X_LEADS_CONTATOS.md

Escopo alvo:
- pacotes/backend/src/rotas/proprietarios.ts (arquivo novo)
- pacotes/backend/src/servidor.ts

Problemas críticos (ordem):

1) [P5-backend] Não existe endpoint que retorne Contatos e Leads num único recurso
   Hoje o frontend precisa chamar `/api/campanhas/:id/contatos` para ver proprietários
   em prospecção e `/api/leads` para ver os qualificados — são duas chamadas separadas
   sem visão unificada, impossibilitando a página `/proprietarios`.

2) [P5-detalhe] Detalhe de um Proprietário exige navegação por URL aninhada
   Para buscar dados de um Contato + seu Lead vinculado, o frontend precisa conhecer
   o `campanhaId` antes de buscar o `contatoId`. Não há endpoint `GET /contatos/:id`
   nem `GET /proprietarios/:id` que resolva isso automaticamente.

Critérios de pronto:
- `GET /api/proprietarios` retorna lista paginada com campos: `id, nome, telefone, email, campanhaId, campanhaNome, empreendimento, statusProspeccao, virouLead, leadId, statusLead, temperatura, estagio, criadoEm`
- Campo `estagio` é calculado: `"Em Prospecção"` | `"Respondeu"` | `"Qualificado"` | `"Em Negociação"` | `"Captado"`
- Filtros suportados: `?estagio=`, `?campanhaId=`, `?busca=` (nome/telefone/cpf), `?page=`, `?limit=`
- `GET /api/proprietarios/:id` aceita ID de Contato OU Lead, retorna objeto unificado com: dados do Contato (se existir), Lead vinculado (se existir), campanha de origem, últimas 50 mensagens de prospecção, atividades, conversas
- `POST /api/proprietarios` cria Contato com `campanhaId` opcional (nome e telefone obrigatórios)
- Rota registrada em `servidor.ts` como `app.use('/api/proprietarios', rotaProprietarios)`
- Endpoints anteriores (`/api/leads`, `/api/contatos`, `/api/campanhas`) continuam funcionando sem alteração

Restrições:
- Não remover nem alterar rotas existentes em `servidor.ts`
- Não alterar `contatos.ts`, `leads.ts` ou `campanhas/index.ts`
- O endpoint deve respeitar `tenantId` via middleware de autenticação existente (padrão `getTenantId(req)`)
- Não usar `$queryRawUnsafe` — usar `$queryRaw` com `Prisma.sql` template tag (padrão já existente no webhook)
- Manter o padrão de resposta: `{ data: [], metadata: { total, pagina, totalPaginas } }`

Validação:
- Rodar: `curl -H "Authorization: Bearer <token>" http://localhost:3333/api/proprietarios?limit=5` → retornar JSON com campo `estagio`
- Rodar: `curl .../api/proprietarios?estagio=Qualificado` → retornar apenas proprietários com `virouLead: true`
- Rodar: `curl .../api/proprietarios/:contatoId` → retornar contato + lead vinculado (se existir)
- Rodar: `curl .../api/proprietarios/:leadId` → retornar lead + contato de origem (se existir)
- Testar cenário: proprietário sem campanha (`campanhaId: null`) aparece na listagem com `campanhaNome: null` e `estagio: "Em Prospecção"`
- Testar cenário: busca por `?busca=João` retorna proprietários cujo nome contém "João" tanto em Contatos quanto em Leads

Entrega:
- Primeiro criar o arquivo `proprietarios.ts` com `GET /` e `GET /:id` e mostrar diff.
- Depois adicionar `POST /` para criação manual.
- Por último registrar em `servidor.ts` e confirmar que os outros endpoints continuam respondendo.
