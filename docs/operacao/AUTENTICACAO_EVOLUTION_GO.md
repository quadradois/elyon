# Matriz de autenticação — Evolution Go

Fonte autoritativa do deployment: `CRM_EVOLUTION_CONTRACT.md`, auditado contra
o código implantado do Evolution Go em 2026-07-16. A confirmação operacional do
tenant canônico, da chave correspondente e do commit/versão implantado deve ser
feita com a equipe Evolution Go pelo canal seguro, sem registrar valores.

## Escopos

| Operação | `apikey` | Contexto adicional |
| --- | --- | --- |
| `/tenant/*` | Global API Key | nenhum |
| `POST /instance/create` | `EVOLUTION_TENANT_API_KEY` | `X-Tenant-ID: EVOLUTION_TENANT_ID` |
| `GET /instance/all` | `EVOLUTION_TENANT_API_KEY` | `X-Tenant-ID: EVOLUTION_TENANT_ID` |
| `GET /instance/info/{id}` | `EVOLUTION_TENANT_API_KEY` | `X-Tenant-ID: EVOLUTION_TENANT_ID` |
| `DELETE /instance/delete/{id}` | `EVOLUTION_TENANT_API_KEY` | `X-Tenant-ID: EVOLUTION_TENANT_ID` |
| connect, QR, status, reconnect e logout | token individual | nenhum |
| `/send/*`, `/message/*` e demais operações da instância | token individual | nenhum |

O Elyon não cria, altera nem exclui tenants. Por isso a Global API Key não faz
parte do runtime operacional nem do Compose. Nenhuma rota `/instance/*` pode
usar a chave global.

## Comportamento fail-closed

- A ausência de `EVOLUTION_API_URL` interrompe qualquer chamada.
- A ausência de `EVOLUTION_TENANT_API_KEY` ou `EVOLUTION_TENANT_ID` interrompe
  create, listagem, delete e reconciliação antes da rede.
- A ausência do token individual interrompe as operações autenticadas pela
  instância.
- `EVOLUTION_API_KEY` permanece removida por ser ambígua.
- Resposta inválida de `/instance/all` nunca prova ausência.
- `DELETE /instance/delete/{id}` pode retornar `500` para ID inexistente. O
  Elyon consulta `/instance/all` com escopo tenant e só conclui idempotência
  quando o ID exato está ausente. Se a instância ainda existe ou a verificação
  falha, o resultado permanece erro e o registro local é preservado.

## Exemplos sanitizados

```bash
curl -sS \
  -H 'apikey: <TENANT_API_KEY>' \
  -H 'X-Tenant-ID: <EVOLUTION_TENANT_ID>' \
  '<EVOLUTION_URL>/instance/all'

curl -sS -X POST \
  -H 'Content-Type: application/json' \
  -H 'apikey: <TENANT_API_KEY>' \
  -H 'X-Tenant-ID: <EVOLUTION_TENANT_ID>' \
  -d '{"name":"<INSTANCE_NAME>","token":"<INSTANCE_TOKEN>","advancedSettings":{"ignoreGroups":true}}' \
  '<EVOLUTION_URL>/instance/create'

curl -sS -X DELETE \
  -H 'apikey: <TENANT_API_KEY>' \
  -H 'X-Tenant-ID: <EVOLUTION_TENANT_ID>' \
  '<EVOLUTION_URL>/instance/delete/<INSTANCE_ID>'
```

Esses exemplos não devem ser executados em produção durante revisão. Chaves,
tenant ID, instance ID, nome da instância, token, telefone, payload de QR e QR
Code não devem aparecer em logs, issues ou pull requests.

## Gate operacional

Antes de qualquer deploy ou tentativa de conexão, confirmar pelo canal seguro:

- existência do tenant Evolution da Elyon;
- tenant ID canônico;
- tenant API key correspondente;
- commit ou versão do contrato implantado.
