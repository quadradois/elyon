
const jsonUsuario = {
    "state": { "$schemaVersion": "1.1", "currentTurn": 1, "currentAgent": { "name": "Assistente" }, "originalInput": "eu tenho interesse!", "modelResponses": [{ "usage": { "requests": 1, "inputTokens": 500, "outputTokens": 39, "totalTokens": 539, "inputTokensDetails": [{ "cached_tokens": 0 }], "outputTokensDetails": [{ "reasoning_tokens": 0 }], "requestUsageEntries": [{ "inputTokens": 500, "outputTokens": 39, "totalTokens": 539, "inputTokensDetails": { "cached_tokens": 0 }, "outputTokensDetails": { "reasoning_tokens": 0 }, "endpoint": "responses.create" }] }, "output": [{ "providerData": {}, "id": "msg_05328e8f02c37086006985e9afa4e88198b0534d0ed3cbe493", "type": "message", "role": "assistant", "status": "completed", "content": [{ "type": "output_text", "text": "Ótimo! Vamos começar entendendo melhor sobre o seu imóvel para que possamos ajudá-lo da melhor forma possível. 😊\n\nQual é a área do imóvel em metros quadrados?" }] }], "responseId": "resp_05328e8f02c37086006985e9ae9e6c81989a45950575762734", "providerData": { "id": "resp_05328e8f02c37086006985e9ae9e6c81989a45950575762734", "object": "response", "created_at": 1770383790, "status": "completed", "background": false, "billing": { "payer": "developer" }, "completed_at": 1770383792, "error": null, "frequency_penalty": 0, "incomplete_details": null, "instructions": "...", "max_output_tokens": null, "max_tool_calls": null, "model": "gpt-4o-2024-08-06", "output": [{ "id": "msg_05328e8f02c37086006985e9afa4e88198b0534d0ed3cbe493", "type": "message", "status": "completed", "content": [{ "type": "output_text", "annotations": [], "logprobs": [], "text": "Ótimo! Vamos começar entendendo melhor sobre o seu imóvel para que possamos ajudá-lo da melhor forma possível. 😊\n\nQual é a área do imóvel em metros quadrados?" }], "role": "assistant" }], "parallel_tool_calls": true, "presence_penalty": 0, "previous_response_id": null, "prompt_cache_key": null, "prompt_cache_retention": null, "reasoning": { "effort": null, "summary": null }, "safety_identifier": null, "service_tier": "default", "store": true, "temperature": 1, "text": { "format": { "type": "text" }, "verbosity": "medium" }, "tool_choice": "auto", "tools": [], "top_logprobs": 0, "top_p": 1, "truncation": "disabled", "usage": { "input_tokens": 500, "input_tokens_details": { "cached_tokens": 0 }, "output_tokens": 39, "output_tokens_details": { "reasoning_tokens": 0 }, "total_tokens": 539 }, "user": null, "metadata": {}, "output_text": "Ótimo! Vamos começar entendendo melhor sobre o seu imóvel para que possamos ajudá-lo da melhor forma possível. 😊\n\nQual é a área do imóvel em metros quadrados?" } } };

    function extrairResposta(resposta) {
        let textoResposta = '';

console.log('--- DIAGNÓSTICO ---');
console.log('Tem state?', !!resposta?.state);
console.log('Tem currentStep?', !!resposta?.state?.currentStep);
console.log('Tem output em currentStep?', !!resposta?.state?.currentStep?.output);
console.log('Tipo output:', typeof resposta?.state?.currentStep?.output);
console.log('Valor output:', resposta?.state?.currentStep?.output);
console.log('-------------------');

// Estratégia 1: Output direto do passo final (Baseado no dump fornecido)
if (resposta?.state?.currentStep?.output) {
    textoResposta = resposta.state.currentStep.output;
    console.log('✅ Estratégia 1 funcionou');
}
// Estratégia 2: Histórico de mensagens do modelo (Canonical)
else if (resposta?.state?.modelResponses?.length > 0) {
    const lastResponse = resposta.state.modelResponses[resposta.state.modelResponses.length - 1];
    // Tentar extrair de content[0].text ou output[0].content
    if (lastResponse.output?.[0]?.content?.[0]?.text) {
        textoResposta = lastResponse.output[0].content[0].text;
        console.log('✅ Estratégia 2 (content) funcionou');
    } else if (typeof lastResponse.output === 'string') {
        textoResposta = lastResponse.output;
        console.log('✅ Estratégia 2 (string) funcionou');
    } else {
        console.log('❌ Estratégia 2 falhou: Output desconhecido em lastResponse');
    }
}
// Estratégia 3: Formato legado de mensagens
else if (resposta?.messages?.length > 0) {
    textoResposta = resposta.messages[resposta.messages.length - 1].content;
    console.log('✅ Estratégia 3 funcionou');
} else {
    console.log('❌ Todas as estratégias falharam');
}

// Fallback: Se ainda estiver vazio ou for objeto, tenta stringificar de forma segura
if (!textoResposta || typeof textoResposta !== 'string') {
    const dump = JSON.stringify(resposta);
    console.warn('⚠️ Falha na extração. Dump:', dump.substring(0, 200));
    // Evitar enviar JSON bruto para o usuário. Tentar mensagem genérica se falhar tudo.
    if (dump.includes('currentStep')) { // Se parece ser um state object mas falhamos em parsear
        textoResposta = "Desculpe, processei sua mensagem mas tive um erro interno ao gerar a resposta. Pode tentar novamente?";
    } else {
        textoResposta = dump; // Último recurso: retorna o que tiver
    }
    console.log('⚠️ Caiu no Fallback:', textoResposta);
}

return textoResposta;
}

const resultado = extrairResposta(jsonUsuario);
console.log('RESULTADO FINAL:', resultado);
