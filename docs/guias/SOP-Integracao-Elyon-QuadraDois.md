# SOP — Integração Elyon ↔ Quadra Dois
**Versão:** 1.0  
**Data:** 2026-04-30  
**Elaborado por:** Quadra Dois  
**Destinatário:** Equipe Técnica Elyon  

---

## 1. Visão Geral

Este documento descreve o procedimento para configurar a integração entre o sistema **Elyon** e o **CRM Quadra Dois**. O objetivo é permitir que o Elyon envie leads captados (proprietário + imóvel) diretamente para o CRM via API REST autenticada.

**Fluxo resumido:**

```
Elyon (VPS A)  ──HTTPS──►  api.quadradois.com.br (VPS B)
                              POST /api/leads/from-elyon
                              Authorization: Bearer <API_KEY>
```

O envio ocorre **durante o atendimento humano** (acionado pelo corretor), não de forma automática no primeiro contato da IA.

---

## 2. Pré-requisitos

| Item | Responsável | Status |
|------|-------------|--------|
| Rede liberada: VPS Elyon → `api.quadradois.com.br:443` | Infra Elyon | Pendente |
| API Key gerada no Quadra Dois | Quadra Dois | **Feito** (ver seção 3) |
| `tenantIdDestino` confirmado | Quadra Dois | **Automático via API Key** |
| Certificado HTTPS válido em `api.quadradois.com.br` | Quadra Dois | Ativo |

> **Nota:** O `tenantId` do Quadra Dois não precisa ser enviado no payload — ele é resolvido automaticamente a partir da API Key. Cada chave pertence a um tenant específico.

---

## 3. Credenciais e Endpoints

### 3.1 URL Base da API

```
https://api.quadradois.com.br
```

### 3.2 Obter a API Key

1. Acesse `https://crm.quadradois.com.br/settings/api-keys`
2. Clique em **"Nova Chave"**
3. Nome sugerido: `Elyon Produção`
4. Validade: `365 dias` (ou "Nunca expira")
5. **Copie a chave imediatamente** — ela só é exibida uma vez

A chave tem o formato:
```
gnd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3.3 Autenticação

Todas as requisições devem incluir o header:
```
Authorization: Bearer gnd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3.4 Permissões da chave

| Permissão | Uso |
|-----------|-----|
| `leads:write` | Enviar leads (POST) |
| `properties:read` | Consultar status (GET) |

---

## 4. Endpoints Disponíveis

### 4.1 Teste de Conectividade

Valida se a chave está correta e a conexão funciona. **Não persiste dados.**

```
GET /api/leads/from-elyon/test
Authorization: Bearer <API_KEY>
```

**Resposta de sucesso (200):**
```json
{
  "success": true,
  "message": "Integração Elyon ↔ Quadra Dois operacional",
  "tenant_id": "123",
  "tenant_name": "Imobiliária Exemplo",
  "permissions": ["leads:write", "properties:read"],
  "endpoint": "POST /api/leads/from-elyon"
}
```

---

### 4.2 Enviar Lead Captado

```
POST /api/leads/from-elyon
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

**Payload completo:**
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
    "valor_venda": 650000.00,
    "valor_locacao": null,
    "valor_condominio": 800.00,
    "valor_iptu": 1200.00,
    "caracteristicas": ["Armários embutidos", "Varanda gourmet", "Academia"],
    "fotos": ["https://url-da-foto1.jpg", "https://url-da-foto2.jpg"],
    "descricao": "Apartamento amplo com vista privilegiada."
  },
  "contrato": {
    "tipo": "venda",
    "comissao": "5%",
    "vigencia_inicio": "2026-04-30",
    "vigencia_fim": "2027-04-30"
  },
  "origem": {
    "elyon_lead_id": "uuid-do-lead-no-elyon",
    "elyon_tenant_id": "uuid-do-tenant-no-elyon",
    "campanha_id": "uuid-da-campanha"
  }
}
```

**Campos obrigatórios:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `proprietario.nome` | string | Nome completo do proprietário |
| `origem.elyon_lead_id` | string (UUID) | ID único do lead no Elyon |
| `origem.elyon_tenant_id` | string (UUID) | ID do tenant no Elyon |

Todos os demais campos são opcionais mas recomendados.

**Valores aceitos para `imovel.tipo`:**

| Valor | Tipo no CRM |
|-------|-------------|
| `apartamento` | Apartamento |
| `casa` | Casa |
| `comercial` | Comercial |
| `terreno` | Terreno |
| `fazenda` / `sitio` / `chacara` | Fazenda/Sítio |
| `flat` | Flat |
| `studio` / `kitnet` / `loft` | Studio |
| `sala_comercial` | Sala Comercial |
| `galpao` | Galpão |
| `loja` | Loja |

**Valores aceitos para `imovel.tipo_negocio`:**

| Valor | Significado |
|-------|-------------|
| `venda` | Apenas venda |
| `locacao` ou `aluguel` | Apenas locação |
| `ambos` | Venda e locação |

---

**Resposta de sucesso (201):**
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

**Resposta para lead já importado (200):**
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

> A API é **idempotente**: reenviar o mesmo `elyon_lead_id` não cria duplicatas.

---

### 4.3 Consultar Status de Importação

```
GET /api/leads/from-elyon/{elyon_lead_id}
Authorization: Bearer <API_KEY>
```

