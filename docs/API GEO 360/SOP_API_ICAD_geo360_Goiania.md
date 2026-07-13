# SOP — API do Portal ICAD geo360 (Goiânia)

## 1. Visão geral
O portal consome **dois serviços de backend distintos**, cada um com seu próprio host base, padrão de URL e **mecanismo de autenticação diferente**. Entender essa separação é o ponto central deste SOP.

| Serviço | Host base | Tecnologia | Autenticação |
|---|---|---|---|
| Gateway de dados geográficos | `apis-goiania.geo360.com.br/gateway/rest/` | PostgREST | Headers `x-auth-token` + `x-tn-token` |
| Busca cadastral imobiliária | `apis-goiania.geo360.com.br/cadastro/search/` | API REST própria | `Authorization: Bearer <token>` |

## 2. Credenciais (tokens públicos)
São tokens **públicos e anônimos**, entregues a qualquer visitante. Ficam no `localStorage` do navegador, na chave **`publicTokens`**:

- **`authToken`** → UUID v4 (ex.: `462b2fdd-…`, 36 caracteres). É a credencial de acesso pública da aplicação.
- **`tnToken`** → identificador do tenant em base64. Valor `MTMwOA==` = **"1308"** (código de Goiânia).

Não há login de usuário, senha nem dado pessoal envolvido — coerente com um portal público de transparência.

## 3. Esquemas de autenticação (importante!)
Ponto mais delicado, validado em testes:

- **Serviço Gateway/PostgREST** exige os headers:
  ```
  x-auth-token: <authToken>
  x-tn-token:  <tnToken>
  ```
  Usar `Authorization: Bearer` aqui não é o esperado.

- **Serviço de busca cadastral** (`/cadastro/search/`) exige:
  ```
  Authorization: Bearer <authToken>
  ```
  Enviar **apenas** `x-auth-token`/`x-tn-token` neste serviço retorna **`401 {"detail":"Unauthorized"}`**. Com `Authorization: Bearer` retorna `200`. O `x-tn-token` é opcional aqui, pois o tenant já vem no caminho (`/goiania/`).

No código (interceptor Angular) os marcadores de contexto **`no-token`** / **`has-token`** controlam quando os headers são anexados, e existe ainda um marcador **`consulta-geral`**.

## 4. Endpoints mapeados

### 4.1 Busca de imóveis por inscrição cadastral
```
GET /cadastro/search/goiania/imobiliario?inscricao_cartografica=<código>
Host: apis-goiania.geo360.com.br
Authorization: Bearer <authToken>
```
- **3 dígitos** = todos os imóveis do **setor**
- **7 dígitos** = todos os imóveis da **quadra**
- **10 dígitos** = um **lote** específico

**Resposta:** array JSON. Campos por item: `id_imobiliario`, `id_lote`, `geom`, `inscricao_cartografica`, `numero_cadastro`.

Exemplo real validado: setor **`101`** retornou **11.544** imóveis. Para contar imóveis de Goiânia, soma-se o `count` por setor.

### 4.2 Consulta de bairros (Gateway/PostgREST)
```
GET /gateway/rest/bairro?select=*
Host: apis-goiania.geo360.com.br
x-auth-token: <authToken>
x-tn-token:  <tnToken>
```
Suporta a sintaxe PostgREST: `select=*` (colunas), `id=in.(...)` (filtro IN), `limit=N`, etc. A interface usa `id=in.(...)` com a lista de IDs filtrados pelo mapa.

**Resposta:** array de objetos com muitos campos, entre eles: `id`, `codigo`, `nome`, `nome_formatado`, `codigo_zona`, `area_terreno`, `pop_total`, `pop_masc`, `pop_fem`, `latitude`, `longitude`, `geom`, além de vários atributos cadastrais internos.

### 4.3 Outros endpoints observados
- `GET /plataforma/campos/resumo` — metadados/resumo de campos (chamado junto da busca cadastral).
- Por simetria do PostgREST, é esperado existirem recursos irmãos como `/gateway/rest/logradouro` e outros (mesma sintaxe de `/bairro`).

## 5. Procedimento padrão de consulta (passo a passo)
1. Abrir o portal para que o app popule `publicTokens` no `localStorage`.
2. Ler `authToken` e `tnToken` dessa chave.
3. Escolher o serviço conforme o dado desejado:
   - imóveis por setor/quadra/lote → serviço **cadastro/search** com `Authorization: Bearer`.
   - dados de bairros (e recursos geográficos) → serviço **gateway/rest** com `x-auth-token`/`x-tn-token`.
4. Montar a URL com os parâmetros (`inscricao_cartografica` ou filtros PostgREST).
5. Enviar a requisição com os headers corretos do serviço.
6. Tratar a resposta JSON (array). Para contagens, usar o tamanho do array por consulta.

## 6. Receita: total de imóveis do município
Não existe endpoint de "total geral". O caminho é: para cada setor (3 dígitos) válido, chamar 4.1 e somar a quantidade retornada. É preciso primeiro a relação de setores válidos — varrendo a faixa numérica de setores ou obtendo a lista oficial junto à SEFIN/dados abertos.

## 7. Observações e cuidados
- Tokens públicos podem ser **rotacionados** pela plataforma; sempre releia-os do `localStorage` em vez de fixá-los no código.
- O `tn-token` codifica o município ("1308" = Goiânia); a mesma plataforma geo360 atende outros municípios com outros códigos.

---
