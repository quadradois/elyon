# Tarefa 08 — Correção de Regressão: ProprietarioDetalhes

## Base
- **Arquivos de referência (originais)**:
  - `pacotes/frontend/src/paginas/ContatoDetalhes.tsx` (836 linhas — origem para contatos em campanha)
  - `pacotes/frontend/src/paginas/LeadDetalhes/index.tsx` (origem para leads convertidos)
- **Arquivo com regressão**:
  - `pacotes/frontend/src/paginas/ProprietarioDetalhes/index.tsx`
  - `pacotes/frontend/src/paginas/ProprietarioDetalhes/hooks/useProprietarioDetalhes.ts`
- **Backend (correto, não alterar)**:
  - `pacotes/backend/src/rotas/proprietarios.ts` — endpoint `GET /api/proprietarios/:id` já retorna `contato`, `lead`, `campanha`, `mensagensProspecao`, `atividades`, `conversas`

---

## Escopo alvo
Restaurar 100% das funcionalidades presentes nos originais dentro da tela unificada `ProprietarioDetalhes`. A tela deve atender tanto a um `Contato` (ainda em prospecção) quanto a um `Lead` (já convertido), sem criar rotas separadas.

---

## Problemas críticos (em ordem de severidade)

### [CRÍTICO] 1. Chat WhatsApp ausente — tela muda de registro de conversa para leitura passiva

- **Localização:** `ProprietarioDetalhes/index.tsx` — inexistente
- **Referência correta:** `ContatoDetalhes.tsx` linhas 530–588 (painel direito sticky 400px)
- **Descrição:** A nova tela exibe as `mensagensProspecao` em modo leitura dentro de uma aba. O original tinha um painel lateral fixo de 400px (`sticky top-[140px]`, `h-[calc(100vh-200px)]`) com bolhas de mensagem, contagem de mensagens, textarea com Enter para enviar e botão Send. A função `enviarMensagem()` chamava `POST /campanhas/contatos/${contatoId}/mensagens` com `{ conteudo, direcao: 'SAIDA' }`.
- **Impacto:** Operadores não conseguem mais enviar mensagens diretamente pela tela — o canal de atendimento ativo foi removido.

### [CRÍTICO] 2. Controle de modoAtendimento (IA / Humano / Pausado) ausente

- **Localização:** `ProprietarioDetalhes/index.tsx` — inexistente
- **Referência correta:** `ContatoDetalhes.tsx` linhas 299–324 (função `alternarModo`) + linhas 609–618 (toggle de 3 botões na TabAtendimento)
- **Descrição:** O toggle IA/Humano/Pausado foi completamente removido. Os endpoints corretos são:
  - IA → `POST /campanhas/${campanhaId}/contatos/${contatoId}/devolver-ia`
  - Humano → `POST /campanhas/${campanhaId}/contatos/${contatoId}/assumir-humano`
  - Pausado → `POST /campanhas/${campanhaId}/contatos/${contatoId}/pausar`
  - O `campanhaId` vem de `dados.campanha.id` (já disponível no hook).
- **Impacto:** Operadores não conseguem assumir nem pausar o atendimento da IA — risco direto de o agente continuar respondendo quando humano deveria atender.

### [CRÍTICO] 3. Endpoint de "Converter para Lead" errado

- **Localização:** `ProprietarioDetalhes/index.tsx` linha 81
- **Código atual:** `await api.post('/leads', { contatoId: contato.id })`
- **Código correto:** `await api.post('/campanhas/${campanhaId}/contatos/${contatoId}/promover')` (sem body)
- **Referência:** `ContatoDetalhes.tsx` linha 330
- **Descrição:** A nova tela usa um endpoint genérico de criação de lead, ignorando a lógica de promoção que está no backend (`/promover`). Esse endpoint faz a promoção correta vinculando Contato → Lead com toda a migração de dados.
- **Impacto:** Conversão silenciosamente falha ou cria leads duplicados/desvinculados do contato. O redirecionamento após conversão também está errado — deve usar `response.data.leadId` para ir para `/dashboard/proprietarios/${leadId}`.

### [ALTO] 4. Header sticky com avatar, telefone principal e botões de ação ausente

