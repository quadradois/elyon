# Issue #54 — consolidação durável de mensagens sequenciais

Baseline: `main@7543983ad5b616fc181ea72cf9892215e37dd9fe`

Decisões: ADR-0002 e ADR-0003 aceitos. A identidade de agrupamento é
`tenantId + leadId`; nenhum `tenantId` do payload participa da autoridade.

## Contrato e ownership

PostgreSQL é a fonte de verdade. `lotes_mensagens_inbound` persiste janela,
estado, lease, tentativas e erro sanitizado. `fragmentos_mensagens_inbound`
persiste cada recibo da inbox uma vez por `webhookEventoId`, incluindo conteúdo,
tipo, instante e metadados de mídia necessários para retomar após restart.

O registro usa advisory lock transacional sobre `tenantId:leadId` e retry para
conflito serializável. O claim usa `FOR UPDATE SKIP LOCKED`. Fragmentos são
entregues ao agente por `recebidoEm, id`, e somente o owner do lease pode concluir,
falhar ou cancelar. Redis permanece apenas no mutex/dedupe compatível do fluxo
existente e não armazena o lote canônico.
O lease do lote acompanha o lease da inbox e possui heartbeat durante a execução
do agente, impedindo takeover enquanto o owner continua saudável.

Estados do lote:

- `ABERTO`: recebe fragmentos até `fechaEm`;
- `PROCESSANDO`: possui lease exclusivo;
- `CONCLUIDO`: efeitos finalizados uma vez;
- `FALHO`: recuperável pelo retry da inbox, sem resposta de fallback;
- `CANCELADO`: modo humano/pausado ou opt-out bloqueou a IA no claim.

Uma mensagem que chega depois do fechamento cria outro lote. Replay do mesmo
recibo retorna o lote original sem inserir fragmento. Lease expirado permite que
outro worker retome o lote persistido.

## Evidências

A baseline usa PostgreSQL 15/pgvector e Redis 7 reais, com LLM, Evolution, voz,
agenda e demais provedores sob doubles determinísticos. Os gates cobrem:

- duas mensagens produzindo uma execução e uma resposta;
- três fragmentos preservando ordem;
- novo lote depois da janela;
- replay sem fragmento duplicado;
- dois workers com um único claim;
- lease expirado/restart;
- isolamento entre dois tenants;
- mudança para `HUMANO`, `PAUSADO` ou opt-out durante a janela;
- falha do agente mantendo lote `FALHO`, inbox em retry e zero resposta enganosa.

Comando local reproduzido com infraestrutura dedicada:

```bash
npm run test:baseline
```

## Métricas

- `elyon_inbound_batches_open`: lotes abertos ou falhos aguardando recuperação;
- `elyon_inbound_batches_total{resultado="aberto"}`;
- `resultado="consolidado"`, `"expirado"`, `"reprocessado"`, `"falho"` ou
  `"cancelado"`.

Alertar sobre crescimento sustentado de lotes abertos/falhos, aumento de leases
expirados e ausência de consolidações após o deploy.

## Rollout

1. aplicar a migration expand antes do código;
2. confirmar índices, FKs e permissões do usuário da aplicação;
3. publicar um worker e observar por uma janela completa;
4. comparar recibos, fragmentos, lotes concluídos e respostas enviadas;
5. ampliar workers somente com zero duplicação e backlog estável;
6. manter tabelas novas durante todo o período de observação.

## Rollback e limpeza

Rollback de aplicação volta ao debounce anterior, mas não remove as tabelas.
Antes de voltar, pausar workers e aguardar leases ou registrar os lotes ainda
`ABERTO/PROCESSANDO/FALHO`. A migration é expand-only; derrubar tabelas no rollback
perderia fragmentos e exige uma migration de contract posterior, backup e
confirmação de backlog zero.

Fixtures de teste são removidas por cascade a partir dos tenants sintéticos e o
Redis dedicado é limpo ao final. Produção não recebe cleanup automático de lote:
retenção/arquivamento deve ser definida separadamente após observar volume real.

## Riscos residuais

- aumento de escrita proporcional a cada inbound;
- lote `FALHO` depende do retry da inbox para reprocessar;
- rollback para o debounce em memória perde a garantia durável para mensagens novas;
- metadados de mídia permanecem sujeitos à validade do objeto externo referenciado.

As issues #55, #56 e #57 e demais itens da Onda 1 permanecem fora desta entrega.
