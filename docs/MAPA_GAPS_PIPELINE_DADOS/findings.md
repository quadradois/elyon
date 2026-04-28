# Findings — Pipeline Mineração → CRM

## Fonte analisada
- `/root/elyon/docs/MAPA_GAPS_PIPELINE_DADOS/MAPA_GAPS_PIPELINE_DADOS.md` (data: 2026-04-27)

## Descobertas principais
1. O diagnóstico já está estruturado por etapas do pipeline (1 a 5) com mapeamento claro de onde os dados entram, se perdem e onde deixam de ser exibidos.
2. Gaps críticos identificados no documento:
- GAP-03: `valorVenal` e `areaConstruida` não extraídos no scraper IPTU (marcados como `N/D`).
- GAP-05: `cpfMae` e `escolaridade` chegam da Assertiva, mas são descartados antes de persistir.
3. Gaps altos de UI/uso operacional:
- Campos já presentes em `Contato` não exibidos em `ProprietarioDetalhes` (`ppe`, `obitoProvavel`, `participacoesEmpresas`, `redesSociais`, etc.).
4. Gaps médios de integração de contexto:
- Dados estruturais de `Imovel` não enriquecem seleção de edifício nem briefing do `EmpreendimentoConhecimento`.
- GAP-01: a tabela `imoveis` contém campos estruturais por unidade (`numeroPavimentos`, `numeroElevadores`, vagas, áreas, geolocalização e códigos construtivos), enquanto `edificios` só guarda dados cadastrais básicos. A solução segura é agregar por `codigoEdificio` em `MapaService` antes de devolver a lista para a UI.
- Em `ED PEDRA DA LUA` (`codigoEdificio=4798`), a base local possui `totalUnidades` e `areaTerreno`, mas pavimentos/elevadores/vagas/códigos construtivos estão nulos. A tela deve exibir apenas o que existe.
- Em `TOCANTINS` (`codigoEdificio=834`), a base local confirma dados ricos: 67 unidades, 54 pavimentos, 3 elevadores, área do terreno, geolocalização e códigos construtivos. Esse caso valida o GAP-01 end-to-end.
- GAP-02: o ponto correto de injeção é onde `briefingCompleto` e `briefingEstruturado` são criados/atualizados: CRUD de campanhas e aplicação de pesquisa Manus. A injeção deve adicionar `dadosEstruturaisMapa` ao JSON e um bloco textual "Dados estruturais da prefeitura/MAPA" ao briefing completo.
- O casamento por nome de empreendimento pode ser ambíguo quando o termo é genérico (ex.: `TOCANTINS`). O serviço usa filtros em camadas: nome+logradouro+bairro, depois nome+logradouro, e evita cair para nome puro quando logradouro foi informado para não vincular ao edifício errado.
- Vínculo `Contato -> Campanha -> Empreendimento` não é refletido na visualização de proprietário.

## Hipóteses de trabalho (a validar no código)
- Existem pontos de mapeamento incompleto em rotas de processamento/vinculação (camada de serviço/controlador).
- Parte dos campos no schema está órfã por ausência de preenchimento (ex.: `estadoCivil`, `perfilInvestidor`, `anoConstituicao`).
- Falta contrato de exibição entre backend e frontend para campos já persistidos.

## Próximos artefatos esperados
- Matriz `GAP -> arquivo -> função -> ajuste`.
- Backlog priorizado com lotes de entrega.
- Plano de testes por etapa do pipeline.

## Matriz Técnica — GAP -> Arquivo -> Ajuste
| GAP | Arquivo(s) | Ajuste técnico |
|---|---|---|
| GAP-03 | `src/servicos/scraper-iptu.ts`, `src/rotas/mineracao/processamento.rotas.ts` | Extrair novos campos do HTML (`valorVenal`, `areaConstruida`, `areaTerreno`, `anoConstituicao`) e incluir na resposta de `/iptu-unitario` e payload de confirmação. |
| GAP-05 | `src/servicos/assertiva.ts`, `src/rotas/mineracao/processamento.rotas.ts`, `src/rotas/campanhas/contatos.rotas.ts`, `prisma/schema.prisma` | Incluir `cpfMae`, `escolaridade`, `estadoCivil` e `tipoLogradouro` no mapeamento, cache e persistência de `Contato`; criar migration para novos campos ausentes no schema. |
| GAP-06 | `src/servicos/assertiva.ts`, `src/rotas/campanhas/contatos.rotas.ts` | Mapear `estadoCivil` da Assertiva para `Contato.estadoCivil`; calcular `perfilInvestidor` a partir de `participacoesEmpresas`. |
| GAP-UI-1/2/3/4 | `src/rotas/proprietarios.ts`, `frontend/src/paginas/ProprietarioDetalhes/index.tsx` | Expor e renderizar compliance (`ppe`, `obitoProvavel`), dados societários/redes, dados profissionais e endereço residencial. |
| GAP-07 | `src/rotas/proprietarios.ts`, `frontend/src/paginas/ProprietarioDetalhes/index.tsx` | Exibir contexto de empreendimento via `campanha.empreendimento` (nome/tipo/localização quando disponível). |

## Evidências de Implementação
- `GAP-03` implementado no scraper e no endpoint unitário:
  - `src/servicos/scraper-iptu.ts` agora extrai `valorVenal`, `areaConstruida`, `areaTerreno`, `anoConstituicao`.
  - `src/rotas/mineracao/processamento.rotas.ts` passou a retornar esses campos em `/iptu-unitario`.
- `GAP-05/GAP-06` implementados no enriquecimento e persistência:
  - `src/servicos/assertiva.ts` mapeia `estadoCivil`.
  - `src/rotas/mineracao/processamento.rotas.ts` salva em cache `cpfMae`, `escolaridade`, `estadoCivil`, `tipoLogradouro`.
  - `src/rotas/campanhas/contatos.rotas.ts` persiste novos campos em `Contato` e calcula `perfilInvestidor`.
  - `prisma/schema.prisma` + migration `20260428003000_add_campos_complementares_contato`.
- `GAP-UI` e `GAP-07` implementados:
  - `src/rotas/proprietarios.ts` expõe dados de compliance/societário e inclui `campanha.empreendimento`.
  - `frontend/src/paginas/ProprietarioDetalhes/index.tsx` renderiza compliance (`ppe`, `obitoProvavel`), societário/redes, endereço residencial e contexto de empreendimento.

## Validação executada
- Teste focado: `src/__tests__/rotas/mineracao.test.ts` (4/4 passando).
- Build backend: `npm run build` (ok).
- Build frontend: `npm run build` (ok).
