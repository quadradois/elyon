const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { descriptografar } = require('./src/lib/crypto');
const crypto = require('crypto');

async function main() {
  const t = await prisma.tenant.findUnique({ where: { slug: 'elyon' } });
  
  if (!t.llmApiKeyCriptografada) {
    console.log("Sem key");
    process.exit(1);
  }
  
  const key = descriptografar(t.llmApiKeyCriptografada);
  
  const tools = [
    {
      "type": "function",
      "function": {
        "name": "converter_para_lead",
        "description": "Use quando o proprietário demonstrar interesse REAL em vender ou alugar.",
        "parameters": {
          "type": "object",
          "properties": {
            "contatoId": {
              "type": "string",
              "description": "ID do contato que será convertido"
            },
            "temperatura": {
              "type": "string",
              "enum": [
                "MORNO",
                "QUENTE"
              ],
              "description": "QUENTE: urgência, MORNO: interesse sem pressa"
            },
            "tipoInteresse": {
              "type": "string",
              "enum": [
                "VENDA",
                "LOCACAO",
                "AMBOS"
              ],
              "description": "O que quer fazer"
            },
            "timeline": {
              "type": "string",
              "description": "Quando: \"1 mês\", \"urgente\", \"sem pressa\""
            },
            "enderecoImovel": {
              "type": "string",
              "description": "Endereço do imóvel"
            },
            "tipoImovel": {
              "type": "string",
              "description": "apartamento, casa, comercial, terreno"
            },
            "areaImovel": {
              "type": "string",
              "description": "Área: \"54m²\", \"100m²\""
            },
            "quartosImovel": {
              "type": "number",
              "description": "Número de quartos"
            },
            "vagasImovel": {
              "type": "number",
              "description": "Vagas de garagem"
            },
            "valorPretendido": {
              "type": "string",
              "description": "Valor pretendido: \"R$ 650.000\""
            },
            "ocupacaoImovel": {
              "type": "string",
              "description": "\"ocupado\", \"vazio\", \"alugado\""
            },
            "motivacaoVenda": {
              "type": "string",
              "description": "Motivação: \"mudança de cidade\", \"separação\""
            },
            "situacaoAtual": {
              "type": "string",
              "description": "Situação: \"vazio há 6 meses\""
            },
            "prazoDesejado": {
              "type": "string",
              "description": "\"precisa vender em 3 meses\""
            },
            "doresIdentificadas": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "Dores: [\"sem visitantes\", \"propostas baixas\"]"
            }
          },
          "required": [
            "contatoId",
            "temperatura",
            "tipoInteresse",
            "timeline"
          ],
          "additionalProperties": false
        }
      }
    }
  ];

  const payload = {
    model: t.llmModelo || 'moonshotai/kimi-k2-0905:exacto',
    messages: [
      { role: 'system', content: 'Você é um corretor.' },
      { role: 'user', content: 'sim eu tenho interesse em vender meu apartamento, mas não sei como é o processo!' },
      { role: 'assistant', content: 'Show! Qual é a metragem do seu? Tem 54m² ou 59m²?' },
      { role: 'user', content: 'ele tem 59' }
    ],
    tools: tools,
    tool_choice: "auto"
  };

  const response = await fetch(t.llmBaseUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
      'HTTP-Referer': 'https://crm.elyon.ia.br',
      'X-Title': 'Elyon'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  console.log("RESPONSE HTTP CODE:", response.status);
  console.log("RAW BODY:");
  console.log(text);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
