#!/bin/bash

# Testar webhook com a instância correta
INSTANCE_NAME="elyon_3b5f4a6a_vendas"
WEBHOOK_URL="http://localhost:3000/api/webhooks/whatsapp?instance=${INSTANCE_NAME}"

echo "🧪 Testando webhook com instância: ${INSTANCE_NAME}"
echo "📡 URL: ${WEBHOOK_URL}"

# Payload de teste
PAYLOAD='{
  "event": "messages.upsert",
  "instance": "'${INSTANCE_NAME}'",
  "data": {
    "messages": [
      {
        "key": {
          "remoteJid": "5511999998888@s.whatsapp.net",
          "fromMe": false,
          "id": "TEST_MSG_ID_1"
        },
        "pushName": "Teste User",
        "message": {
          "conversation": "Olá, isso é um teste de webhook!"
        },
        "messageTimestamp": '"'$(date +%s)'"'
      }
    ]
  }
}'

echo "📤 Enviando payload..."
echo "📝 Payload: ${PAYLOAD}"

curl -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}" \
  -v

echo -e "\n✅ Teste concluído!"