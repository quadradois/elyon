
const jsonUsuario = {
    "state": {
        "$schemaVersion": "1.1",
        "currentTurn": 1,
        "currentAgent": {
            "name": "Assistente"
        },
        "originalInput": "eu tenho interesse!",
        "modelResponses": [
            {
                "output": [
                    {
                        "content": [{ "type": "output_text", "text": "TEXTO_VIA_MODEL_RESPONSES" }]
                    }
                ]
            }
        ],
        "currentStep": {
            "type": "next_step_final_output",
            "output": "TEXTO_VIA_CURRENT_STEP"
        }
    }
};

function extrairResposta(resposta) {
    let textoResposta = '';

    console.log('--- DIAGNÓSTICO ---');
    console.log('Tem state?', !!resposta?.state);
    console.log('Tem currentStep?', !!resposta?.state?.currentStep);
    console.log('Tem output em currentStep?', !!resposta?.state?.currentStep?.output);
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

    return textoResposta;
}

const resultado = extrairResposta(jsonUsuario);
console.log('RESULTADO FINAL:', resultado);
