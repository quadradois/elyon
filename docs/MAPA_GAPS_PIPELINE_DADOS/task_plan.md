# Task Plan — Pipeline de Dados Mineração → CRM

## Objetivo
Transformar o diagnóstico em `/root/elyon/docs/MAPA_GAPS_PIPELINE_DADOS/MAPA_GAPS_PIPELINE_DADOS.md` em plano executável de correções, com priorização por impacto e risco.

## Escopo
- Pipeline ponta a ponta: seleção de edifício, scraper IPTU, enriquecimento Assertiva, persistência em `Contato`, exibição no `ProprietarioDetalhes`.
- Foco inicial em gaps críticos/altos (perda de dados e dados não exibidos).

## Fases
| Fase | Descrição | Status |
|---|---|---|
| 1 | Ler e consolidar o diagnóstico base | complete |
| 2 | Mapear cada GAP para arquivos/módulos reais no código | complete |
| 3 | Definir backlog priorizado (curto/médio prazo) com dependências | complete |
| 4 | Especificar mudanças técnicas (schema, scraper, mapeamento, UI) | complete |
| 5 | Definir plano de validação (testes, queries de verificação, métricas) | complete |
| 6 | Executar implementação por lotes e registrar evidências | complete |

## Backlog Priorizado
### Lote A — Crítico
- GAP-03: Capturar `valorVenal`, `areaConstruida`, `areaTerreno`, `anoConstituicao` no scraper IPTU e propagar para respostas de mineração.
- GAP-05: Persistir `cpfMae`, `escolaridade`, `tipoLogradouro` e `estadoCivil` no cache e no `Contato` (com migration do schema).

### Lote B — Alto
- Expor no endpoint de proprietários e renderizar na UI: `ppe`, `obitoProvavel`, `participacoesEmpresas`, `redesSociais`, `setor`, `cnpjEmpresa`, `endereco`, `perfilInvestidor`, `anoConstituicao`.

### Lote C — Médio
- Melhorar cruzamento `Contato -> Campanha -> EmpreendimentoConhecimento` para mostrar contexto de empreendimento no detalhe do proprietário.

### Lote D — GAP-01
- Enriquecer seleção de edifício com resumo estrutural vindo de `Imovel`: unidades, pavimentos, elevadores, vagas/garagens, áreas, geolocalização, código do edifício e códigos construtivos.
- Renderizar esses dados na busca por bairro, busca por nome e cabeçalho do edifício selecionado.

### Lote E — GAP-02
- Injetar automaticamente dados estruturais da prefeitura/MAPA no `EmpreendimentoConhecimento` ao criar/aplicar briefing de campanha.
- Preservar briefing humano e briefing IA, acrescentando somente o bloco `dadosEstruturaisMapa`.

## Status de Entrega
- Lote A concluído.
- Lote B concluído.
- Lote C parcialmente concluído (GAP-07 entregue no detalhe do proprietário; GAP-01/02 seguem como evolução da etapa de seleção/briefing).
- Lote D concluído para GAP-01. GAP-02 segue como próxima evolução: injetar o mesmo resumo estrutural no `EmpreendimentoConhecimento`.
- Lote E concluído para GAP-02: campanhas passam a criar/vincular conhecimento com dados MAPA quando o empreendimento é encontrado na base local.

## Critérios de Sucesso
- Nenhum campo crítico coletado fica sem persistência (ex.: `valorVenal`, `areaConstruida`, `cpfMae`, `escolaridade`).
- Campos de alto impacto operacional aparecem no CRM (`ppe`, `obitoProvavel`, dados profissionais/societários relevantes).
- Cada GAP priorizado tem owner técnico, alteração definida e estratégia de teste.

## Riscos e Mitigações
| Risco | Impacto | Mitigação |
|---|---|---|
| Mudança de schema sem migração segura | Quebra em produção | Criar migration incremental e rollout por feature flag quando necessário |
| Regex frágil no scraper IPTU | Dados inconsistentes | Cobrir parser com testes de fixtures HTML reais |
| Exposição indevida de dados sensíveis na UI | Risco LGPD/compliance | Validar campos exibidos e regras de mascaramento/perfil de acesso |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Nenhum até o momento | - | - |
