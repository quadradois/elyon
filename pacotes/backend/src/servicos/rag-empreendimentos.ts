import { prisma } from '../servidor';
import { embeddingService } from './embeddings';

export class RAGEmpreendimentos {
  /**
   * Salva conhecimento com embedding
   */
  async salvar(dados: {
    nome: string;
    localizacao: string;
    cep?: string;
    tipo: string;
    briefing: any;
    tenantId?: string; // Opcional agora
  }) {
    try {
      // Gerar embedding do briefing
      const textoParaEmbedding = `
        ${dados.nome}
        ${dados.localizacao}
        ${dados.briefing.resumo_sdr || ''}
        ${dados.briefing.caracteristicas?.join(', ') || ''}
        ${dados.briefing.diferenciais?.join(', ') || ''}
      `.trim();
      
      console.log(`[RAG] Gerando embedding para: ${dados.nome}`);
      const vetor = await embeddingService.gerar(textoParaEmbedding);
      
      return await prisma.empreendimentoConhecimento.create({
        data: {
          nome: dados.nome,
          localizacao: dados.localizacao,
          cep: dados.cep,
          tipo: dados.tipo,
          briefingCompleto: dados.briefing.resumo_sdr || JSON.stringify(dados.briefing),
          briefingEstruturado: dados.briefing,
          confiabilidade: dados.briefing.confiabilidade || 0,
          embedding: embeddingService.serializar(vetor),
          embeddingGeradoEm: new Date(),
          tenantId: dados.tenantId, // Pode ser null
          validado: false
        },
      });
    } catch (error) {
      console.error('[RAG] Erro ao salvar conhecimento:', error);
      throw error;
    }
  }
  
  /**
   * Busca por nome exato e localização (GLOBAL - ignora tenant)
   */
  async buscarPorNome(nome: string, localizacao: string) {
    return await prisma.empreendimentoConhecimento.findFirst({
      where: { 
        nome: { equals: nome, mode: 'insensitive' },
        localizacao: { contains: localizacao, mode: 'insensitive' },
        // tenantId removido da busca!
      },
    });
  }
  
  /**
   * Busca semântica (GLOBAL - ignora tenant)
   */
  async buscarSemantico(query: string, limit = 5) {
    try {
      // Gerar embedding da query
      const queryVetor = await embeddingService.gerar(query);
      
      // Buscar todos os empreendimentos (GLOBAL) que têm embedding
      const todos = await prisma.empreendimentoConhecimento.findMany({
        where: { 
          embedding: { not: null } 
        },
      });
      
      // Calcular similaridades
      const comSimilaridade = todos.map(emp => {
        try {
          const vetor = embeddingService.desserializar(emp.embedding!);
          return {
            ...emp,
            similaridade: embeddingService.calcularSimilaridade(queryVetor, vetor)
          };
        } catch (e) {
          return { ...emp, similaridade: 0 };
        }
      });
      
      // Ordenar e limitar
      return comSimilaridade
        .filter(item => item.similaridade > 0.5) // Filtro mínimo de relevância (ajustado para 0.5)
        .sort((a, b) => b.similaridade - a.similaridade)
        .slice(0, limit);
        
    } catch (error) {
      console.error('[RAG] Erro na busca semântica:', error);
      return [];
    }
  }

  /**
   * Atualiza o conhecimento existente (ex: após validação humana)
   */
  async atualizar(id: string, dados: {
    briefingCompleto?: string;
    briefingEstruturado?: any;
    validado?: boolean;
    validadoPor?: string;
  }) {
    return await prisma.empreendimentoConhecimento.update({
      where: { id },
      data: {
        ...dados,
        validadoEm: dados.validado ? new Date() : undefined,
        ultimaAtualizacao: new Date(),
        versao: { increment: 1 }
      }
    });
  }
}

export const ragEmpreendimentos = new RAGEmpreendimentos();
