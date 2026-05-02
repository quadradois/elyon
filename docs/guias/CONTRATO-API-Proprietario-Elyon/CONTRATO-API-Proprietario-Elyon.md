# Contrato de API — Cadastro Completo de Proprietário (Elyon → Quadra Dois)

**Versão:** 1.0  
**Data:** 2026-04-30  
**API:** Quadra Dois CRM  
**Consumidor:** Elyon  
**Escopo:** Padronização completa dos campos de **Proprietário** existentes no Elyon.

---

## 1. Objetivo

Este contrato define a estrutura para que o Quadra Dois receba, de forma padronizada, todos os dados do proprietário coletados no Elyon, preservando:

- dados cadastrais;
- dados de contato;
- dados de qualificação (SPIN e contexto comercial);
- dados de negociação/autorizações;
- metadados de rastreabilidade da origem Elyon.

> Observação: este contrato é complementar ao contrato de imóvel. Aqui o foco é **proprietário**.

---

## 2. Endpoint

```http
POST https://api.quadradois.com.br/api/leads/from-elyon
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

A API Key resolve o tenant no Quadra Dois. Não enviar tenant do Quadra Dois no payload.

---

## 3. Regra de Idempotência

- Chave única da origem: `origem.elyon_lead_id`
- Reenvio com mesmo `elyon_lead_id` não deve duplicar cadastro do proprietário.

---

## 4. Payload Proposto (Proprietário Completo)

```json
{
  "proprietario": {
    "nome": "João Silva",
    "cpf": "123.456.789-00",
    "rg": "1234567",
    "email": "joao@email.com",
    "email2": "joao.comercial@email.com",
    "telefone": "62999999999",
    "telefone2": "62988888888",
    "telefone3": "62977777777",
    "whatsapp": "62999999999",
    "telefone_verificado": true,

    "data_nascimento": "1988-09-15",
    "idade": 37,
    "sexo": "Feminino",

    "endereco_principal": {
      "logradouro": "Rua T-30",
      "numero": "1200",
      "complemento": "Apto 301",
      "bairro": "Setor Bueno",
      "cidade": "Goiânia",
      "estado": "GO",
      "cep": "74215-110",
      "texto_livre": "Rua T-30, 1200, Apto 301, Setor Bueno, Goiânia - GO"
    },

    "origem_elyon": {
      "lead_id": "uuid-lead",
      "tenant_id": "uuid-tenant",
      "campanha_id": "uuid-campanha",
      "status_lead": "DOCUMENTACAO",
      "temperatura": "QUENTE",
      "estagio": "negociacao_avancada",
      "origem": "teste_integracao_crm"
    },

    "qualificacao": {
      "situacao_atual": "Imóvel anunciado sem sucesso",
      "tempo_decisao": "Decidiu vender há 4 meses",
      "tentativas_anteriores": "Portal e rede social",
      "com_corretor_atualmente": false,
      "motivacao_venda": "Mudança de cidade",
      "dores_identificadas": ["Baixo volume de visitas", "Propostas baixas"],
      "prazo_desejado": "90 dias",
      "urgencia": "ALTA",
      "consequencias": "Custos fixos altos",
      "custos_atuais": "Condomínio + IPTU",
      "pressao_tempo": true,
      "expectativa_servico": "Compradores qualificados",
      "objecoes": ["Comissão", "Exclusividade"],
      "interesse_avaliacao": true,
      "observacoes_spin": "Aberta à exclusividade com revisão de performance"
    },

    "perfil_pessoal_profissional": {
      "renda_estimada": "R$ 18.000",
      "faixa_salarial": "Acima de 10 salários mínimos",
      "empresa_atual": "Q2 Participações Imobiliárias",
      "cnpj_empresa": "12.345.678/0001-99",
      "profissao": "Empresária",
      "setor": "Mercado Imobiliário",
      "score_assertiva": 91
    },

    "negociacao": {
      "situacao_financeira": "quitado",
      "tem_dividas": false,
      "estado_conservacao": "excelente",
      "tipo_autorizacao": "simples",
      "comissao_acordada": "5%",
      "prazo_trabalho_dias": 90,
      "autorizou_anuncio": true
    },

    "vigencia": {
      "data_assinatura": "2026-04-30T12:00:00Z",
      "vigencia_inicio": "2026-04-30",
      "vigencia_fim": "2026-07-30",
      "contrato_url": "https://..."
    },

    "trilha_ia": {
      "ultima_acao_ia": "Resumo de proposta enviado",
      "ultima_acao_ia_em": "2026-04-30T12:30:00Z",
      "briefing_closer": "...",
      "schema_state": {}
    }
  },
  "imovel": {},
  "origem": {
    "elyon_lead_id": "uuid-lead",
    "elyon_tenant_id": "uuid-tenant",
    "campanha_id": "uuid-campanha"
  }
}
```

---

## 5. Campos Obrigatórios

| Campo | Tipo | Obrigatório | Observação |
|---|---|---:|---|
| `proprietario` | object | Sim | Objeto principal |
| `proprietario.nome` | string | Sim | Nome do proprietário |
| `origem` | object | Sim | Rastreabilidade |
| `origem.elyon_lead_id` | string | Sim | Idempotência |
| `origem.elyon_tenant_id` | string | Sim | Origem Elyon |

Todos os demais campos são opcionais, porém recomendados para padronização completa.

---

## 6. Mapeamento de Campos do Elyon (Proprietário)

## 6.1 Identificação e Contato

| Elyon (`Lead`) | Payload proposto | Tipo |
|---|---|---|
| `nome` | `proprietario.nome` | string |
| `cpf` | `proprietario.cpf` | string |
| `email` | `proprietario.email` | string |
| `email2` | `proprietario.email2` | string |
| `telefone` | `proprietario.telefone` | string |
| `telefone2` | `proprietario.telefone2` | string |
| `telefone3` | `proprietario.telefone3` | string |
| `telefone` | `proprietario.whatsapp` | string |
| `telefoneVerificado` | `proprietario.telefone_verificado` | boolean |
| `dataNascimento` | `proprietario.data_nascimento` | date |
| `idade` | `proprietario.idade` | integer |
| `sexo` | `proprietario.sexo` | string |

## 6.2 Endereço do Proprietário

| Elyon (`Lead`) | Payload proposto | Tipo |
|---|---|---|
| `enderecoPrincipal` | `proprietario.endereco_principal.texto_livre` | string |
| (parse) | `proprietario.endereco_principal.logradouro` | string |
| (parse) | `proprietario.endereco_principal.numero` | string |
| (parse) | `proprietario.endereco_principal.complemento` | string |
| (parse) | `proprietario.endereco_principal.bairro` | string |
| (parse) | `proprietario.endereco_principal.cidade` | string |
| (parse) | `proprietario.endereco_principal.estado` | string |
| (parse) | `proprietario.endereco_principal.cep` | string |

## 6.3 Contexto de Origem Elyon

| Elyon (`Lead`) | Payload proposto | Tipo |
|---|---|---|
| `id` | `proprietario.origem_elyon.lead_id` | uuid |
| `tenantId` | `proprietario.origem_elyon.tenant_id` | uuid |
| `campanhaOrigemId` | `proprietario.origem_elyon.campanha_id` | uuid |
| `status` | `proprietario.origem_elyon.status_lead` | enum |
| `temperatura` | `proprietario.origem_elyon.temperatura` | enum |
| `estagio` | `proprietario.origem_elyon.estagio` | string |
| `origem` | `proprietario.origem_elyon.origem` | string |

## 6.4 Qualificação (SPIN)

| Elyon (`Lead`) | Payload proposto | Tipo |
|---|---|---|
| `situacaoAtual` | `proprietario.qualificacao.situacao_atual` | string |
| `tempoDecisao` | `proprietario.qualificacao.tempo_decisao` | string |
| `tentativasAnteriores` | `proprietario.qualificacao.tentativas_anteriores` | string |
| `comCorretorAtualmente` | `proprietario.qualificacao.com_corretor_atualmente` | boolean |
| `motivacaoVenda` | `proprietario.qualificacao.motivacao_venda` | string |
| `doresIdentificadas` | `proprietario.qualificacao.dores_identificadas` | string[] |
| `prazoDesejado` | `proprietario.qualificacao.prazo_desejado` | string |
| `urgencia` | `proprietario.qualificacao.urgencia` | enum |
| `consequencias` | `proprietario.qualificacao.consequencias` | string |
| `custosAtuais` | `proprietario.qualificacao.custos_atuais` | string |
| `pressaoTempo` | `proprietario.qualificacao.pressao_tempo` | boolean |
| `expectativaServico` | `proprietario.qualificacao.expectativa_servico` | string |
| `objecoes` | `proprietario.qualificacao.objecoes` | string[] |
| `interesseAvaliacao` | `proprietario.qualificacao.interesse_avaliacao` | boolean |
| `observacoesSpin` | `proprietario.qualificacao.observacoes_spin` | string |

## 6.5 Perfil Pessoal/Profissional

| Elyon (`Lead`) | Payload proposto | Tipo |
|---|---|---|
| `rendaEstimada` | `proprietario.perfil_pessoal_profissional.renda_estimada` | string |
| `faixaSalarial` | `proprietario.perfil_pessoal_profissional.faixa_salarial` | string |
| `empresaAtual` | `proprietario.perfil_pessoal_profissional.empresa_atual` | string |
| `cnpjEmpresa` | `proprietario.perfil_pessoal_profissional.cnpj_empresa` | string |
| `profissao` | `proprietario.perfil_pessoal_profissional.profissao` | string |
| `setor` | `proprietario.perfil_pessoal_profissional.setor` | string |
| `scoreAssertiva` | `proprietario.perfil_pessoal_profissional.score_assertiva` | integer |

## 6.6 Negociação

| Elyon (`Lead`) | Payload proposto | Tipo |
|---|---|---|
| `situacaoFinanceira` | `proprietario.negociacao.situacao_financeira` | string |
| `temDividas` | `proprietario.negociacao.tem_dividas` | boolean |
| `estadoConservacao` | `proprietario.negociacao.estado_conservacao` | string |
| `tipoAutorizacao` | `proprietario.negociacao.tipo_autorizacao` | string |
| `comissaoAcordada` | `proprietario.negociacao.comissao_acordada` | string |
| `prazoTrabalho` | `proprietario.negociacao.prazo_trabalho_dias` | integer |
| `autorizouAnuncio` | `proprietario.negociacao.autorizou_anuncio` | boolean |

## 6.7 Vigência / Contrato

| Elyon (`Lead`) | Payload proposto | Tipo |
|---|---|---|
| `dataAssinatura` | `proprietario.vigencia.data_assinatura` | datetime |
| `vigenciaInicio` | `proprietario.vigencia.vigencia_inicio` | date |
| `vigenciaFim` | `proprietario.vigencia.vigencia_fim` | date |
| `contratoUrl` | `proprietario.vigencia.contrato_url` | string |

## 6.8 Trilha de IA

| Elyon (`Lead`) | Payload proposto | Tipo |
|---|---|---|
| `ultimaAcaoIA` | `proprietario.trilha_ia.ultima_acao_ia` | string |
| `ultimaAcaoIAEm` | `proprietario.trilha_ia.ultima_acao_ia_em` | datetime |
| `briefingCloser` | `proprietario.trilha_ia.briefing_closer` | string |
| `schemaState` | `proprietario.trilha_ia.schema_state` | object/json |

---

## 7. Regras de Normalização

- Telefones: enviar apenas dígitos, com DDD.
- CPF/CNPJ: manter formatação ou enviar só dígitos, mas consistente.
- Datas: ISO-8601 (`YYYY-MM-DD` para data, `YYYY-MM-DDTHH:mm:ssZ` para datetime).
- Campos vazios: enviar `null` (não enviar string vazia).
- Arrays: sempre array JSON válido (`[]` quando vazio).

---

## 8. Campos de Enum (referência)

### 8.1 `status_lead`
`NOVO`, `TENTATIVA_AGENDAMENTO`, `VISITA_AGENDADA`, `AVALIACAO_EM_ANDAMENTO`, `DOCUMENTACAO`, `ONBOARDING`, `CAPTADO`, `PERDIDO`, `ARQUIVADO`

### 8.2 `temperatura`
`FRIO`, `MORNO`, `QUENTE`

### 8.3 `urgencia`
`BAIXA`, `MEDIA`, `ALTA`

---

## 9. Compatibilidade com Contrato de Imóvel

- Este contrato não substitui o contrato de imóvel.
- Recomenda-se envio conjunto (`proprietario` + `imovel` + `origem`) no mesmo endpoint.
- Campos não reconhecidos podem ser ignorados pelo Quadra Dois até implementação completa de persistência.

---

## 10. Checklist de Homologação (Proprietário)

- [ ] `proprietario.nome` sempre enviado.
- [ ] `origem.elyon_lead_id` enviado e único.
- [ ] Contatos (`telefone`, `email`) enviados quando disponíveis.
- [ ] Blocos `qualificacao`, `perfil_pessoal_profissional` e `negociacao` enviados sem perda de tipos.
- [ ] Datas (`vigencia`) em formato ISO correto.
- [ ] Reenvio com mesmo `elyon_lead_id` mantém idempotência.
- [ ] Quadra Dois confirma persistência dos campos acordados.

---

## 11. Próxima Etapa Recomendada

Publicar uma versão `v1.1` com:
- matriz de persistência real do lado Quadra Dois (campo recebido vs. campo gravado);
- regras de fallback por campo ausente;
- contrato de erro por campo inválido.
