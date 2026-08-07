# Monitoramento do fallback GEO360

## Objetivo

Medir quais buscas de empreendimentos ainda dependem do legado antes de definir
`MINERACAO_LEGADO_FALLBACK=false`.

## Métrica

O backend expõe o contador:

```text
elyon_geo360_buscas_empreendimento_total{resultado="..."}
```

Resultados possíveis:

- `geo360`: atendida pela fonte canônica;
- `legado_local`: atendida pela base legada local;
- `legado_api`: atendida pela API antiga;
- `mock`: atendida pelo fallback estático;
- `vazio`: nenhuma fonte encontrou;
- `legado_desabilitado`: GEO360 não encontrou e o fallback já estava desligado.

Exemplo PromQL para o volume das últimas 24 horas:

```promql
sum by (resultado) (
  increase(elyon_geo360_buscas_empreendimento_total[24h])
)
```

Proporção de buscas que ainda dependem do legado:

```promql
sum(increase(elyon_geo360_buscas_empreendimento_total{
  resultado=~"legado_local|legado_api"
}[7d]))
/
sum(increase(elyon_geo360_buscas_empreendimento_total[7d]))
```

## Fila de aliases

Somente termos com letras são persistidos. Sequências com seis ou mais dígitos
são descartadas para não armazenar IPTU, CPF ou CNPJ. Os registros são agregados
por hash e não possuem chave estrangeira para tabelas legadas.

Relatório dentro do container de produção:

```bash
docker exec elyon_backend node dist/scripts/relatorio-fallback-geo360.js 100
```

O número final limita a quantidade de termos, entre 1 e 1.000. A fila é ordenada
por quantidade de ocorrências e uso mais recente.

## Critério para desligamento

Antes de alterar `MINERACAO_LEGADO_FALLBACK=false`:

1. revisar os termos pendentes mais frequentes;
2. criar aliases GEO360 apenas quando o lote estiver confirmado;
3. marcar os itens tratados como `RESOLVIDO`;
4. manter a dependência do legado abaixo de 1% por sete dias;
5. confirmar ausência de chamadas com resultado `legado_api`.
