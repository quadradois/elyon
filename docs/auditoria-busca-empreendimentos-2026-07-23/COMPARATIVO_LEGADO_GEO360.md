# Comparativo de dados — Legado versus GEO360

Data da análise: 23/07/2026  
Ambiente: produção  
Escopo: `imoveis`, `edificios_geo`, `bairros_geo` versus `imoveis_rancho`, `geo360_lotes`, `geo360_lote_aliases` e `geo360_midias_lote`.

Todas as medições são agregadas. Nenhum CPF ou nome de proprietário foi incluído no relatório.

## Veredito

O GEO360 já cobre **704.121 dos 704.500 registros legados**, equivalentes a **99,946%** da base `imoveis`. Além disso, contém 126.247 imóveis adicionais de Goiânia e 284.864 imóveis de Aparecida de Goiânia.

O legado ainda possui quatro grupos de informação que merecem tratamento antes da desativação:

1. Catálogo de nomes de edifícios e o código de agrupamento `codigoEdificio`.
2. Características construtivas detalhadas de uma pequena parcela dos registros.
3. Alguns campos explícitos de unidade, bloco, apartamento e box.
4. Um resíduo de 379 inscrições que não encontrou correspondência exata no GEO360.

Isso justifica uma **migração de patrimônio**, não um fallback permanente em tempo de execução.

## Cobertura geral

| Base | Cidade | Registros |
|---|---|---:|
| Legado `imoveis` | Goiânia | 704.500 |
| GEO360 `imoveis_rancho` | Goiânia | 830.368 |
| GEO360 `imoveis_rancho` | Aparecida de Goiânia | 284.864 |
| GEO360 total | Duas cidades | 1.115.232 |

### Sobreposição por inscrição imobiliária

| Situação | Quantidade |
|---|---:|
| Presente no legado e GEO360 Goiânia | 704.121 |
| Somente no legado | 379 |
| Somente no GEO360 Goiânia | 126.247 |

Dos 379 registros exclusivos do legado:

- 4 possuem nome de edifício;
- nenhum possui CPF de proprietário;
- 1 possui coordenadas;
- 1 possui detalhe construtivo;
- 378 possuem alguma área positiva.

Esses 379 registros devem ser colocados em quarentena e classificados como cancelados, alterados, inválidos ou realmente ausentes antes de qualquer exclusão.

## O que o legado realmente tem e o GEO360 não oferece da mesma forma

### 1. Nomes e agrupamentos de edifícios — valor alto

O legado possui:

- 11.027 registros em `edificios_geo`;
- 11.026 deles com nome;
- 10.977 com total de unidades;
- 314.173 imóveis com `nomeEdificio`;
- 13.947 grafias distintas de nomes.

Dentro dos registros que existem nas duas bases:

- 314.169 unidades possuem nome no legado;
- 281.143 também possuem `nome_condominio` no GEO360;
- 33.026 unidades possuem nome apenas no legado;
- essas unidades representam 10.559 grafias distintas ainda sem nome oficial GEO360 e sem alias validado.

Exemplos de nomes úteis presentes apenas no legado:

| Nome legado | Unidades | Lotes GEO360 |
|---|---:|---:|
| PARTHENON CENTER | 782 | 1 |
| ED.EXECUTIVE TOWER | 255 | 1 |
| JUSCELINO KUBITSCHEK NEW CONCEPT BUSINESS | 221 | 1 |
| AQUARIUS CENTER | 191 | 1 |
| GOIAS CENTER MODAS | 163 | 1 |
| PROSPERE OFFICE HARMONY | 127 | 1 |
| EDIFICIO REPUBLICA TOWER | 111 | 1 |

As 10.559 grafias não equivalem necessariamente a 10.559 empreendimentos distintos. Há abreviações, variações ortográficas, nomes históricos e possíveis registros inadequados. Elas devem alimentar um catálogo candidato de aliases, com normalização e rastreabilidade.

### 2. Características construtivas estruturadas — valor médio e baixa cobertura

O legado possui campos estruturados que não existem como colunas normalizadas no GEO360:

- número de pavimentos;
- número de elevadores;
- vagas cobertas e descobertas;
- número de garagens;
- esquadrias;
- piso;
- forro;
- instalações elétricas e sanitárias;
- revestimentos e acabamentos internos/externos;
- estado de conservação;
- data original de cadastro na prefeitura.

Cobertura real:

| Informação no legado | Registros úteis |
|---|---:|
| Pavimentos positivos | 7.254 |
| Elevadores positivos | 5.589 |
| Garagens positivas | 3.123 |
| Vagas cobertas positivas | 199 |
| Vagas descobertas positivas | 505 |
| Estrutura/esquadrias/piso/forro/conservação preenchidos | aproximadamente 7.261 |
| Data de cadastro na prefeitura | 7.262 |

Isso representa cerca de 1,03% da base legada. É informação potencialmente valiosa, mas não justifica manter toda a base operacional como fallback.

O `raw` do GEO360 contém, com cobertura muito maior, atributos como `estrutura`, `cobertura`, `revestimento_externo`, `topografia`, `pedologia`, `situacao_lote` e áreas detalhadas. Portanto, parte da vantagem aparente do legado já existe no GEO360, apenas ainda não foi normalizada.

### 3. Unidade, bloco, apartamento e box — valor baixo a médio

O legado possui colunas separadas:

| Campo | Registros preenchidos |
|---|---:|
| Apartamento | 1.411 |
| Unidade | 1.411 |
| Bloco | 160 |
| Box | 1.038 |

