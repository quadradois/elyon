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
O recibo da inbox apenas persiste o fragmento e conclui rapidamente. O loop do
worker possui um segundo claimer durável, independente da inbox, que localiza
lotes com `fechaEm` vencido. Assim, um único loop serial consegue ingerir duas
mensagens e só depois executar uma vez o agente; não é necessário manter o
primeiro recibo ocupado nem depender de dois workers.

Cada claim incrementa `fencingToken`. Heartbeat falso ou rejeitado invalida o
owner em memória. As tools possuem classificação fechada. `POSTGRES_MUTATION`
executa pelo command executor que bloqueia o lote e valida owner, token, status
e prazo dentro da mesma transação da escrita. `READ_ONLY` não abre essa
transação. `EXTERNAL_EFFECT` executa fora da transação PostgreSQL, por intenção
própria; reservas anteriores ficam fail-closed para reconciliação. Classificação
ausente é erro. Lease vencido reverte todas as escritas da tool antes do commit.

Envios externos usam `efeitos_lotes_inbound`. O contrato distingue:

- `NOVA`: intenção criada e ainda não enviada;
- `RESERVADA`: tentativa anterior não confirmou o resultado; deve ser reconciliada;
- `CONCLUIDA`: o provider confirmou o envio.

Uma intenção `RESERVADA` nunca equivale a sucesso. O adapter Evolution encaminha
`Idempotency-Key`, mas esta baseline não possui evidência contratual de que o
provider o honre nem consulta confiável por ID/status. Portanto, o takeover não
reenvia automaticamente: mantém o lote recuperável, não persiste resposta local
e exige reconciliação operacional. Apenas `NOVA` pode chamar o adapter e apenas
`CONCLUIDA` representa confirmação.

Estados do lote:

- `ABERTO`: recebe fragmentos até `fechaEm`;
- `PROCESSANDO`: possui lease exclusivo;
- `CONCLUIDO`: efeitos finalizados uma vez;
- `FALHO`: recuperável pelo claimer de lotes, sem resposta de fallback;
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
- falha do agente mantendo lote `FALHO`, recuperável pelo claimer, e zero resposta enganosa;
- tool real lenta com expiração durante a transação e zero mutações do owner vencido;
- classificação provando read-only sem transação, PostgreSQL sob fence e efeito
  externo fora da transação;
- crash antes do envio, depois do envio e antes da confirmação, e takeover sem
  resposta fantasma ou duplicação;
- teste atravessando o adapter Evolution e provando que `RESERVADA` não reenvia;
- scrape de `/metrics` do worker contendo as métricas dos lotes.

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
3. publicar um worker com o claimer de lotes habilitado no mesmo processo e
   confirmar `/ready` e `/metrics` antes de receber tráfego;
4. observar duas janelas completas e comparar recibos concluídos, fragmentos,
   lotes vencidos/concluídos, takeovers, intenções reservadas e respostas enviadas;
5. reconciliar manualmente intenções `RESERVADA` por evidência do provider; não
   reenviar apenas pela presença do header idempotente, e ampliar
   workers somente com zero duplicação, fencing saudável e backlog estável;
6. manter tabelas e colunas de fencing durante todo o período de observação.

## Rollback e limpeza

Rollback deve primeiro retirar tráfego do worker novo e pausar seu claimer de
lotes; somente depois deve aguardar leases ou registrar os lotes ainda
`ABERTO/PROCESSANDO/FALHO` e restaurar a imagem anterior. O worker antigo e o
claimer novo nunca operam simultaneamente. A migration é expand-only; derrubar tabelas no rollback
perderia fragmentos e exige uma migration de contract posterior, backup e
confirmação de backlog zero.

Fixtures de teste são removidas por cascade a partir dos tenants sintéticos e o
Redis dedicado é limpo ao final. Produção não recebe cleanup automático de lote:
retenção/arquivamento deve ser definida separadamente após observar volume real.

## Riscos residuais

- aumento de escrita proporcional a cada inbound;
- lote `FALHO` depende do claimer durável do worker para reprocessar;
- rollback para o debounce em memória perde a garantia durável para mensagens novas;
- metadados de mídia permanecem sujeitos à validade do objeto externo referenciado.

As issues #55, #56 e #57 e demais itens da Onda 1 permanecem fora desta entrega.