- **Localização:** `ProprietarioDetalhes/index.tsx` — cabeçalho não é sticky e faltam elementos
- **Referência correta:** `ContatoDetalhes.tsx` linhas 430–506
- **Descrição:** O original tinha header `sticky top-0 z-20` com avatar gradient 56x56px (iniciais do nome), status badge colorido por `statusProspeccao`, telefone principal e email principal na linha de subtítulo, e botões: Ligar (`tel:{numero}`), WhatsApp (`https://wa.me/55{numero}`), Email (`mailto:`), "Promover a Oportunidade" (ou "Ver no CRM" se já convertido). Todos condicionais à presença de dados.
- **Impacto:** UX degradada — operador não consegue ligar ou abrir WhatsApp externo com um clique. O header rola junto com a página.

### [ALTO] 5. Parsing de telefonesJson / emailsJson ausente

- **Localização:** `ProprietarioDetalhes/index.tsx` — inexistente
- **Referência correta:** `ContatoDetalhes.tsx` linhas 370–412
- **Descrição:** O `Contato` pode ter até 5 telefones e 3 emails em campos planos (`telefone`, `telefone2`...) e também no campo JSON `telefonesJson` / `emailsJson` (resultado de enriquecimento Assertiva), que inclui a flag `whatsapp: true` por número. O original fazia o parse com fallback: JSON → campos planos.
- **Impacto:** Múltiplos números de contato não são exibidos; badges de WhatsApp não aparecem; copiar número não funciona.

### [ALTO] 6. Aba Atendimento (TabAtendimento) substituída por lista de mensagens simples

- **Localização:** `ProprietarioDetalhes/index.tsx` tab "prospeccao"
- **Referência correta:** `ContatoDetalhes.tsx` linhas 591–653 (componente `TabAtendimento`)
- **Descrição:** A aba original "Atendimento" continha: status da prospecção formatado com cor, toggle de modoAtendimento, Score de Dados (`scoreAssertiva` com barra de progresso), Score de Interesse (`scoreQualificacao` com barra de progresso) e campo de Observações (`contato.observacoes`). A nova tela mostrava apenas mensagens passivas nessa aba.
- **Impacto:** Scores e observações de qualificação ficam invisíveis para o operador.

### [ALTO] 7. Aba Proprietário (TabProprietario) simplificada demais

- **Localização:** `ProprietarioDetalhes/index.tsx` sidebar direita — versão reduzida
- **Referência correta:** `ContatoDetalhes.tsx` linhas 656–716 (componente `TabProprietario`)
- **Descrição:** O original exibia num layout de 2 colunas: Dados Pessoais (idade, sexo, signo, CPF formatado, dataNascimento, nomeMae, situacaoCadastral) e Dados Profissionais (empresa, profissão, renda como moeda formatada, faixaSalarial), seguidos de cards para Telefones (com badge WhatsApp, botão copiar, até 5) e Emails (com botão copiar, até 5). A nova tela tem apenas ~9 campos em texto simples e CPF mascarado de forma hardcoded incorreta (`***.***.***-${String(contato?.cpf).slice(-2)}`).
- **Impacto:** Dados críticos de qualificação invisíveis; CPF exibido de forma incorreta.

### [ALTO] 8. Aba Imóvel (TabImovel) usando componente legado em vez do dossier completo

- **Localização:** `ProprietarioDetalhes/index.tsx` tab "imovel" — usa `<CardImovel>` com `isPerdidoOuArquivado={true}`
- **Referência correta:** `ContatoDetalhes.tsx` linhas 719–836 (componente `TabImovel`)
- **Descrição:** O original exibia um dossier completo com: nome do edifício em header gradiente, dossiê de localização/unidade (endereço, bairro, quadra, lote, unidade, bloco, box, areaConstruida em m²), seção de IPTU com botão copiar, tipo de imóvel formatado, área do terreno e valor venal como moeda. A nova tela usa `<CardImovel>` (componente de `LeadDetalhes`) com `isPerdidoOuArquivado={true}` que bloqueia edição mas não exibe o nível de detalhe do dossier original.
- **Impacto:** Dados de IPTU, unidade/bloco/box, quadra/lote não são exibidos.

### [MÉDIO] 9. ChatModal (WhatsApp do Lead) ausente na aba de conversas

