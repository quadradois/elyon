# Tarefa: Validação — Regressão Completa do Agente SDR

Base:
- docs/raio-x/RAIO_X_LEADS_CONTATOS.md

Escopo alvo:
- pacotes/backend/src/rotas/webhook.ts (leitura)
- pacotes/backend/src/agentes/sdr-agent.ts (leitura)
- pacotes/backend/src/ferramentas/sdr-tools-agents.ts (leitura)
- pacotes/frontend/src/ (leitura — verificação de links e rotas)

Problemas críticos (ordem):

1) Garantir que nenhuma das 7 tarefas anteriores quebrou o fluxo principal do agente SDR
   O fluxo outbound (Campanha → Contato → SDR via WhatsApp → converterParaLeadTool → Lead)
   é o core de negócio do sistema. Qualquer regressão aqui é crítica.

2) Garantir que redirects não criaram loops ou 404s em produção
   Rotas antigas apontam para novas, mas links hardcoded em notificações, emails e
   mensagens do WhatsApp precisam ser verificados além do codebase.

3) Confirmar que o campo `estagio` calculado está consistente entre backend e frontend
   O campo `estagio` não é armazenado no banco — é calculado na query do endpoint
   `/api/proprietarios`. Qualquer inconsistência entre a lógica do backend e o
   filtro do frontend cria proprietários "invisíveis" em determinados filtros.

Critérios de pronto:
- Fluxo completo do agente executado sem erros em staging: Campanha com briefing → Contato com statusProspeccao CONTATANDO → mensagem WhatsApp → SDR responde com briefing injetado → `qualificarLeadTool` executa → `converterParaLeadTool` executa → Lead aparece em `/proprietarios` como "Qualificado"
- Fix B3 validado em produção: proprietário com telefone em 2 campanhas → agente usa o briefing da campanha com statusProspeccao CONTATANDO
- Nenhuma rota retorna 404 após redirects (testar as 4 rotas da TAREFA_05)
- Campo `estagio` correto para todos os casos: Contato sem Lead → "Em Prospecção" ou "Respondeu"; Contato com Lead NOVO-DOCUMENTACAO → "Qualificado" ou "Em Negociação"; Lead CAPTADO → "Captado"
- Todos os logs do webhook para o cenário de 2 campanhas mostram o contato correto sendo selecionado
- Nenhum lead com status deprecated existe no banco (`SELECT COUNT(*) FROM leads WHERE status IN ('QUALIFICADO','EM_NEGOCIACAO','CONTATANDO','CONVERTIDO','INATIVO')` = 0)

Restrições:
- Esta tarefa é apenas leitura e teste — sem alterações de código
- Se encontrar regressão, abrir nova tarefa específica com o problema, não corrigir inline aqui
- Não rodar em banco de produção sem backup confirmado

Validação:
- Rodar: `SELECT status, COUNT(*) FROM leads GROUP BY status ORDER BY COUNT(*) DESC` → confirmar ausência de deprecated
- Rodar: simular mensagem entrante no webhook em staging com telefone que tem 2 campanhas → verificar log `[Webhook] ✅ Contato encontrado` mostra o contato com statusProspeccao ativo
- Rodar: `curl .../api/proprietarios?estagio=Qualificado` → retornar apenas proprietários com `virouLead: true`
- Rodar: `curl .../api/proprietarios?estagio=Em Prospecção` → retornar apenas Contatos sem Lead vinculado
- Testar cenário A (crítico): ciclo completo SDR em staging — do disparo outbound até o Lead aparecer em /proprietarios
- Testar cenário B: acesso às 4 rotas antigas via browser → todas redirecionam corretamente
- Testar cenário C: Proprietário sem campanha (`campanhaId null`) recebe mensagem WhatsApp → webhook registra `sem_campanha_vinculada` e NÃO responde
- Testar cenário D: abrir `/dashboard/proprietarios`, `/dashboard/campanhas` e `/dashboard/agenda` → nenhuma tela com erro no console

Entrega:
- Relatório final com resultado de cada cenário de teste (passou / falhou / observação).
- Se algum cenário falhar, apontar exatamente qual tarefa e qual arquivo precisa ser revisitado.
- Só após todos os cenários passarem: confirmar que o Caminho B está completo e em produção.
