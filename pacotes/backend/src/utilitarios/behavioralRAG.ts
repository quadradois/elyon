/**
 * Motor de RAG Comportamental (Behavioral RAG / Dynamic Few-Shots)
 * 
 * Injeta diretrizes específicas de vendas baseadas na semântica
 * da última fala do cliente. Evita RAG global pra focar em regras cirúrgicas.
 */

export interface LicaoVendas {
    id: string;
    gatilhos: string[];
    diretriz: string;
}

// Em produção, isso pode vir do Prisma (Ex: banco de dados de Curadoria)
// Para a V1 (MVP), usamos uma Seed em memória para validação imediata.
export const licoesCuradasMock: LicaoVendas[] = [
    {
        id: "cenario_inquilino",
        gatilhos: ["inquilino", "tá alugado", "ta alugado", "morando gente", "tem gente morando"],
        diretriz: "⚠️ [LIÇÃO RAG]: O proprietário avisou que existe INQUILINO no imóvel. Jamais sugira desocupação agora; foque em dizer que a Venda para Investidor (renda passiva) é o melhor caminho para não perder o aluguel durante a venda."
    },
    {
        id: "cenario_hostil_exclusividade",
        gatilhos: ["amarrar com vocês", "ja me dei mal", "corretor enrola", "não assino", "tô fora"],
        diretriz: "⚠️ [LIÇÃO RAG]: O Lead está HOSTIL / Desconfiado. NÃO aja de forma defensiva sobre nós. Concorde que o mercado é ruim e afirme que nosso papel é justamente fiscalizar os maus profissionais para ele."
    }
];

/**
 * Escaneia a última fala do Lead. Se bater com nossos gatilhos (keywords/semântica cruzada),
 * retorna as Lições de Cura para serem coladas no Prompt do Agent.
 */
export function recuperarLicoesComportamentais(
    ultimaInteracao: string, 
    bancoDeLicoes: LicaoVendas[] = licoesCuradasMock
): string {
    if (!ultimaInteracao) return '';
    
    // Normalização básica do texto para busca (Em V2, pode ser embedding OpenAI/Pinecone)
    const textoLimpo = ultimaInteracao.toLowerCase();
    const diretrizesEcontradas: string[] = [];

    for (const licao of bancoDeLicoes) {
        for (const gatilho of licao.gatilhos) {
            // Busca simplificada
            if (textoLimpo.includes(gatilho.toLowerCase())) {
                diretrizesEcontradas.push(licao.diretriz);
                break; // Se achou um gatilho pra essa regra, já coloca e vai pra próxima regra
            }
        }
    }

    if (diretrizesEcontradas.length > 0) {
        return '\n\n[O GERENTE INJETOU AS SEGUINTES DIRETRIZES TÁTICAS PARA ESTE CENÁRIO ESPECÍFICO AVALIANDO O TEXTO ACIMA]:\n' 
             + diretrizesEcontradas.map(d => `- ${d}`).join('\n');
    }

    return '';
}
