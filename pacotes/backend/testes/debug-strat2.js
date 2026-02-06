
const jsonUsuario = {
    "state": {
        "currentStep": {
            "output": null
        },
        "modelResponses": [
            {
                "output": [
                    {
                        "content": [{ "type": "output_text", "text": "TEXTO_VIA_MODEL_RESPONSES" }]
                    }
                ]
            }
        ]
    }
};

function extrairResposta(resposta) {
    let textoResposta = '';

    // Estratégia 1
    if (resposta?.state?.currentStep?.output) {
        textoResposta = resposta.state.currentStep.output;
        console.log('✅ Estratégia 1 funcionou');
    }
    // Estratégia 2
    else if (resposta?.state?.modelResponses?.length > 0) {
        const lastResponse = resposta.state.modelResponses[resposta.state.modelResponses.length - 1];
        if (lastResponse.output?.[0]?.content?.[0]?.text) {
            textoResposta = lastResponse.output[0].content[0].text;
            console.log('✅ Estratégia 2 (content) funcionou');
        } else if (typeof lastResponse.output === 'string') {
            textoResposta = lastResponse.output;
            console.log('✅ Estratégia 2 (string) funcionou');
        }
    }

    return textoResposta;
}

const resultado = extrairResposta(jsonUsuario);
console.log('RESULTADO FINAL:', resultado);
