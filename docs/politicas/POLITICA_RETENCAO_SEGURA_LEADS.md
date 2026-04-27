# Política de Retenção Segura de Leads (Agente IA)

Data: 26/04/2026

## Objetivo
Permitir remoção de dados sensíveis sem causar regressão de aprendizado no agente.

## Regra operacional
1. Preferir **retenção segura** (anonimização) antes de exclusão permanente.
2. Usar exclusão permanente apenas quando houver exigência legal/contratual explícita.

## O que a retenção segura faz
1. Anonimiza PII do lead (`nome`, `cpf`, `email`, `telefones`, campos sensíveis).
2. Redige conteúdo das mensagens da conversa.
3. Anonimiza origem das conversas.
4. Mantém métricas e estruturas de aprendizado (`aprendizados_agente`, `paol_politicas`, auditoria).
5. Opcionalmente remove embeddings de RAG (padrão: remove, para reduzir risco de PII residual).

## Impacto em aprendizado
1. **Não zera** o aprendizado agregado do agente.
2. Pode reduzir recall de RAG quando embeddings forem removidos.
3. Não perde métricas operacionais/auditoria por tenant.

## Endpoint
`POST /api/leads/:id/retencao-segura`

Body mínimo:
```json
{
  "confirmacao": "anonimizar"
}
```

Body com preservação de RAG:
```json
{
  "confirmacao": "anonimizar",
  "preservarRag": true
}
```

## Resposta esperada
1. Quantidade de mensagens/conversas anonimizadas.
2. Quantidade de embeddings removidos.
3. Token anônimo para trilha de auditoria.

## Boas práticas
1. Rodar retenção segura primeiro, revisar resultado e só então decidir se precisa exclusão total.
2. Em produção, manter trilha de auditoria (`LEAD_RETENCAO_SEGURA`).
3. Definir janela de execução fora de horários de pico.
