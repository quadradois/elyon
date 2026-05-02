# Contrato de API — Cadastro de Imóveis via Elyon

**Versão:** 1.0  
**Data:** 2026-04-30  
**API:** Quadra Dois CRM  
**Consumidor:** Elyon  

## 1. Objetivo

Este contrato define o payload que o Elyon deve enviar para cadastrar um proprietário e um imóvel no CRM Quadra Dois.

O endpoint cria ou reutiliza um proprietário e cria um imóvel vinculado a ele. O imóvel entra como `pending`, aguardando revisão interna antes de publicação.

## 2. Endpoint

```http
POST https://api.quadradois.com.br/api/leads/from-elyon
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

A API Key determina automaticamente o `tenant_id` de destino no CRM. O Elyon não deve enviar `tenant_id` do CRM no payload.

## 3. Regra de Idempotência

O campo `origem.elyon_lead_id` é o identificador único da importação.

Se o mesmo `elyon_lead_id` for reenviado, o backend não cria novo imóvel. Ele retorna `200` com `already_imported: true` e os IDs já existentes.

## 4. Payload Completo

```json
{
  "proprietario": {
    "nome": "João Silva",
    "cpf": "123.456.789-00",
    "rg": "1234567",
    "telefone": "62999999999",
    "telefone2": "62988888888",
    "email": "joao@email.com",
    "whatsapp": "62999999999",
    "cep": "74000-000",
    "logradouro": "Rua das Flores",
    "numero": "123",
    "complemento": "Apto 42",
    "bairro": "Setor Bueno",
    "cidade": "Goiânia",
    "estado": "GO"
  },
  "imovel": {
    "tipo": "apartamento",
    "tipo_negocio": "venda",
    "logradouro": "Rua das Palmeiras",
    "numero": "456",
    "complemento": "Bloco B",
    "bairro": "Setor Marista",
    "cidade": "Goiânia",
    "estado": "GO",
    "cep": "74180-000",
    "quartos": 3,
    "suites": 1,
    "banheiros": 2,
    "vagas": 2,
    "area_util": 120.0,
    "area_total": 140.0,
    "andar": 5,
    "valor_venda": 650000.0,
    "valor_locacao": null,
    "valor_condominio": 800.0,
    "valor_iptu": 1200.0,
    "caracteristicas": ["Armários embutidos", "Varanda gourmet"],
    "caracteristicas_texto": "Sol da manhã, vista livre",
    "fotos": [
      "https://elyon.example.com/fotos/foto-1.jpg",
      "https://elyon.example.com/fotos/foto-2.jpg"
    ],
    "descricao": "Apartamento amplo com vista privilegiada."
  },
  "origem": {
    "elyon_lead_id": "uuid-do-lead-no-elyon",
    "elyon_tenant_id": "uuid-do-tenant-no-elyon",
    "campanha_id": "uuid-da-campanha"
  }
}
```

## 5. Campos Obrigatórios

| Campo | Tipo | Regra |
|---|---:|---|
| `proprietario` | object | Obrigatório |
| `proprietario.nome` | string | Obrigatório, nome do proprietário |
| `imovel` | object | Obrigatório, pode estar vazio, mas não recomendado |
| `origem` | object | Obrigatório |
| `origem.elyon_lead_id` | string | Obrigatório, único por lead no Elyon |
| `origem.elyon_tenant_id` | string | Obrigatório, tenant/origem no Elyon |

## 6. Campos do Proprietário

| Campo | Tipo | Obrigatório | Destino no CRM |
|---|---:|---:|---|
| `nome` | string | Sim | `proprietarios.nome` |
| `cpf` | string | Não | `proprietarios.cpf` |
| `rg` | string | Não | `proprietarios.rg` |
| `telefone` | string | Não | `proprietarios.telefone` |
| `telefone2` | string | Não | `proprietarios.telefone2` |
| `email` | string | Não | `proprietarios.email` |
| `whatsapp` | string | Não | `proprietarios.whatsapp` |
| `cep` | string | Não | `proprietarios.cep` |
| `logradouro` | string | Não | `proprietarios.logradouro` |
| `numero` | string | Não | `proprietarios.numero` |
| `complemento` | string | Não | `proprietarios.complemento` |
| `bairro` | string | Não | `proprietarios.bairro` |
| `cidade` | string | Não | `proprietarios.cidade` |
| `estado` | string | Não | `proprietarios.estado` |

### Regras do proprietário

- O backend procura primeiro por `proprietarios.elyon_lead_id`.
- Se não encontrar, procura por `cpf` dentro do tenant da API Key.
- Se encontrar por CPF, atualiza o proprietário existente com o `elyon_lead_id`.
- Se não encontrar, cria um novo proprietário com `status='ativo'`.
- `data_captacao` é definida pelo backend no momento da importação.

## 7. Campos do Imóvel

| Campo | Tipo | Obrigatório | Destino no CRM |
|---|---:|---:|---|
| `tipo` | string | Não | Mapeia para `property.property_type` |
| `tipo_negocio` | string | Não | Mapeia para `property.business_type` |
| `descricao` | string | Não | `property.description` |
| `logradouro` | string | Não | `property.address_street` |
| `numero` | string | Não | `property.address_number` |
| `complemento` | string | Não | `property.address_complement` |
| `bairro` | string | Não | `property.address_neighborhood` |
| `cidade` | string | Não | `property.address_city` |
| `estado` | string | Não | `property.address_state` |
| `cep` | string | Não | `property.address_zip` |
| `quartos` | integer | Não | `property.bedrooms` |
| `suites` | integer | Não | `property.suites` |
| `banheiros` | integer | Não | `property.bathrooms` |
| `vagas` | integer | Não | `property.parking_spaces` |
| `area_util` | number | Não | `property.usable_area` |
| `area_total` | number | Não | `property.total_area` |
| `andar` | integer | Não | `property.unit_floor` |
| `valor_venda` | number | Não | `property.price` |
| `valor_locacao` | number | Não | `property.price_rent` |
| `valor_condominio` | number | Não | `property.condo_fee` |
| `valor_iptu` | number | Não | `property.iptu` |
| `caracteristicas` | string[] | Não | `property.amenities` e `property.features` |
| `caracteristicas_texto` | string | Não | `property.custom_features` |
| `fotos` | string[] | Não | `property.image_urls` |

### Campos gerados pelo backend

| Campo | Regra |
|---|---|
| `property.external_id` | Gerado como `ELYON-{tenant_id}-{timestamp}-{uuid_curto}` |
| `property.property_code` | Gerado por tipo: `AP0001`, `CA0001`, `TE0001`, etc. |
| `property.title` | Gerado com tipo, quartos e bairro. Ex.: `Apartamento 3 quartos no Setor Marista` |
| `property.status` | Sempre inicia como `pending` |
| `property.listing_type` | Sempre `USED` |
| `property.usage_types` | Sempre `["RESIDENTIAL"]` |
| `property.unit_types` | Recebe o tipo mapeado do imóvel |

## 8. Valores Aceitos

### `imovel.tipo`

| Valor enviado pelo Elyon | Valor salvo no CRM |
|---|---|
| `apartamento` | `APARTMENT` |
| `casa` | `HOUSE` |
| `comercial` | `COMMERCIAL` |
| `terreno` | `LAND` |
| `fazenda` | `FARM` |
| `sitio` | `FARM` |
| `chacara` | `FARM` |
| `flat` | `FLAT` |
| `studio` | `STUDIO` |
| `kitnet` | `STUDIO` |
| `loft` | `STUDIO` |
| `sala_comercial` | `COMMERCIAL_ROOM` |
| `galpao` | `WAREHOUSE` |
| `loja` | `STORE` |

Se `tipo` vier vazio, nulo ou fora da lista, o backend usa `APARTMENT`.

### `imovel.tipo_negocio`

| Valor enviado pelo Elyon | Valor salvo no CRM |
|---|---|
| `venda` | `SALE` |
| `locacao` | `RENTAL` |
| `aluguel` | `RENTAL` |
| `ambos` | `SALE_RENT` |

Se `tipo_negocio` vier vazio, nulo ou fora da lista, o backend usa `SALE`.

## 9. Origem Elyon

| Campo | Tipo | Obrigatório | Destino no CRM |
|---|---:|---:|---|
| `elyon_lead_id` | string | Sim | `proprietarios.elyon_lead_id` e `property.provider_raw.elyon_lead_id` |
| `elyon_tenant_id` | string | Sim | `proprietarios.elyon_tenant_id` e `property.provider_raw.elyon_tenant_id` |
| `campanha_id` | string | Não | `proprietarios.elyon_campanha_id` e `property.provider_raw.campanha_id` |

O backend grava também:

```json
{
  "source": "elyon",
  "imported_at": "2026-04-30T10:00:00+00:00"
}
```

## 10. Campos Não Processados Atualmente

O backend atual não processa um objeto `contrato` neste endpoint.

Se o Elyon enviar:

```json
{
  "contrato": {
    "tipo": "venda",
    "comissao": "5%",
    "vigencia_inicio": "2026-04-30",
    "vigencia_fim": "2027-04-30"
  }
}
```

esse bloco será ignorado pela importação atual. Para cadastro automático de contrato/autorização, será necessário evoluir o backend.

Campos extras dentro de `proprietario`, `imovel` ou `origem` também são ignorados, salvo os listados neste contrato.

## 11. Respostas

### Sucesso — importação criada

```http
HTTP/1.1 201 Created
```

```json
{
  "success": true,
  "proprietario_id": 42,
  "proprietario_created": true,
  "property_id": 87,
  "property_code": "AP0001",
  "status": "pending",
  "message": "Imóvel importado com sucesso. Aguardando revisão para publicação."
}
```

### Sucesso — lead já importado

```http
HTTP/1.1 200 OK
```

```json
{
  "success": true,
  "already_imported": true,
  "proprietario_id": 42,
  "property_id": 87,
  "property_code": "AP0001",
  "message": "Imóvel já foi importado anteriormente"
}
```

### Erro de validação

```http
HTTP/1.1 400 Bad Request
```

```json
{
  "success": false,
  "error": "Campo proprietario.nome é obrigatório"
}
```

## 12. Erros Esperados

| HTTP | Quando ocorre | Ação recomendada |
|---:|---|---|
| 400 | JSON vazio ou campos obrigatórios ausentes | Corrigir payload |
| 401 | API Key ausente, inválida, desativada ou expirada | Revisar chave |
| 403 | API Key sem permissão `leads:write` | Gerar chave com permissão correta |
| 404 | Tenant da API Key não encontrado | Acionar Quadra Dois |
| 500 | Erro interno durante importação | Retry com backoff; se persistir, acionar Quadra Dois |

## 13. Recomendação de Retry

- Timeout por requisição: 30 segundos.
- Retry apenas para timeout ou erro `5xx`.
- Não fazer retry automático para `4xx`.
- Backoff recomendado: 5s, 15s, 30s.
- Reenviar o mesmo `elyon_lead_id` é seguro.

## 14. Checklist Para Homologação

- [ ] `proprietario.nome` enviado.
- [ ] `origem.elyon_lead_id` enviado e único.
- [ ] `origem.elyon_tenant_id` enviado.
- [ ] `imovel.tipo` usa um valor da lista aceita.
- [ ] `imovel.tipo_negocio` usa um valor da lista aceita.
- [ ] `fotos` contém URLs públicas acessíveis pelo CRM.
- [ ] Primeiro envio retorna `201`.
- [ ] Segundo envio com mesmo `elyon_lead_id` retorna `200` e `already_imported: true`.
- [ ] Imóvel aparece em `/properties/pending` no CRM.
- [ ] Detalhe do proprietário mostra a origem Elyon.
