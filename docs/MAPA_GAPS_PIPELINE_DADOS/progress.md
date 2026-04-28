# Progress Log — Pipeline Mineração → CRM

## Sessão 2026-04-28

### Contexto
- Solicitação para aplicar `planning-with-files` no escopo de `/root/elyon/docs/MAPA_GAPS_PIPELINE_DADOS/MAPA_GAPS_PIPELINE_DADOS.md`.

### Ações executadas
1. Inspeção do diretório e confirmação do arquivo base.
2. Leitura do diagnóstico para extrair objetivo, escopo e prioridades.
3. Criação dos arquivos de planejamento no diretório do projeto:
- `task_plan.md`
- `findings.md`
- `progress.md`

### Resultado
- Planejamento persistente inicializado com fases, critérios de sucesso, riscos e descobertas-chave.
- Projeto pronto para seguir para fase 2: mapeamento técnico de cada GAP no código.

### Pendências imediatas
- Ler o código-fonte e construir matriz `GAP -> arquivos/funções impactadas`.

### Erros
- Nenhum erro encontrado nesta sessão.

## Sessão 2026-04-28 (execução completa das fases)

### Ações executadas
1. Mapeamento de pontos reais de código do pipeline:
- `backend/src/rotas/mineracao/processamento.rotas.ts`
- `backend/src/servicos/scraper-iptu.ts`
- `backend/src/servicos/assertiva.ts`
- `backend/src/rotas/campanhas/contatos.rotas.ts`
- `backend/src/rotas/proprietarios.ts`
- `frontend/src/paginas/ProprietarioDetalhes/index.tsx`
2. Consolidação da matriz `GAP -> arquivo -> ajuste`.
3. Priorização por lotes (A crítico, B alto, C médio) e início da implementação.

### Estado
- Fases 2, 3, 4 e 5 concluídas.
- Fase 6 concluída (implementação + validação concluídas).

### Entregas técnicas
1. Backend:
- Extração de `valorVenal`, `areaConstruida`, `areaTerreno`, `anoConstituicao` no scraper IPTU.
- Persistência de `cpfMae`, `escolaridade`, `estadoCivil`, `tipoLogradouro` e `perfilInvestidor`.
- Enriquecimento de payload em `/api/proprietarios/:id` com dados de compliance/societário e vínculo de empreendimento.
2. Frontend:
- Tela `ProprietarioDetalhes` atualizada para exibir os novos blocos de compliance, endereço residencial, dados societários/redes e contexto de empreendimento.
3. Banco:
- Migration criada para novos campos em `contatos`.

### Validações
- `NODE_OPTIONS=--max-old-space-size=4096 npm test -- --runInBand src/__tests__/rotas/mineracao.test.ts` ✅ (4/4).
- `npm run build` backend ✅.
- `npm run build` frontend ✅.

### Erros encontrados e resolução
- OOM no Jest na primeira execução (heap padrão do Node). Resolvido com `NODE_OPTIONS=--max-old-space-size=4096`.

## Sessão 2026-04-28 (deploy local e smoke real)

### Ações executadas
1. Rebuild e restart dos containers `backend` e `frontend` com o código atual:
- `docker compose up -d --build backend frontend`
2. Aplicação da migration no container atualizado:
- `docker compose exec -T backend npx prisma migrate deploy`
3. Confirmação no banco:
- Colunas `cpfMae`, `escolaridade`, `tipoLogradouro` existem em `contatos`.
4. Health checks:
- Backend `/api/saude` respondeu `{"status":"ok"}`.
- Frontend interno `/health` respondeu `OK`.
5. Smoke real:
- `POST /api/mineracao/iptu-unitario` com IPTU `43023905870100` retornou `200`.
- Fluxo percorreu Prefeitura + Assertiva, retornou proprietário enriquecido e consumiu 1 crédito por encontrar telefone.
6. Smoke API detalhe:
- `GET /api/proprietarios/bed196fb-1228-4562-aeff-8ef281d79f5a` retornou `200`.
- Payload incluiu `campanha.empreendimento` para exibição do contexto no detalhe.

### Observações
- No IPTU testado, `areaConstruida`, `areaTerreno`, `valorVenal` e `anoConstituicao` vieram `null` porque esses valores não apareceram/foram retornados no HTML específico consultado.
- `http://localhost` retornou 404 por roteamento Traefik sem Host esperado; isso não indicou falha do frontend. O health interno do container confirmou Nginx ativo.

## Sessão 2026-04-28 (backfill cache -> contatos)

### Diagnóstico
- O contato `cbbb1a47-322c-4180-9818-77e224e7a6e7` estava sem dados ricos em `contatos`.
- O CPF `32447205104` tinha dados ricos no `cache_cpf`: nascimento, idade, sexo, endereço, situação cadastral e participações societárias.
- Conclusão: para esse caso, não era necessário consultar Assertiva novamente; faltava sincronizar cache para `contatos`.

### Ação executada
- Backfill SQL de `cache_cpf` para `contatos`, preservando campos já preenchidos.
- Total de contatos atualizados a partir de cache: 755.

