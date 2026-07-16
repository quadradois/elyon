# Matriz de autenticação — Evolution Go

Esta matriz descreve o contrato confirmado para a Evolution Go dedicada. Os
quatro tipos de credencial são independentes e não podem ser reutilizados entre
papéis.

| Operação | `apikey` | Contexto adicional | Uso no Elyon |
| --- | --- | --- | --- |
| `GET /instance/all` | `EVOLUTION_GLOBAL_API_KEY` | nenhum | consulta administrativa e reconciliação |
| `POST /instance/create` | `EVOLUTION_TENANT_API_KEY` | `X-Tenant-ID: EVOLUTION_TENANT_ID` | criação de instância do tenant |
| `DELETE /instance/delete/{id}` | `EVOLUTION_GLOBAL_API_KEY` | nenhum | exclusão explícita e reconciliação revisada |
| `POST /instance/connect` | token individual da instância | nenhum | conexão e configuração do webhook |
| `GET /instance/qr` | token individual da instância | nenhum | obtenção do QR, nunca registrado |
| `GET /instance/status` | token individual da instância | nenhum | estado remoto |
| `DELETE /instance/logout` | token individual da instância | nenhum | logout da instância |

## Comportamento fail-closed

- A ausência de `EVOLUTION_API_URL` interrompe qualquer chamada.
- A ausência de `EVOLUTION_GLOBAL_API_KEY` interrompe listagem, exclusão e
  reconciliação antes de acessar a rede.
- A ausência de `EVOLUTION_TENANT_API_KEY` ou `EVOLUTION_TENANT_ID` interrompe
  `/instance/create` antes de acessar a rede.
- A ausência do token individual interrompe operações da instância.
- `EVOLUTION_API_KEY` foi removida do contrato para impedir interpretação
  ambígua como chave global ou de tenant.

## Exemplos sanitizados

```bash
curl -sS \
  -H 'apikey: <GLOBAL_API_KEY>' \
  '<EVOLUTION_URL>/instance/all'

curl -sS -X POST \
  -H 'Content-Type: application/json' \
  -H 'apikey: <TENANT_API_KEY>' \
  -H 'X-Tenant-ID: <EVOLUTION_TENANT_ID>' \
  -d '{"name":"<INSTANCE_NAME>","token":"<INSTANCE_TOKEN>","advancedSettings":{"ignoreGroups":true}}' \
  '<EVOLUTION_URL>/instance/create'

curl -sS -X DELETE \
  -H 'apikey: <GLOBAL_API_KEY>' \
  '<EVOLUTION_URL>/instance/delete/<INSTANCE_ID>'
```

Nenhum exemplo deve ser executado em produção durante a revisão desta mudança.
Chaves, tenant ID, instance ID, nome da instância, token, telefone, payload de QR
e QR Code não devem aparecer em logs, issues ou pull requests.

## Evidência do incidente

Na tentativa controlada de 2026-07-16, o Elyon usou a chave global em
`POST /instance/create`. A Evolution Go rejeitou a operação com HTTP `400`; o
Elyon respondeu `502`, estágio `instance/create`, rota `/instance/create` e
`EVOLUTION_UPSTREAM_FAILURE`. A chamada não alcançou connect nem QR, a sessão
voltou para `DESCONECTADO` e nenhuma instância remota foi criada.
