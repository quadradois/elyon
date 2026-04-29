# Fluxo de Pagamento Asaas (Pós Go-Live)

## Contexto
Durante a estabilização operacional do ELYON, os fluxos de billing foram ajustados para segurança e consistência, mas a etapa de cobrança real ainda está parcialmente simulada.

## Problema
Os endpoints de billing ainda não executam o ciclo completo de pagamento em produção:
- `POST /billing/recarga` cria transação pendente, mas sem link/cobrança final para o cliente.
- `POST /billing/upgrade` ainda contém confirmação automática simulada, sem cobrança real pro-rata.

## Escopo futuro
Implementar integração completa com Asaas para:
- gerar cobrança real em recarga;
- gerar cobrança real para upgrade de plano;
- confirmar créditos/mudança de plano somente após evento de pagamento confirmado (webhook);
- remover totalmente qualquer trecho de simulação de confirmação.

## Impactos
- Financeiro: passa a existir trilha real de cobrança e conciliação.
- Operacional: evita ativação de créditos/plano sem pagamento confirmado.
- Produto: experiência de checkout consistente e auditável.

## Critério de pronto futuro
- Recarga retorna dados de pagamento válidos (PIX/link) para o cliente.
- Upgrade não altera plano imediatamente sem confirmação do pagamento.
- Webhook Asaas processa confirmação e finaliza transação com idempotência.
- Testes automatizados cobrindo cenários: sucesso, falha, atraso e webhook duplicado.
- Sem TODO/simulação de pagamento nos fluxos produtivos.

## Prioridade
`P1` alto (habilitar após estabilização operacional)

## Status
`Pendente`

## Condição de execução
Implementar **somente quando o sistema estiver 100% operacional** (decisão explícita do time).
