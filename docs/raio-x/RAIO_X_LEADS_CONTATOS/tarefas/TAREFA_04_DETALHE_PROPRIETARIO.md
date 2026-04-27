# Tarefa: Frontend — Página /proprietarios/:id (Detalhe Unificado)

Base:
- docs/raio-x/RAIO_X_LEADS_CONTATOS.md

Escopo alvo:
- pacotes/frontend/src/paginas/ProprietarioDetalhes/index.tsx (arquivo novo)
- pacotes/frontend/src/paginas/ProprietarioDetalhes/hooks/useProprietarioDetalhes.ts (arquivo novo)
- pacotes/frontend/src/paginas/ProprietarioDetalhes/componentes/ (pasta nova)

Problemas críticos (ordem):

1) [P5-detalhe] ContatoDetalhes e LeadDetalhes são telas separadas para a mesma pessoa
   Quando um Contato vira Lead, o corretor precisa saber disso e navegar para outra URL.
   A transição é invisível na UI. O histórico de prospecção (mensagens do WhatsApp) fica
   em ContatoDetalhes, os dados de negociação ficam em LeadDetalhes — nunca juntos.

2) [P5-url] URL aninhada `/campanhas/:cid/contatos/:ctid` impede acesso direto
   3 níveis de profundidade. Sem possibilidade de buscar um proprietário diretamente
   sem conhecer o ID da campanha dele primeiro.

Critérios de pronto:
- Página `ProprietarioDetalhes` renderiza em `/dashboard/proprietarios/:id`
- Aceita ID de Contato OU Lead na URL — resolve internamente via `GET /api/proprietarios/:id`
- Header: nome do proprietário, badge de estágio, badge de temperatura (se lead), botão voltar para `/proprietarios`, link para campanha de origem
- Abas contextuais (aparecem conforme o estágio):
  - **Prospecção** (sempre visível): histórico de mensagens WhatsApp, status do agente (IA ativa / pausado / humano), botão "Assumir atendimento", botão "Enviar mensagem manual"
  - **Imóvel** (visível quando virou Lead): dados do imóvel coletados (endereço, tipo, área, quartos, valor pretendido)
  - **Qualificação** (visível quando virou Lead): dados SPIN (situação, problema, implicação, necessidade), temperatura, urgência
  - **Negociação** (visível nos estágios DOCUMENTACAO em diante): comissão acordada, tipo de autorização, prazo
  - **Contrato** (visível quando status = DOCUMENTACAO ou CAPTADO): link do contrato, data assinatura
  - **Atividades** (sempre visível): histórico de atividades e agendamentos
- Dados do proprietário na sidebar: nome, CPF (mascarado), telefones, email, dados pessoais Assertiva (faixa salarial, renda, empresa), dados do imóvel (inscrição IPTU, endereço, valor venal)
- Botão "Converter para Lead" visível quando `statusProspeccao = 'INTERESSADO'` e `virouLead = false`

Restrições:
- Não deletar `ContatoDetalhes.tsx` nem `LeadDetalhes/index.tsx` nesta tarefa — eles ainda são referenciados pelas rotas antigas que só serão removidas na TAREFA_05
- Não replicar lógica de negócio dos componentes existentes — importar e reutilizar: `AbaContato`, `AbaDocumentos`, `CardNegociacao`, `CardContrato`, `CardProprietario`, `CardImovel` do LeadDetalhes
- Não alterar as rotas existentes (`/campanhas/:id/contatos/:id` e `/leads/:id`) — elas ainda precisam funcionar até a TAREFA_05
- Usar o hook `useLeadDetalhes` existente como referência para estrutura do `useProprietarioDetalhes`

Validação:
- Rodar: acessar `/dashboard/proprietarios/:contatoId` com ID de um Contato que NÃO virou Lead → mostrar apenas abas Prospecção e Atividades
- Rodar: acessar `/dashboard/proprietarios/:contatoId` com ID de um Contato que virou Lead → mostrar todas as abas (Prospecção, Imóvel, Qualificação, Negociação, Atividades)
- Rodar: acessar `/dashboard/proprietarios/:leadId` com ID de um Lead direto → mesma tela, sem erro
- Testar cenário: histórico de mensagens WhatsApp carrega corretamente (ordem cronológica, diferenciando ENTRADA/SAIDA)
- Testar cenário: botão "Converter para Lead" aparece quando `statusProspeccao = 'INTERESSADO'` e dispara `POST /api/leads` corretamente
- Testar cenário: link da campanha de origem leva para `/dashboard/campanhas/:id`

Entrega:
- Primeiro criar `useProprietarioDetalhes.ts` com fetch + tipagem e mostrar o shape do objeto retornado.
- Depois criar o layout base da página com header + sidebar de dados + tabs vazias.
- Por último preencher cada aba, começando por Prospecção (mais crítica) e depois Imóvel/Qualificação.
