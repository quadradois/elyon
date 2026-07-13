# Webhooks seguros: configuração, implantação e rollback

Este runbook cobre os webhooks recebidos do Evolution, Asaas e Manus. Nunca registre
tokens, chaves, assinaturas ou o corpo integral dos eventos em logs, issues ou PRs.

## Controles aplicados

| Provedor | Endpoint | Autenticação | Proteção contra replay |
| --- | --- | --- | --- |
| Evolution Go | `/webhooks` | TLS + allowlist do IP fixo + ID/nome/token individual da sessão | SHA-256 do corpo bruto persistido |
| Asaas | `/api/billing/webhook/asaas` | `asaas-access-token` | `event.id` persistido |
| Manus | `/webhooks/manus` | RSA-SHA256, URL, timestamp e corpo bruto | janela de 5 minutos e `event_id` persistido |

Os identificadores são gravados em `webhook_eventos`. A restrição única por
provedor e evento torna o processamento idempotente inclusive entre réplicas e
reinicializações do backend.

## Variáveis obrigatórias

- `EVOLUTION_API_URL`: URL da Evolution Go dedicada; ela não roda na VPS do ELYON.
- `EVOLUTION_WEBHOOK_SOURCE_RANGE`: IP público IPv4 fixo da VPS Evolution Go em
  CIDR de host (`/32`). O mesmo valor protege o Traefik
  e é validado novamente pelo backend.
- `ASAAS_WEBHOOK_TOKEN`: token aleatório exclusivo, com pelo menos 32 caracteres,
  igual ao access token configurado no webhook do Asaas.
- `MANUS_API_KEY`: usada para consultar a chave pública oficial quando
  `MANUS_WEBHOOK_PUBLIC_KEY` não estiver definida.
- `MANUS_WEBHOOK_URL`: URL pública exata cadastrada no Manus. A assinatura depende
  dessa URL, incluindo caminho e query string.
- `MANUS_WEBHOOK_PUBLIC_KEY` (opcional): chave pública PEM fixada. Se ausente, o
  backend consulta a API do Manus e mantém cache por uma hora.

Gere segredos diretamente no host de produção, grave-os no `.env` com permissão
restrita e não os imprima no terminal ou no histórico do CI. Mudanças no IP da
VPS Evolution Go exigem atualizar o CIDR antes da troca de origem.

## Preparação dos provedores

### Evolution Go dedicada

A Evolution Go oficial envia apenas `Content-Type` no webhook e não oferece
assinatura ou cabeçalho customizado. A origem é, portanto, restrita ao IP fixo da
VPS dedicada em duas camadas: o Traefik rejeita a conexão na borda e o backend
confere `req.ip` usando um único proxy confiável. O backend ainda exige que
`instanceName`, `instanceId` e `instanceToken` correspondam exatamente a uma
sessão ELYON. Isso isola outras instâncias que compartilham a mesma VPS. TLS
protege o tráfego e o recibo persistente impede efeitos duplicados.

Ao conectar uma sessão, `WhatsAppService` registra
`https://api.elyon.ia.br/webhooks` e assina `MESSAGE`, `CONNECTION` e `QRCODE`
usando o token individual guardado em `sessoes_whatsapp.evolutionToken`. Não há
Evolution API local no Compose do ELYON.

### Asaas

No painel ou API do Asaas, configure a URL
`https://api.elyon.ia.br/api/billing/webhook/asaas` e o mesmo valor de
`ASAAS_WEBHOOK_TOKEN` como access token. Mantenha a entrega habilitada e confirme
que não existem webhooks antigos apontando para o endpoint sem autenticação.

### Manus

Cadastre exatamente a URL de `MANUS_WEBHOOK_URL`. Confirme que a chave pública
pode ser obtida pela API ou fixe a PEM fornecida oficialmente em
`MANUS_WEBHOOK_PUBLIC_KEY`.

## Implantação

1. Faça backup do `.env` e do banco, sem copiar segredos para o repositório.
2. Defina as novas variáveis no host e restrinja o `.env` ao usuário de deploy.
3. Configure o access token do Asaas e valide o cadastro do Manus.
4. Execute o deploy normal. O `scripts/deploy.sh` cria o backup pré-deploy, aplica
   a migração e substitui somente os contêineres pertencentes ao ELYON.
5. Confirme `/health`, os três frontends e os logs sanitizados do backend.
6. Envie chamadas de uma origem fora da allowlist apenas com payload inofensivo e
   confirme `403`.
   Não simule eventos financeiros válidos em produção.

## Critérios de aceitação operacional

- Requisição Evolution fora da origem permitida recebe `403`; Asaas ou Manus sem
  prova de origem recebe `401`. Nenhuma delas produz efeito de negócio.
- Segunda entrega do mesmo evento recebe sucesso idempotente e não repete efeito.
- Evento desconhecido do Asaas é registrado e ignorado com `202`.
- Erros internos retornam `5xx`, permitindo nova tentativa pelo provedor.
- Nenhum segredo, assinatura ou payload sensível aparece nos logs.

## Rollback

O rollback das imagens pode ser executado pelo fluxo de deploy existente. A tabela
`webhook_eventos` é aditiva e pode permanecer no banco. O backup e os volumes da
Evolution API local aposentada permanecem preservados durante a retenção; eles não
devem voltar ao deploy regular. Se o IP da VPS dedicada mudar durante um rollback,
atualize `EVOLUTION_WEBHOOK_SOURCE_RANGE` antes de aceitar novas entregas.