- **Localização:** `ProprietarioDetalhes/index.tsx` — inexistente
- **Referência correta:** `LeadDetalhes/index.tsx` linha 79 + linha 1769 (`<ChatModal>`)
- **Descrição:** Quando o proprietário já é um lead, `LeadDetalhes` exibia um botão para abrir o `ChatModal` (lazy loaded de `../../componentes/ChatModal`) com o histórico de conversas WhatsApp do lead. O componente recebe `leadId` e exibe mensagens de `lead.conversas`. A nova tela ignora `dados.conversas` (já retornadas pelo backend).
- **Impacto:** Histórico de conversas WhatsApp do lead não é acessível.

### [MÉDIO] 10. CardBriefingIA / briefingCloser ausente

- **Localização:** `ProprietarioDetalhes/index.tsx` — inexistente
- **Referência correta:** `LeadDetalhes/componentes/CardBriefingIA.tsx` + `LeadDetalhes/index.tsx` linha 482
- **Descrição:** Quando o proprietário tem lead com `briefingCloser` preenchido (resumo gerado pela IA do SDR), o componente `CardBriefingIA` exibe esse briefing. O backend já retorna `dados.lead.briefingCloser` no endpoint `GET /api/proprietarios/:id`. A nova tela nunca renderiza esse campo.
- **Impacto:** Briefing de handoff gerado pela IA é invisível para o closer.

### [MÉDIO] 11. FaseChecklist e CardTrackingIA ausentes

- **Localização:** `ProprietarioDetalhes/index.tsx` — inexistente
- **Referência correta:** `LeadDetalhes/componentes/FaseChecklist.tsx` + `LeadDetalhes/componentes/CardTrackingIA.tsx`
- **Descrição:** O `FaseChecklist` exibe o checklist de fases do playbook de captação (4 etapas). O `CardTrackingIA` mostra o painel de decisões e ações da IA sobre o lead. Ambos recebem apenas `{ lead }` como prop e são reutilizáveis diretamente.
- **Impacto:** Operador não visualiza a fase do playbook nem o cockpit de decisões da IA.

### [MÉDIO] 12. Integração CRM ausente para leads convertidos

- **Localização:** `ProprietarioDetalhes/index.tsx` — inexistente
- **Referência correta:** `LeadDetalhes/index.tsx` linhas 281–338 + linhas 1282–1309
- **Descrição:** Para leads convertidos, o original exibia um painel com status de sincronização no CRM e 4 ações: Falar com cliente no CRM; Verificar status → `GET /leads/${leadId}/crm/status`; Enviar → `POST /leads/${leadId}/crm/enviar`; Reenviar → `POST /leads/${leadId}/crm/reenviar`.
- **Impacto:** Gestores não conseguem sincronizar leads ao CRM externo (Quadra Dois) a partir da tela unificada.

### [MÉDIO] 13. Modal de criação de atividade ausente

- **Localização:** `ProprietarioDetalhes/index.tsx` — inexistente
- **Referência correta:** `LeadDetalhes/index.tsx` — modal `modalAtividade` com Dialog + hook `criarAtividade()`
- **Descrição:** A aba "Atividades" no original tinha um botão "Nova Atividade" que abria um Dialog com campos: tipo, título, descrição, agendadoPara, resultado. A nova tela lista atividades mas não permite criar novas.
- **Impacto:** Operadores ficam sem registrar follow-ups e atividades a partir da tela do proprietário.

### [BAIXO] 14. Helpers de formatação ausentes

- **Localização:** `ProprietarioDetalhes/index.tsx` — inexistente
- **Referência correta:** `ContatoDetalhes.tsx` linhas 130–200
- **Descrição:** Funções `formatarTelefone()`, `formatarCpf()` (completo, não mascarado), `formatarMoeda()`, `tempoRelativo()`, `formatarDataCurta()`, `formatarTipoImovel()`, `formatarBairro()` foram removidas.
- **Impacto:** Dados exibidos sem formatação adequada.

### [BAIXO] 15. Função copiar() com feedback visual ausente

