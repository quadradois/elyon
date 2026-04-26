import { BIBLIOTECA_OBJECOES, Objecao } from './catalogo-objecoes';
import { logger } from '../lib/logger';
import { MODELO_PADRAO_AUXILIAR } from './byok-resolver';

/**
 * Integração do catálogo de objeções no ecossistema de skills:
 * - Este classificador roda no ORQUESTRADOR e seleciona entradas do `catalogo-objecoes.ts`.
 * - As skills continuam sendo o playbook principal de linguagem via `ler_skill`.
 * - Catálogo e skills são complementares; em conflito, prevalecem guardrails e nomenclatura oficial.
 */

export async function tentarDetectarObjecao(
    mensagem: string, 
    apiKey?: string, 
    baseUrl?: string, 
    model: string = MODELO_PADRAO_AUXILIAR
): Promise<Objecao | null> {
    if (!apiKey || !mensagem || mensagem.trim().length === 0) return null;
    
    // Construir um prompt ultraleve apenas com os IDs e gatilhos para economizar tokens
    const triggerList = BIBLIOTECA_OBJECOES.map(o => `ID ${o.id}: ${o.gatilhos.join(', ')}`).join('\n');
    
    const requestBody = {
        model, // Usa o modelo do tenant, de preferência o fallback fast (mini)
        messages: [
            {
                role: 'system',
                content: `Você é um classificador de objeções de vendas B2B altamente contido.
REGRAS DE OURO:
1. Uma pergunta informativa ou técnica (Ex: "Qual o prazo de contrato?", "Como é feito?") NÃO É UMA OBJEÇÃO. Se não houver rechaço, medo ou queixa clara, responda 0.
2. Só classifique um ID se a fala do lead demonstrar clara DÚVIDA RESISTENTE, NEGATIVA ou DOR que bata perfeitamente com os gatilhos abaixo.

Lista de Objeções:
${triggerList}

Responda APENAS com o número do ID correspondente (ex: 5). Se não bater claramente com NENHUMA ou for só pergunta técnica neutra, responda APENAS 0.`
            },
            {
                role: 'user',
                content: mensagem.substring(0, 500) // Limitar tamanho para economia e velocidade
            }
        ],
        temperature: 0.0, // Máxima determinística
        max_completion_tokens: 5     // Só precisa devolver 1 número
    };

    try {
        const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
        
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 2000); // 2s timeout
        
        let response: Response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody),
                signal: ctrl.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            logger.debug(`[OBJ_CLASSIFIER] Bypass: Falha HTTP ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        
        const id = parseInt(content || '0', 10);
        if (id > 0) {
            const objecao = BIBLIOTECA_OBJECOES.find(o => o.id === id);
            if (objecao) {
                logger.debug(`[OBJ_CLASSIFIER]🎯 Objeção ID ${id} detectada em milissegundos.`);
                return objecao;
            }
        }
        
    } catch (err) {
        logger.warn('[OBJ_CLASSIFIER] Timeout ou erro no classificador bypassando sem travar.');
    }
    
    return null;
}
