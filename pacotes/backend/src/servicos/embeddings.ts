/**
 * Serviço de Embeddings usando OpenAI text-embedding-3-small
 * 
 * Responsável por gerar vetores semânticos para busca RAG
 */

import OpenAI from 'openai';

let defaultOpenaiClient: OpenAI | null = null;

function obterOpenAI(apiKey?: string): OpenAI {
  if (apiKey) {
    return new OpenAI({ apiKey });
  }
  if (!defaultOpenaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada no .env');
    }
    defaultOpenaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return defaultOpenaiClient;
}

export class EmbeddingService {
  private static readonly MODELO = 'text-embedding-3-small';
  private static readonly DIMENSOES = 1536;
  
  /**
   * Gera embedding vetorial de um texto
   * @param texto - Texto para gerar embedding
   * @param apiKey - Opcional. API Key do tenant para garantir BYOK
   * @returns Vetor de 1536 dimensões
   */
  async gerar(texto: string, apiKey?: string): Promise<number[]> {
    try {
      const openai = obterOpenAI(apiKey);
      
      const response = await openai.embeddings.create({
        model: EmbeddingService.MODELO,
        input: texto,
        encoding_format: 'float',
      });
      
      return response.data[0].embedding;
    } catch (error: any) {
      console.error('[Embeddings] Erro ao gerar embedding:', error);
      throw new Error(`Erro ao gerar embedding: ${error.message}`);
    }
  }
  
  /**
   * Serializa vetor para salvar no banco (JSON string)
   */
  serializar(vetor: number[]): string {
    return JSON.stringify(vetor);
  }
  
  /**
   * Desserializa vetor do banco
   */
  desserializar(vetorString: string): number[] {
    try {
      return JSON.parse(vetorString);
    } catch (error) {
      throw new Error('Embedding inválido no banco de dados');
    }
  }
  
  /**
   * Calcula similaridade de cosseno entre dois vetores
   * Retorna valor entre 0 (completamente diferente) e 1 (idêntico)
   */
  calcularSimilaridade(vetor1: number[], vetor2: number[]): number {
    if (vetor1.length !== vetor2.length) {
      throw new Error('Vetores devem ter o mesmo tamanho');
    }
    
    let produtoEscalar = 0;
    let norma1 = 0;
    let norma2 = 0;
    
    for (let i = 0; i < vetor1.length; i++) {
      produtoEscalar += vetor1[i] * vetor2[i];
      norma1 += vetor1[i] * vetor1[i];
      norma2 += vetor2[i] * vetor2[i];
    }
    
    const denominador = Math.sqrt(norma1) * Math.sqrt(norma2);
    
    if (denominador === 0) {
      return 0;
    }
    
    return produtoEscalar / denominador;
  }
  
  /**
   * Prepara texto para embedding (limpeza e formatação)
   */
  prepararTexto(texto: string): string {
    return texto
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 8000); // Limite do modelo
  }
}

export const embeddingService = new EmbeddingService();
