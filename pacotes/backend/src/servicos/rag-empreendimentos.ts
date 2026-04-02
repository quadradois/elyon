import { prisma } from '../lib/db';
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
      // Serializando adequadamente para sintaxe de array vetorial nativa do Postgres
      const vetorString = `[${vetor.join(',')}]`;

      // Como o embedding é um campo nativo Unsupported("vector"), usamos $executeRawUnsafe
      await prisma.$executeRawUnsafe(`
        INSERT INTO empreendimentos_conhecimento (
          id, nome, localizacao, cep, tipo, "briefingCompleto", "briefingEstruturado", confiabilidade, embedding, "embeddingGeradoEm", "tenantId", validado, "criadoEm", "ultimaAtualizacao", versao
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6::jsonb, $7, $8::vector, NOW(), $9, false, NOW(), NOW(), 1
        )
      `,
        dados.nome,
        dados.localizacao,
        dados.cep || null,
        dados.tipo,
        dados.briefing.resumo_sdr || JSON.stringify(dados.briefing),
        JSON.stringify(dados.briefing),
        dados.briefing.confiabilidade || 0,
        vetorString,
        dados.tenantId || null
      );

      return true;
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
      const vetorString = `[${queryVetor.join(',')}]`;

      // Busca Semântica GLOBAL direta pelo DB usando pgvector (<=>)
      // Limitando por um limiar de 0.5 (similaridade) e pegando os N melhores resultados
      const sqlQuery = `
        SELECT *, 1 - (embedding <=> $1::vector) AS similaridade 
        FROM empreendimentos_conhecimento 
        WHERE embedding IS NOT NULL 
        AND 1 - (embedding <=> $1::vector) > 0.5 
        ORDER BY similaridade DESC 
        LIMIT $2
      `;

      const resultados: any[] = await prisma.$queryRawUnsafe(sqlQuery, vetorString, limit);

      return resultados;
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

  /**
   * Deleta conhecimento por ID
   */
  async deletar(id: string) {
    return await prisma.empreendimentoConhecimento.delete({
      where: { id }
    });
  }

  /**
   * Deleta conhecimento por nome e localização
   */
  async deletarPorNome(nome: string, localizacao: string) {
    const existente = await this.buscarPorNome(nome, localizacao);
    if (existente) {
      await this.deletar(existente.id);
      return true;
    }
    return false;
  }

  /**
   * Lista todos os conhecimentos (para debug/admin)
   */
  async listarTodos() {
    return await prisma.empreendimentoConhecimento.findMany({
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        nome: true,
        localizacao: true,
        tipo: true,
        confiabilidade: true,
        validado: true,
        criadoEm: true,
        ultimaAtualizacao: true,
        versao: true
      }
    });
  }
}

export const ragEmpreendimentos = new RAGEmpreendimentos();