- **Localização:** `ProprietarioDetalhes/index.tsx` — inexistente
- **Referência correta:** `ContatoDetalhes.tsx` linhas 292–297
- **Descrição:** `copiar(texto, tipo)` usava `navigator.clipboard.writeText()` + toast de confirmação + estado `copiado` para trocar ícone Copy → Check por 2 segundos.
- **Impacto:** Sem botões de copiar telefone, email e IPTU.

---

## Recomendações

### [CRÍTICO] R1. Restaurar o painel lateral de chat

- **O que fazer:** Mover a lógica de chat (`enviarMensagem`, textarea, bolhas, auto-scroll) do `ContatoDetalhes.tsx` para `ProprietarioDetalhes/index.tsx`. O `contatoId` vem de `dados.contato?.id`. O `campanhaId` vem de `dados.campanha?.id`.
- **Por quê:** É o canal de atendimento ativo — sem ele, o operador não pode responder ao proprietário.
- **Referência:** `ContatoDetalhes.tsx` linhas 273–290 (enviarMensagem) + 530–588 (JSX do painel)

### [CRÍTICO] R2. Restaurar toggle modoAtendimento

- **O que fazer:** Copiar a função `alternarModo()` e o componente `TabAtendimento` de `ContatoDetalhes.tsx`. Inicializar `modoAtendimento` a partir de `dados.contato?.modoAtendimento`. Renderizar condicionalmente — só quando `dados.contato` existir.
- **Por quê:** Sem isso, a IA não pode ser pausada manualmente pelo operador.
- **Referência:** `ContatoDetalhes.tsx` linhas 299–324

### [CRÍTICO] R3. Corrigir endpoint de conversão para lead

- **O que fazer:** Substituir `api.post('/leads', { contatoId })` por `api.post('/campanhas/${campanhaId}/contatos/${contatoId}/promover')`. Redirecionar para `/dashboard/proprietarios/${response.data.leadId}` após sucesso.
- **Por quê:** O endpoint `/leads` não executa a promoção correta nem vincula os dados do contato.
- **Referência:** `ContatoDetalhes.tsx` linha 330

### [ALTO] R4. Restaurar header sticky com botões de ação

- **O que fazer:** Copiar o `<header>` de `ContatoDetalhes.tsx` para `ProprietarioDetalhes/index.tsx`. Adaptar para ler dados de `dados.contato` ou `dados.lead` (com fallback). Botão "Promover" quando `contato.statusProspeccao === 'INTERESSADO' && !contato.virouLead`. Botão "Ver no CRM" quando `contato.virouLead`.
- **Por quê:** UX crítica — ações de ligar e WhatsApp devem estar sempre visíveis.
- **Referência:** `ContatoDetalhes.tsx` linhas 430–506

### [ALTO] R5. Restaurar parsing telefonesJson/emailsJson

- **O que fazer:** Copiar as IIFEs de parse de `ContatoDetalhes.tsx` (linhas 370–412) para `ProprietarioDetalhes/index.tsx`. Passar `telefones` e `emails` para os sub-componentes que os exibem.
- **Por quê:** Contatos Assertiva têm múltiplos números; sem o parse, apenas o campo plano `telefone` é exibido.
- **Referência:** `ContatoDetalhes.tsx` linhas 370–412

### [ALTO] R6. Substituir sidebar simplificada pelo TabProprietario completo

- **O que fazer:** Extrair `TabProprietario` e `TabImovel` de `ContatoDetalhes.tsx` para arquivos de componente em `ProprietarioDetalhes/componentes/`. Integrar à estrutura de abas existente.
- **Por quê:** Os dados de qualificação (renda, empresa, profissão, dados Assertiva) são essenciais para o closer.
- **Referência:** `ContatoDetalhes.tsx` linhas 656–836

### [MÉDIO] R7. Adicionar ChatModal para leads convertidos

- **O que fazer:** Importar `ChatModal` com `lazy()` de `../../componentes/ChatModal`. Renderizar condicionalmente quando `dados.lead?.id` existir.
- **Por quê:** Histórico de conversas WhatsApp do lead já está no backend mas inacessível na UI.
- **Referência:** `LeadDetalhes/index.tsx` linhas 79, 121, 1769–1777

### [MÉDIO] R8. Adicionar CardBriefingIA, FaseChecklist, CardTrackingIA

