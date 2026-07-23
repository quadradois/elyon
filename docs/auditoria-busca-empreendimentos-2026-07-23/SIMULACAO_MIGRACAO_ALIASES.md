# Simulação de migração dos nomes legados para aliases GEO360

Data da simulação: 23/07/2026

## Resultado executivo

A simulação foi executada apenas com consultas de leitura. Nenhuma tabela do banco de produção foi alterada.

Foram classificados 14.338 vínculos candidatos entre os agrupamentos do legado e os lotes da GEO360:

| Destino da simulação | Linhas | Interpretação |
|---|---:|---|
| Elegíveis por evidência estrutural | 6.934 | Relação 1:1, totais iguais, ao menos duas unidades coincidentes e ausência de nome oficial/alias |
| Revisão manual ou regra adicional | 7.340 | Há ambiguidade, conflito, pouca evidência ou diferença de totais |
| Quarentena | 52 | Não foi possível relacionar o registro a um lote GEO360 |
| Ignorados | 12 | Agrupador zero ou nome já redundante com o oficial |
| **Total** | **14.338** | |

Os 6.934 registros do primeiro grupo passaram nas verificações estruturais:

- zero chaves duplicadas por cidade, lote e nome;
- zero registros com menos de duas unidades coincidentes;
- zero divergências entre total legado e total GEO360;
- todos com exatamente um código legado relacionado a exatamente um lote GEO360.

Apesar disso, esse conjunto deve ser entendido como **elegível pelo vínculo**, e não como autorização automática para publicar a grafia bruta. A amostra contém abreviações e ruídos históricos, como `RES.MARQUES -926`, que justificam uma etapa de normalização/apresentação antes da carga definitiva.

## Regras do grupo elegível

Um nome só entrou em `AUTO_ALIAS_1A1_TOTAIS_IGUAIS` quando todas estas condições foram satisfeitas:

1. a inscrição imobiliária existe nas duas bases;
2. um código de edifício legado aponta para um único `id_lote`;
3. o lote GEO360 recebe apenas esse código legado;
4. existem pelo menos duas unidades coincidentes;
5. o total de unidades do agrupamento legado é igual ao total do lote GEO360;
6. a GEO360 não possui nome oficial para o lote;
7. ainda não existe alias validado para o mesmo nome;
8. o nome não foi classificado pelas regras básicas como genérico ou suspeito.

Essa regra evita tratar `codigoEdificio` como se fosse o identificador do lote. Os dois campos não são equivalentes.

## Motivos enviados para revisão

| Classificação | Linhas | Códigos legados distintos | Lotes distintos |
|---|---:|---:|---:|
| Código legado relacionado a vários lotes | 6.548 | 3.262 | 6.133 |
| Conflito com nome oficial GEO360 | 353 | 353 | 353 |
| Divergência no total de unidades | 121 | 121 | 121 |
| Evidência de apenas uma unidade | 105 | 105 | 105 |
| Lote relacionado a vários códigos legados | 91 | 91 | 73 |
| Nome legado suspeito | 111 | 88 | 111 |
| Nome legado fraco ou genérico | 11 | 9 | 11 |
| **Total de linhas** | **7.340** | **4.029 únicos no conjunto** | **6.849 únicos no conjunto** |

Os totais distintos da última linha não são a soma das categorias, pois um mesmo código pode aparecer em mais de um vínculo.

### Exemplos que explicam as exceções

- `ABAETE`, código 1118, aparece associado aos lotes 165673 e 372264. Um deles já tem o nome oficial `EDIFÍCIO ABAETÉ`.
- `ALAMEDA DOS BURITIS` conflita textualmente com `EDIFÍCIO ALAMEDA DOS BURITIS`. É provavelmente equivalência semântica, mas foi mantida para revisão por segurança.
- `ANTONIO SILVA I` tem duas unidades no legado e três na GEO360.
- `ANAVILHANA` coincide em apenas uma unidade, enquanto o lote GEO360 possui cinco.
- O lote 210964 recebe oito códigos legados e possui o nome oficial `CONDOMÍNIO MARFIM`.
- Nomes como `RESIDENCIAL`, `0ES LP 04` e `3ESIDENCIAL MUCARI` foram retidos por baixa qualidade.

## O que cada base ainda acrescenta

O legado acrescenta principalmente nomes históricos de empreendimentos e o agrupamento das unidades por `codigoEdificio`. A GEO360 é a referência superior para inscrições, proprietário, endereço cadastral, áreas, geometria/localização, vínculo ao lote e mídias.

Portanto, o estado-alvo recomendado é:

- GEO360 como fonte canônica do imóvel e do lote;
- `geo360_lote_aliases` como camada controlada de nomes alternativos;
- legado somente como fonte de candidatos a alias durante a migração;
- busca consultando a GEO360 e seus aliases, sem fallback operacional permanente para a tabela legada.

## Decisão recomendada

**GO condicional para um piloto; NO-GO para inserir os 6.934 nomes brutos de uma só vez.**

Antes da escrita no banco:

1. criar a normalização de apresentação sem destruir o nome original de auditoria;
2. separar abreviações aceitáveis de erros prováveis;
3. revisar primeiro os 353 conflitos com nome oficial;
4. executar um piloto pequeno e reversível com candidatos de alta confiança;
5. testar a busca por nome, endereço e inscrição;
6. medir falsos positivos antes de ampliar o lote.

## Artefatos

- `aliases-auto.csv`: candidatos estruturalmente elegíveis;
- `aliases-revisao.csv`: candidatos que exigem regra adicional ou revisão;
- `aliases-quarentena.csv`: candidatos sem vínculo GEO360;
- `aliases-ignorados.csv`: agrupadores inválidos ou aliases redundantes;
- `exportar-simulacao-aliases.ps1`: consulta reproduzível, somente leitura.

Os arquivos exportados não contêm CPF nem inscrição imobiliária/IPTU. Eles mantêm apenas os identificadores técnicos e os dados necessários para auditar o vínculo.

## Piloto aplicado em 23/07/2026

O piloto `legacy-alias-pilot-20260723-v1` foi aplicado em produção após a simulação:

| Controle | Resultado |
|---|---:|
| Aliases inseridos | 100 |
| Aliases validados | 100 |
| Lotes distintos | 100 |
| Chaves duplicadas | 0 |
| Registros fora da normalização | 0 |
| Registros sem lote GEO360 | 0 |

Critérios adicionais usados no piloto:

- pelo menos três unidades coincidentes;
- nome entre 8 e 80 caracteres;
- ausência de números e caracteres de baixa qualidade;
- presença de vocabulário compatível com empreendimento;
- nome oficial GEO360 vazio;
- um código legado para um lote e um lote para um código;
- totais de unidades iguais.

Cada alias possui em `metadados` o lote de migração, código legado, nome original, contagens e regra aplicada. O rollback remove exclusivamente registros cujo `loteMigracao` seja `legacy-alias-pilot-20260723-v1`.

Validações funcionais no banco:

- busca sem acento por `portal barravento` encontrou o lote 60718;
- as quantidades retornadas por `imoveis_rancho` coincidiram com `geo360_lotes`;
- buscas de referência levaram aproximadamente 0,19 s por endereço e 0,71–0,92 s por alias/nome na medição inicial.

O teste visual do frontend não foi concluído nesta etapa porque a sessão disponível retornou à tela de login. A integração de aplicação foi preparada separadamente para que a rota existente consuma aliases, lotes e unidades GEO360 sem confundir `id_lote` com `codigoEdificio`.
