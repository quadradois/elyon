# Modularização incremental do webhook

## Recorte da Issue #16

O primeiro hotspot escolhido foi `src/rotas/webhook.ts`, por combinar o maior tamanho do backend com efeitos externos de alto impacto. A rota HTTP e a função pública `processarWebhookEvolution` permanecem nos mesmos caminhos e com as mesmas assinaturas.

Medição do recorte:

- antes: 2.350 linhas em `webhook.ts`;
- depois: 1.936 linhas;
- redução: 414 linhas (17,6%);
- endpoint preservado: `POST /` do router de webhook;
- contratos Evolution Go/Baileys cobertos por testes de caracterização.

## Fronteiras introduzidas

- `modulos/webhook/dominio`: tipos e policies puras de texto, áudio, documentos, exclusividade e idempotência;
- `modulos/webhook/aplicacao`: casos de uso para preparar conteúdo e decidir o canal da resposta;
- `modulos/webhook/adapters`: tradução do payload Evolution Go para o contrato interno consumido pela rota;
- `rotas/webhook.ts`: orquestra banco, Redis, agentes e integrações externas.

O domínio não conhece Express, Prisma, serviços, adapters ou casos de uso. A aplicação depende somente do domínio. Módulos não podem importar rotas.

## Regra verificável

`npm run test:architecture --workspace @elyon/backend` percorre `src/modulos` e falha quando encontra dependências proibidas. O comando roda no job de backend do CI, antes da suíte unitária. Os cenários de falha e permissão também têm testes unitários.

## Estratégia incremental

Novos recortes devem repetir a sequência:

1. caracterizar o contrato atual;
2. extrair domínio puro;
3. introduzir casos de uso e portas;
4. manter efeitos nos adapters/rotas;
5. medir a redução e executar regressão funcional e de tenant.

Leads e campanhas continuam como próximos hotspots, sem reescrita ampla neste PR.
