# Política de logs seguros e correlação

## Objetivo

Os logs do ELYON devem permitir diagnóstico operacional sem registrar conteúdo de conversas, dados pessoais, credenciais ou payloads integrais.

## Campos permitidos

- IDs técnicos: `correlationId`, `jobId`, `tenantId`, `leadId`, `contatoId` e `socketId`.
- Estado operacional: componente, fase, status, contadores, duração e códigos de erro.
- HTTP: método, caminho sem query string, status e duração.
- Erros: tipo, mensagem e stack depois da sanitização central.

## Campos sempre redigidos

- Authorization, cookies, senhas, tokens, API keys e secrets.
- Telefone, e-mail, CPF/CNPJ e nomes de pessoas.
- Mensagens, prompts, reasoning, briefing, conteúdo e corpo bruto.
- `payload`, `body`, `args`, `result`, `input` e `output` estruturados.

A redação é aplicada em `src/lib/logger.ts`, inclusive às chamadas legadas de `console.*` executadas pelo servidor. Novos componentes devem usar o `logger` estruturado e nunca depender de redação manual.

## Correlation ID

- REST e webhooks aceitam `x-correlation-id` válido ou geram um UUID novo.
- A resposta sempre devolve `x-correlation-id`.
- WebSocket propaga o ID do handshake e o inclui na confirmação de autenticação.
- Jobs herdam o ID da requisição que os iniciou ou geram um UUID próprio e registram `jobId`.

IDs recebidos são limitados a 8–128 caracteres alfanuméricos e `._:-`; valores inválidos são substituídos para impedir injeção em logs.

## Verificação

Execute:

```bash
npm --prefix pacotes/backend run test:security:logs -- --coverage=false
```

O scanner de saída deve retornar zero ocorrências de e-mail, telefone, CPF/CNPJ, bearer token, JWT ou segredo rotulado em texto bruto.