### Evidência da campanha ED PEDRA DA LUA
- Total: 198 contatos.
- Com dados ricos após backfill: 197.
- Com nascimento: 194.
- Com endereço residencial: 192.
- Com dados profissionais: 110.
- Com participações societárias: 85.

### Observação
- Dados profissionais ainda ausentes em parte da base porque o próprio cache não possui `profissao`, `rendaEstimada` ou `empresaAtual` para esses CPFs. Para esses casos, só nova nutrição/reconsulta pode tentar complementar.

## Sessão 2026-04-28 (backfill imoveis -> contatos)

### Diagnóstico
- A aba Imóvel do contato `cbbb1a47-322c-4180-9818-77e224e7a6e7` mostrava unidade, mas faltavam campos normalizados no `Contato` como `apartamento`, `quadra`, `lote`, `tipoImovel` e `areaTerreno`.
- A tabela `imoveis` tinha esses dados para IPTU `34007503004414`.
- A base local possui `areaEdificada` inconsistente para o edifício `codigoEdificio=4798`: valores `0`, negativos e números absurdos.

### Ação executada
- Backfill `imoveis -> contatos` por `inscricaoIptu`.
- Total de contatos atualizados a partir de `imoveis`: 474.
- Limpeza global de `areaConstruida` inválida em `contatos` (`<= 0` ou `> 1000`): 180 registros.

### Evidência da campanha ED PEDRA DA LUA
- Total: 198 contatos.
- Com edifício: 198.
- Com apartamento: 198.
- Com quadra: 198.
- Com lote: 198.
- Com tipo de imóvel: 198.
- Com área do terreno: 198.
- Com área construída: 0 (mantido vazio porque a fonte local está corrompida/zerada para esse edifício).

### Evidência do contato Carlos
- `apartamento`: 901.
- `unidade`: APTO 901.
- `box`: 147.
- `quadra`: 01A.
- `lote`: GLEBA.
- `areaTerreno`: 14885.88.
- `tipoImovel`: PREDIAL.
- `areaConstruida`: null por segurança.

## Sessão 2026-04-28 (GAP-01 seleção de edifício)

### Ação executada
- `MapaService` passou a enriquecer `Edificio` agregando dados da tabela `imoveis` por `codigoEdificio`.
- Campos expostos: `codigoEdificio`, `numeroPavimentos`, `numeroElevadores`, `vagasCobertas`, `vagasDescobertas`, `numeroGaragens`, `areaTerreno`, `areaEdificada`, `latitude`, `longitude`, `tipoEdificacao1/2`, `estrutura`, `esquadrias`, `piso`, `forro` e `descricoes`.
- A tela `Mineracao.tsx` passou a renderizar badges estruturais na seleção por bairro, seleção por nome e cabeçalho do edifício selecionado.
- Áreas edificadas inválidas são descartadas no resumo (`<= 0` ou `> 1000` por unidade) para evitar exibir lixo da fonte local.

### Validação
- `npm run build` no backend: passou.
- `npm run build` no frontend: passou, mantendo apenas o aviso já conhecido de chunk grande.
- `NODE_OPTIONS=--max-old-space-size=4096 npm test -- --runInBand src/__tests__/rotas/mineracao.test.ts`: passou 4/4.
- `docker compose up -d --build backend frontend`: containers reconstruídos e iniciados.
- Smoke `/api/mineracao/buscar-edificios?termo=PEDRA%20DA%20LUA`: retornou `codigoEdificio=4798`, `totalUnidades=207`, `areaTerreno=14885.88`; pavimentos/elevadores/vagas nulos porque a fonte local não possui esses dados para esse prédio.
- Smoke `/api/mineracao/buscar-edificios?termo=TOCANTINS`: retornou edifício com `numeroPavimentos=54`, `numeroElevadores=3`, `areaTerreno=1111.4`, geolocalização e códigos construtivos.

### Observação
- GAP-01 está entregue na seleção. GAP-02 continua pendente: reutilizar esse resumo estrutural para alimentar `EmpreendimentoConhecimento`/briefing do agente IA.

## Sessão 2026-04-28 (GAP-02 injeção no conhecimento do empreendimento)

### Ação executada
- Criado serviço `src/servicos/resumo-estrutural-empreendimento.ts`.
- O serviço monta `dadosEstruturaisMapa` a partir de `imoveis`, com saneamento de área edificada e agregação por `codigoEdificio`.
- O serviço gera bloco textual `### Dados estruturais da prefeitura/MAPA` para anexar ao `briefingCompleto`.
- A criação manual de campanha (`POST /api/campanhas`) agora tenta localizar dados MAPA do empreendimento e, quando encontra, cria/vincula `EmpreendimentoConhecimento`.
- A rota legada `POST /api/campanhas/criar-com-pesquisa` recebeu o mesmo comportamento.
- A atualização manual de briefing (`PUT /api/campanhas/:id/briefing`) preserva briefing humano existente e reanexa/atualiza o bloco MAPA sem duplicar.
- A aplicação de pesquisa Manus (`POST /api/pesquisas/:id/aplicar`) mescla `dadosEstruturaisMapa` ao briefing IA antes de salvar em `EmpreendimentoConhecimento` e na campanha.

