# 📋 MAPEAMENTO API ASSERTIVA vs CAMPOS NECESSÁRIOS

> **✅ ATUALIZADO EM 23/12/2024 - TODAS AS IMPLEMENTAÇÕES COMPLETAS**

## 🎯 Campos Solicitados vs Implementação Atual

| Campo Solicitado | API Assertiva (Path) | Implementado | Status |
|------------------|---------------------|--------------|--------|
| **CPF** | `resposta.dadosCadastrais.cpf` | ✅ `cpf` | ✅ OK |
| **Nome** | `resposta.dadosCadastrais.nome` | ✅ `nome` | ✅ OK |
| **Sexo** | `resposta.dadosCadastrais.sexo` | ✅ `sexo` | ✅ OK |
| **DataNascimento** | `resposta.dadosCadastrais.dataNascimento` | ✅ `dataNascimento` | ✅ OK |
| **Idade** | `resposta.dadosCadastrais.idade` | ✅ `idade` | ✅ OK |
| **Escolaridade** | `resposta.dadosCadastrais.escolaridade` | ✅ `escolaridade` | ✅ OK |
| **RendaEstimada** | `resposta.possivelHistoricoProfissional[0].rendaEstimada` | ✅ `rendaEstimada` | ✅ OK |
| **FaixaRenda** | `resposta.possivelHistoricoProfissional[0].faixaSalarial` | ✅ `faixaSalarial` | ✅ OK |
| **ProbabilidadeObito** | `resposta.dadosCadastrais.obitoProvavel` | ✅ `obitoProvavel` | ✅ OK |
| **NomeMae** | `resposta.dadosCadastrais.maeNome` | ✅ `nomeMae` | ✅ OK |
| **CPFMae** | `resposta.dadosCadastrais.maeCpf` | ✅ `cpfMae` | ✅ OK |
| **TipoLogradouro1** | `resposta.enderecos[0].tipoLogradouro` | ✅ `endereco.tipoLogradouro` | ✅ OK |
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
| ✅ Implementado | **24** |
| ⚠️ Falta Adicionar | **0** |

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
      "escolaridade": "Superior Completo",    // ✅ IMPLEMENTADO
      "situacaoCadastral": "REGULAR",
      "obitoProvavel": false,
      "maeNome": "NOME DA MAE",
      "maeCpf": "98765432100",                // ✅ IMPLEMENTADO
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
        "tipoLogradouro": "Rua",             // ✅ IMPLEMENTADO
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

## ✅ Conclusão

**Todos os 24 campos solicitados** estão implementados e funcionando no arquivo `pacotes/backend/src/servicos/assertiva.ts`.

Arquivo de implementação: [assertiva.ts](file:///root/elyon/pacotes/backend/src/servicos/assertiva.ts)