- **O que fazer:** Importar os componentes de `../LeadDetalhes/componentes`. Renderizar quando `dados.lead` existir. Todos aceitam apenas `{ lead }` como prop.
- **Por quê:** São componentes prontos e reutilizáveis — custo de integração é mínimo.
- **Referência:** `LeadDetalhes/componentes/CardBriefingIA.tsx`, `CardTrackingIA.tsx`, `FaseChecklist.tsx`

### [MÉDIO] R9. Adicionar painel CRM para leads convertidos

- **O que fazer:** Copiar a lógica de `executarAcaoCrm()` e o JSX do painel CRM de `LeadDetalhes/index.tsx`. Renderizar condicionalmente quando `dados.lead?.id` existir.
- **Por quê:** Sincronização CRM é operação frequente para o time comercial.
- **Referência:** `LeadDetalhes/index.tsx` linhas 281–338, 1254–1309

### [MÉDIO] R10. Adicionar modal de criação de atividade

- **O que fazer:** Reutilizar o Dialog de `LeadDetalhes/index.tsx` com campos tipo/título/descrição/agendadoPara. Chamar `POST /leads/${leadId}/atividades` ao confirmar.
- **Por quê:** Atividades são o mecanismo principal de follow-up.
- **Referência:** `LeadDetalhes/index.tsx` — modal `modalAtividade`

---

## Próximos Passos

1. **[CRÍTICO]** Corrigir endpoint de conversão — `POST /campanhas/${campanhaId}/contatos/${contatoId}/promover` — esforço: **baixo**
2. **[CRÍTICO]** Restaurar painel lateral de chat com envio de mensagem — esforço: **médio**
3. **[CRÍTICO]** Restaurar toggle modoAtendimento (IA/Humano/Pausado) — esforço: **baixo**
4. **[ALTO]** Restaurar header sticky com avatar, botões Ligar/WhatsApp/Email e "Promover" — esforço: **médio**
5. **[ALTO]** Restaurar parsing telefonesJson/emailsJson + helpers de formatação — esforço: **baixo**
6. **[ALTO]** Restaurar TabAtendimento (scores + observações), TabProprietario (dados completos) e TabImovel (dossier) — esforço: **médio**
7. **[MÉDIO]** Integrar CardBriefingIA, FaseChecklist, CardTrackingIA (componentes reutilizáveis de LeadDetalhes) — esforço: **baixo**
8. **[MÉDIO]** Adicionar ChatModal para leads convertidos — esforço: **baixo**
9. **[MÉDIO]** Adicionar painel CRM + modal de criação de atividade — esforço: **médio**
10. **[VALIDAÇÃO]** Testar fluxo completo: contato em prospecção → enviar mensagem → alternar modo → promover a lead → verificar CRM — esforço: **baixo**

---

## Checklist de entrega

- [ ] Chat lateral envia mensagem via `POST /campanhas/contatos/${contatoId}/mensagens`
- [ ] Toggle IA/Humano/Pausado chama endpoints corretos com `campanhaId` de `dados.campanha.id`
- [ ] Botão "Promover" chama `POST /campanhas/${campanhaId}/contatos/${contatoId}/promover`
- [ ] Redirecionamento pós-promoção usa `response.data.leadId`
- [ ] Header sticky com avatar, telefone, email e botões de ação visíveis
- [ ] telefonesJson/emailsJson parseados com fallback para campos planos
- [ ] CPF exibido no formato `XXX.XXX.XXX-XX` (completo, não mascarado)
- [ ] Aba Atendimento exibe scoreAssertiva, scoreQualificacao, observacoes
- [ ] Aba Proprietário exibe dados pessoais, profissionais, telefones com badge WhatsApp
- [ ] Aba Imóvel exibe dossier completo com unidade, bloco, box, IPTU, área
- [ ] `CardBriefingIA` aparece quando `dados.lead?.briefingCloser` está preenchido
- [ ] `FaseChecklist` e `CardTrackingIA` aparecem quando `dados.lead` existe
- [ ] CRM panel aparece condicionalmente quando `dados.lead?.id` existe
- [ ] Modal de criação de atividade funciona e persiste via API
- [ ] `ChatModal` abre para leads convertidos com histórico de conversas