O GEO360 não possui todas essas colunas separadas, mas oferece:

- `complemento`;
- `nr_unidade` dentro do JSON original;
- `nr_porta`;
- tipo de edificação;
- identificação por inscrição e lote.

Em Goiânia, `nr_unidade` aparece em 830.360 registros GEO360. Assim, a decomposição explícita do legado pode ser preservada como enriquecimento, mas o GEO360 tem cobertura muito superior para a identificação da unidade.

### 4. Campo `nomeEmpresa` — valor desconhecido

O legado possui `nomeEmpresa` em 25.279 registros. A semântica registrada no código é apenas “Layer 9”; não há evidência suficiente de que represente construtora, incorporadora, condomínio ou outra entidade.

Esse campo não deve ser migrado como “construtora” sem uma investigação amostral e regra de negócio explícita.

## O que parece exclusivo, mas não agrega valor real

| Campo legado | Situação |
|---|---|
| `certidaoCache` | 0 registros |
| `leadId` | 0 registros |
| `interesse` | 0 registros |
| `histProprietarios` | 1 registro |
| `statusCaptacao` | Todos os 704.500 registros têm apenas o valor padrão `IDENTIFICADO` |
| `cpfProprietario` | 704 registros, contra 784.505 CPFs/CNPJs no GEO360 Goiânia |
| Coordenadas | 7.262 registros, contra 830.192 no GEO360 Goiânia |

Esses campos não sustentam a manutenção do legado como fonte paralela.

## O que o GEO360 tem e o legado não tem, ou tem com cobertura muito menor

- Goiânia mais completa e Aparecida de Goiânia.
- CPF/CNPJ e nome do proprietário com alta cobertura.
- Coordenadas praticamente completas.
- Identificador oficial `id_lote`.
- Número do cadastro, setor, quadra, bairro e lote oficiais.
- Endereço oficial por unidade e caracterização agregada do lote.
- Ocupação e tipo de edificação GEO360.
- Áreas construídas e de terreno com cobertura superior.
- Fotos públicas e foto principal da fachada.
- Nome oficial do condomínio quando fornecido pelo portal.
- Alias comercial versionado, validado e separado do dado oficial.
- Datas de sincronização, caracterização, unidades e mídias.
- JSON original preservado para reprocessamento futuro.

## O identificador legado não pode ser copiado cegamente

Considerando apenas `codigoEdificio > 0`:

| Relação | Quantidade |
|---|---:|
| Códigos legados analisados | 10.974 |
| Código legado ligado a exatamente 1 lote GEO360 | 7.688 |
| Código legado ligado a 2 ou 3 lotes GEO360 | 3.286 |
| Lotes GEO360 ligados a exatamente 1 código legado | 13.565 |
| Lotes GEO360 ligados a vários códigos legados | 229 |
| Maior quantidade de códigos em um único lote | 42 |

Há ainda 390.264 imóveis no legado com `codigoEdificio = 0`, principalmente imóveis que não pertencem a um edifício agrupado.

Consequência: `codigoEdificio` e `id_lote` não são identidades equivalentes. O primeiro é um agrupador legado; o segundo é a identidade geográfica oficial do lote.

## Classificação para migração

### Migrar

- Nomes de `edificios_geo` e `imoveis.nomeEdificio`.
- Relação histórica entre nome, `codigoEdificio`, endereço e inscrições.
- Características construtivas que tenham uso definido no produto.
- Data de cadastro municipal, se houver caso de uso.
- Apartamento, bloco e box quando aumentarem a qualidade da unidade.

### Validar antes de migrar

- `nomeEmpresa`.
- Grafias duplicadas ou genéricas de edifícios.
- Códigos que apontam para 2 ou 3 lotes.
- Lotes que recebem vários códigos legados.
- Os 379 imóveis sem correspondência GEO360.

### Não migrar como patrimônio imobiliário

- Estados operacionais vazios ou apenas com valor padrão.
- Cache de certidão vazio.
- Relações de lead inexistentes.
- Campos duplicados em que o GEO360 tem maior cobertura e melhor rastreabilidade.

## Estratégia recomendada sem fallback permanente

1. Criar uma rotina de reconciliação offline entre inscrição, endereço, `codigoEdificio` e `id_lote`.
2. Para os 7.688 códigos com mapeamento 1:1, gerar aliases candidatos de alta confiança.
3. Para os 3.286 códigos ligados a múltiplos lotes, aceitar o mesmo nome em vários lotes somente quando endereço e unidades confirmarem o agrupamento.
4. Para os 229 lotes com múltiplos códigos, preservar múltiplos aliases e identificar nomes históricos/torres.
5. Guardar a origem `LEGADO`, confiança, evidência e data de migração em cada alias.
6. Migrar características construtivas para uma estrutura com fonte e data, sem sobrescrever o GEO360.
7. Colocar os 379 registros exclusivos em uma tabela de quarentena.
8. Executar testes de paridade de busca.
9. Desligar o fallback legado quando todos os itens estiverem migrados, descartados ou justificados.

## Critérios para desativar o legado

- 100% dos 10.974 códigos positivos classificados.
- 100% dos 379 registros exclusivos classificados.
- Nenhum nome de edifício de alta frequência perdido na busca.
- Busca por nome, endereço e IPTU com paridade ou melhoria comprovada.
- Métrica de consultas ao legado igual a zero durante o período de observação.
- Nenhuma chamada à API antiga da prefeitura.
- Rollback disponível por versão do catálogo migrado.