**Resposta (200):**
```json
{
  "found": true,
  "proprietario": { ... },
  "properties": [
    {
      "id": 87,
      "property_code": "AP0001",
      "title": "Apartamento 3 quartos no Setor Marista",
      "status": "pending",
      "remote_id": null,
      "created_at": "2026-04-30T10:00:00"
    }
  ],
  "total_properties": 1
}
```

**Status possíveis do imóvel:**

| Status | Significado |
|--------|-------------|
| `pending` | Importado, aguardando revisão interna |
| `active` | Aprovado e publicado |
| `inactive` | Desativado |

---

## 5. Tratamento de Erros

| HTTP | Erro | Causa | Ação |
|------|------|-------|------|
| 400 | `Campos obrigatórios faltando` | Payload incompleto | Verificar `proprietario.nome`, `origem.elyon_lead_id`, `origem.elyon_tenant_id` |
| 401 | `API Key não fornecida` | Header `Authorization` ausente | Adicionar header |
| 401 | `API Key inválida` | Chave incorreta ou não existe | Verificar chave ou gerar nova |
| 401 | `API Key expirada` | Chave vencida | Regenerar em `/settings/api-keys` |
| 403 | `Permissão negada: leads:write` | Chave sem permissão | Criar nova chave com permissão correta |
| 404 | `Tenant X não encontrado` | Problema interno | Contatar Quadra Dois |
| 500 | `Erro interno` | Falha no servidor | Retry com backoff; contatar Quadra Dois se persistir |

---

## 6. Política de Timeout e Retry

| Parâmetro | Valor recomendado |
|-----------|-------------------|
| Timeout por requisição | **30 segundos** |
| Retries em caso de erro 5xx ou timeout | **3 tentativas** |
| Backoff entre retries | **5s → 15s → 30s** (exponencial) |
| Retry em erro 4xx | **Não** (erro de configuração, não de rede) |

---

## 7. Configuração no Elyon

No painel do Elyon, em **Configurações → Integrações**, preencher:

| Campo | Valor |
|-------|-------|
| URL da API | `https://api.quadradois.com.br` |
| API Key | `gnd_xxxx...` (gerada no passo 3.2) |
| Endpoint de leads | `/api/leads/from-elyon` |
| Endpoint de teste | `/api/leads/from-elyon/test` |
| Timeout | `30000` ms |
| Retries | `3` |

---

## 8. Checklist de Aceite

Execute os passos abaixo para validar a integração:

- [ ] **1. Teste de conectividade:** `GET /api/leads/from-elyon/test` retorna `200 OK` com `"success": true`
- [ ] **2. Envio de lead de teste:** `POST /api/leads/from-elyon` com dados fictícios retorna `201` com `property_code`
- [ ] **3. Idempotência:** reenviar o mesmo `elyon_lead_id` retorna `200` com `"already_imported": true`
- [ ] **4. Consulta de status:** `GET /api/leads/from-elyon/{elyon_lead_id}` retorna `"found": true`
- [ ] **5. Lead em produção:** envio de lead real pelo corretor aparece no CRM com `status: pending`

---

## 9. Contato e Suporte

| Assunto | Contato |
|---------|---------|
| Dúvidas técnicas API | Equipe Quadra Dois |
| Geração/renovação de API Key | `https://crm.quadradois.com.br/settings/api-keys` |
| Erros em produção | Verificar logs do Elyon + consultar `GET /api/leads/from-elyon/{id}` |

---

## 10. Anexo — Solicitação de Exportação da Base Imobiliária de Goiânia

Precisamos receber uma exportação da base local usada no Elyon para consulta de imóveis da Prefeitura de Goiânia.

O objetivo é importar essa base no banco do Rancho Delivery para viabilizar o módulo de mineração de contatos.

### 10.1 Formato Preferencial

- CSV ou JSON
- Encoding: UTF-8
- Separador CSV: `;` ou `,`, desde que informado
- Pode ser arquivo completo ou particionado em lotes

### 10.2 Campos Obrigatórios

| Campo | Descrição |
| --- | --- |
| `nrinscr` | Inscrição/IPTU do imóvel |
| `nmbairro` | Nome do bairro |
| `nmlogradou` | Nome do logradouro/rua |
| `nrimovel` | Número do imóvel |
| `incompl` | Complemento, apartamento, bloco, sala etc. |
| `nrquadra` | Quadra |
| `nrlote` | Lote |

### 10.3 Campos Recomendados

| Campo | Descrição |
| --- | --- |
| `OBJECTID` ou `object_id` | Identificador original da API/mapa |
| `cdbairro` | Código do bairro |
| `cdlogradou` | Código do logradouro |
| `tplogradou` | Tipo do logradouro |
| `cdedificio` | Código do edifício, se houver |
| `nmedificio` | Nome do edifício/condomínio, se houver |
| `instatus` | Status cadastral, se houver |
| `inposfisc` | Posição fiscal, se houver |
| `raw` | Registro original completo, se disponível |

### 10.4 Exemplo CSV

```csv
OBJECTID;nrinscr;nmbairro;nmlogradou;nrimovel;incompl;nrquadra;nrlote;cdbairro;cdlogradou;tplogradou;cdedificio;nmedificio
123;00123456789012;JARDIM BURITI;AVENIDA EXEMPLO;100;APT 101;Q1;L2;55;999;AV;321;RESIDENCIAL OPUS
```
