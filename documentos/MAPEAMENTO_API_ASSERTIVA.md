# 📋 MAPEAMENTO API ASSERTIVA vs CAMPOS NECESSÁRIOS

## 🎯 Campos Solicitados vs Implementação Atual

| Campo Solicitado | API Assertiva (Path) | Implementado | Status |
|------------------|---------------------|--------------|--------|
| **CPF** | `resposta.dadosCadastrais.cpf` | ✅ `cpf` | ✅ OK |
| **Nome** | `resposta.dadosCadastrais.nome` | ✅ `nome` | ✅ OK |
| **Sexo** | `resposta.dadosCadastrais.sexo` | ✅ `sexo` | ✅ OK |
| **DataNascimento** | `resposta.dadosCadastrais.dataNascimento` | ✅ `dataNascimento` | ✅ OK |
| **Idade** | `resposta.dadosCadastrais.idade` | ✅ `idade` | ✅ OK |
| **Escolaridade** | `resposta.dadosCadastrais.escolaridade` | ❌ Não mapeado | ⚠️ ADICIONAR |
| **RendaEstimada** | `resposta.possivelHistoricoProfissional[0].rendaEstimada` | ✅ `rendaEstimada` | ✅ OK |
| **FaixaRenda** | `resposta.possivelHistoricoProfissional[0].faixaSalarial` | ✅ `faixaSalarial` | ✅ OK |
| **ProbabilidadeObito** | `resposta.dadosCadastrais.obitoProvavel` | ✅ `obitoProvavel` | ✅ OK |
| **NomeMae** | `resposta.dadosCadastrais.maeNome` | ✅ `nomeMae` | ✅ OK |
| **CPFMae** | `resposta.dadosCadastrais.maeCpf` | ❌ Não mapeado | ⚠️ ADICIONAR |
| **TipoLogradouro1** | `resposta.enderecos[0].tipoLogradouro` | ❌ Não mapeado | ⚠️ ADICIONAR |
| **Logradouro1** | `resposta.enderecos[0].logradouro` | ✅ `endereco.logradouro` | ✅ OK |
| **Numero1** | `resposta.enderecos[0].numero` | ✅ `endereco.numero` | ✅ OK |
| **Complemento1** | `resposta.enderecos[0].complemento` | ✅ `endereco.complemento` | ✅ OK |
| **Bairro1** | `resposta.enderecos[0].bairro` | ✅ `endereco.bairro` | ✅ OK |
| **Cidade1** | `resposta.enderecos[0].cidade/municipio` | ✅ `endereco.cidade` | ✅ OK |
| **UF1** | `resposta.enderecos[0].uf` | ✅ `endereco.uf` | ✅ OK |
| **CEP1** | `resposta.enderecos[0].cep` | ✅ `endereco.cep` | ✅ OK |
| **Email1** | `resposta.emails[0].email` | ✅ `emails[0]` | ✅ OK |
| **Email2** | `resposta.emails[1].email` | ✅ `emails[1]` | ✅ OK |
| **Telefone1** | `resposta.telefones.fixos[0].numero` | ✅ `telefones[tipo=FIXO][0]` | ✅ OK |
| **Telefone2** | `resposta.telefones.fixos[1].numero` | ✅ `telefones[tipo=FIXO][1]` | ✅ OK |
| **Celular1** | `resposta.telefones.moveis[0].numero` | ✅ `telefones[tipo=CELULAR][0]` | ✅ OK |
| **Celular2** | `resposta.telefones.moveis[1].numero` | ✅ `telefones[tipo=CELULAR][1]` | ✅ OK |

---

## 📊 Resumo

| Status | Quantidade |
|--------|------------|
| ✅ Implementado | 21 |
| ⚠️ Falta Adicionar | 3 |

### Campos a Adicionar:
1. **Escolaridade** - `cadastro.escolaridade`
2. **CPFMae** - `cadastro.maeCpf`
3. **TipoLogradouro1** - `enderecoP.tipoLogradouro`

---

## 🔧 Estrutura Completa da Resposta API Assertiva

```json
{
  "resposta": {
    "dadosCadastrais": {
      "cpf": "12345678900",
      "nome": "NOME COMPLETO",
      "sexo": "Masculino",
      "dataNascimento": "01/01/1990",
      "idade": 35,
      "escolaridade": "Superior Completo",    // ⚠️ NÃO MAPEADO
      "situacaoCadastral": "REGULAR",
      "obitoProvavel": false,
      "maeNome": "NOME DA MAE",
      "maeCpf": "98765432100",                // ⚠️ NÃO MAPEADO
      "signo": "Capricórnio",
      "ppe": false
    },
    
    "telefones": {
      "moveis": [
        {
          "numero": "62999999999",
          "ddd": "62",
          "aplicativos": {
            "whatsApp": true,
            "telegram": false
          }
        }
      ],
      "fixos": [
        {
          "numero": "6232222222",
          "ddd": "62",
          "aplicativos": {
            "whatsAppBusiness": false
          }
        }
      ]
    },
    
    "emails": [
      { "email": "email1@gmail.com" },
      { "email": "email2@hotmail.com" }
    ],
    
    "enderecos": [
      {
        "tipoLogradouro": "Rua",             // ⚠️ NÃO MAPEADO
        "logradouro": "Nome da Rua",
        "numero": "123",
        "complemento": "Apto 101",
        "bairro": "Centro",
        "cidade": "Goiânia",
        "municipio": "Goiânia",
        "uf": "GO",
        "cep": "74000000"
      }
    ],
    
    "possivelHistoricoProfissional": [
      {
        "rendaEstimada": "5000.00",
        "faixaSalarial": "De 3 a 5 Salários Mínimos",
        "cboDescricao": "Analista de Sistemas",
        "setor": "Tecnologia",
        "razaoSocial": "EMPRESA XYZ LTDA",
        "cnpj": "12345678000100"
      }
    ],
    
    "participacoesEmpresas": [
      {
        "cnpj": "12345678000100",
        "razaoSocial": "EMPRESA DO CLIENTE",
        "participacao": "50%",
        "qualificacao": "Sócio Administrador"
      }
    ],
    
    "redesSociais": [
      {
        "rede": "LinkedIn",
        "url": "https://linkedin.com/in/usuario"
      }
    ]
  }
}
```

---

## 🛠️ Alterações Necessárias no assertiva.ts

Para adicionar os campos faltantes, modifique o arquivo `src/servicos/assertiva.ts`:

### 1. Adicionar na Interface `DadosEnriquecidos`:
```typescript
escolaridade?: string;
cpfMae?: string;
tipoLogradouro?: string;
```

### 2. Adicionar no mapeamento (função `enriquecerCPF`):
```typescript
// Dados Cadastrais
escolaridade: cadastro.escolaridade,
cpfMae: cadastro.maeCpf,

// Endereço
tipoLogradouro: enderecoP?.tipoLogradouro,
```

---

## ✅ Conclusão

**21 de 24 campos** já estão implementados e funcionando.

Apenas **3 campos** precisam ser adicionados:
- `escolaridade`
- `cpfMae` 
- `tipoLogradouro`
