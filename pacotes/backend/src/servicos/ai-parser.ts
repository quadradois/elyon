/**
 * AI Parser Service
 * 
 * Responsável por interpretar a linguagem natural do cliente e
 * extrair dados estruturados compatíveis com o Playbook.
 */

import { gemini } from './gemini';

interface ResultadoExtracao {
    extraido: boolean;
    valor: any;      // Valor normalizado (número, string clean, boolean)
    valorOriginal: string; // O que o cliente disse exatamente
    confianca: 'ALTA' | 'MEDIA' | 'BAIXA';
    intencao: 'RESPOSTA' | 'DUVIDA' | 'RECUSA' | 'OUTRO';
}

interface ItemPlaybookContexto {
    perguntaFeita: string;
    tipoEsperado: 'TEXTO' | 'NUMERO' | 'DATA' | 'BOOLEAN' | 'LISTA';
    opcoes?: string[]; // Para tipo LISTA
    descricaoItem?: string;
}

export class AIParserService {

    /**
     * Analisa se a mensagem do cliente responde ao item atual do playbook
     */
    async extrairResposta(
        mensagemCliente: string,
        contexto: ItemPlaybookContexto
    ): Promise<ResultadoExtracao> {

        // Se a mensagem for muito curta, pode ser ruído (mas "sim" é válido)
        if (!mensagemCliente || mensagemCliente.trim().length === 0) {
            return this.respostaVazia();
        }

        const prompt = `
Você é um extrator de dados para um CRM imobiliário.
Sua tarefa é analisar a resposta do cliente a uma pergunta específica e extrair o dado estruturado.

CONTEXTO:
- Pergunta feita pelo agente: "${contexto.perguntaFeita}"
- Descrição do dado esperado: "${contexto.descricaoItem || 'Sem descrição'}"
- Tipo de dado esperado: ${contexto.tipoEsperado}
${contexto.opcoes ? `- Opções válidas: ${contexto.opcoes.join(', ')}` : ''}

MENSAGEM DO CLIENTE:
"${mensagemCliente}"

REGRAS DE EXTRAÇÃO:
1. Se o cliente respondeu a pergunta, extraia o valor no formato correto.
   - NUMERO: Retorne apenas números (ex: "5k" -> 5000).
   - BOOLEAN: true/false (ex: "sim", "claro", "não").
   - LISTA: Retorne a opção que mais se aproxima.
2. Se o cliente fez uma nova pergunta ou mudou de assunto, intencao = "DUVIDA".
3. Se o cliente se recusou a responder, intencao = "RECUSA".
4. Se a resposta for vaga ou desconexa, extraido = false.

FORMATO JSON DE SAÍDA:
{
  "extraido": boolean,
  "valor": any (null se não extraiu),
  "valorOriginal": string (trecho da mensagem que contém a resposta),
  "confianca": "ALTA" | "MEDIA" | "BAIXA",
  "intencao": "RESPOSTA" | "DUVIDA" | "RECUSA" | "OUTRO"
}
`;

        try {
            const resultado = await gemini.generateJSON<ResultadoExtracao>(prompt, {
                temperature: 0.0, // Máxima precisão
            });

            console.log(`[AI Parser] Msg: "${mensagemCliente}" -> Extraído: ${resultado.extraido} (${resultado.valor})`);
            return resultado;

        } catch (error) {
            console.error('[AI Parser] Erro na extração:', error);
            // Em caso de erro, assumimos que não entendemos
            return this.respostaVazia();
        }
    }

    private respostaVazia(): ResultadoExtracao {
        return {
            extraido: false,
            valor: null,
            valorOriginal: '',
            confianca: 'BAIXA',
            intencao: 'OUTRO'
        };
    }
}

export const aiParser = new AIParserService();