### Validação
- `npm run build` no backend: passou.
- `NODE_OPTIONS=--max-old-space-size=4096 npm test -- --runInBand src/servicos/__tests__/resumo-estrutural-empreendimento.test.ts`: passou 3/3.
- `NODE_OPTIONS=--max-old-space-size=4096 npm test -- --runInBand src/servicos/__tests__/resumo-estrutural-empreendimento.test.ts src/__tests__/rotas/mineracao.test.ts`: passou 7/7 durante a validação intermediária.
- `docker compose up -d --build backend`: backend reconstruído e iniciado.
- Smoke real criando campanha temporária `TOCANTINS`: retornou `empreendimentoId` e mensagem de injeção MAPA.
- Verificação SQL da campanha temporária: `codigoEdificio=834`, `numeroPavimentos=54`, `numeroElevadores=3`, bloco textual presente.
- Verificação SQL do `EmpreendimentoConhecimento`: `totalUnidades=67` e texto `Pavimentos: 54.` presente.
- Registros temporários do smoke foram removidos (`DELETE 1` campanha, `DELETE 1` empreendimento).
- Health check backend `/api/saude`: ok.

### Observação
- O primeiro smoke revelou ambiguidade por nome (`TOCANTINS` também encontrava outro edifício com mais unidades). O serviço foi ajustado para tentar `nome+logradouro+bairro`, depois `nome+logradouro`, e evitar fallback para nome puro quando o logradouro foi informado.

## Sessão 2026-04-28 (aba Qualificação do proprietário)

### Diagnóstico
- A aba `Qualificação` renderizava `CardProprietario`, que mostra score Assertiva, idade, sexo, renda, telefones e emails.
- Esses dados já aparecem na aba `Proprietário` e parcialmente na aba `Atendimento`, gerando repetição e confundindo qualificação comercial com enriquecimento cadastral.
- O backend de proprietários não montava o objeto `spin` no mesmo contrato usado em `LeadDetalhes`, então a UI não tinha um payload limpo de SPIN para exibir.

### Ação executada
- Removido `CardProprietario` da aba `Qualificação`.
- Criada renderização dedicada `TabQualificacao` em `ProprietarioDetalhes`, focada em:
  - resumo do atendimento IA;
  - fase SPIN;
  - completude do diagnóstico;
  - Situação, Problema, Implicação e Necessidade;
  - dores, objeções, urgência e lacunas para próxima interação.
- `leadVisual` passou a receber `atividades` e `conversas` vindas do endpoint de proprietário.
- `normalizarLeadParaFrontend` passou a expor `spin` estruturado a partir dos campos planos de `Lead`.

### Validação
- `npm run build` no frontend: passou, mantendo apenas os avisos conhecidos de chunk grande.
- `npm run build` no backend: passou.
- `docker compose up -d --build backend frontend`: containers reconstruídos.
- Health check backend `/api/saude`: ok.
- Health check frontend `/health`: ok.
- Smoke do lead `d55a29ee-6218-4fc8-9391-d48fdcf1da76`: backend retornou `spin` estruturado com campos nulos/vazios, refletindo corretamente que ainda não há qualificação SPIN registrada para o caso.

## Sessão 2026-04-28 (sincronização contato removido de lead)

### Diagnóstico
- Foram encontrados contatos que haviam sido promovidos para lead e depois tiveram o lead removido, mas continuavam com `virouLead=true` e `statusProspeccao=LEAD`.
- Consulta de consistência antes da correção encontrou 2 casos: `HERMILON MIRANDA MOTA JUNIOR` e `VYCTOR HUGO SILVA BATISTA`.
- Não havia `leadId` órfão apontando para lead inexistente; o problema era contato sem `leadId`, mas ainda marcado visualmente/operacionalmente como lead.
- Causa raiz: `cascadeDeleteLeads` limpava somente `leadId` em `contatos`, sem restaurar `virouLead`, `virouLeadEm` e `statusProspeccao`.

### Ação executada
- Atualizado `src/utils/cascade-delete.ts` para, ao remover leads, sincronizar contatos vinculados com:
  - `leadId=null`;
  - `virouLead=false`;
  - `virouLeadEm=null`;
  - `statusProspeccao=INTERESSADO`.
- Atualizado teste `src/utils/__tests__/cascade-delete.test.ts` para cobrir a nova regra.
- Corrigidos os 2 registros já inconsistentes no banco, voltando ambos para `INTERESSADO`.

### Validação
- Teste antes da implementação falhou no ponto esperado, provando o gap.
- `NODE_OPTIONS=--max-old-space-size=4096 npm test -- --runInBand src/utils/__tests__/cascade-delete.test.ts`: passou 5/5 depois da correção.
- `npm run build` no backend: passou.
- Consulta pós-correção: `virou_lead_sem_lead=0`, `status_lead_sem_lead=0`, `lead_id_orfao=0`.
- `docker compose up -d --build backend`: backend reconstruído e iniciado.
- Health check backend `/api/saude`: ok.
