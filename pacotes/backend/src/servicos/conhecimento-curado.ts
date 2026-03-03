/**
 * SERVIÇO DE CONHECIMENTO CURADO (GLOBAL)
 * 
 * Gerencia técnicas de vendas universais, curadas manualmente.
 * Serve como base para todos os tenants, complementando o RAG automático.
 * 
 * Hierarquia de conhecimento:
 * 1. Conhecimento Curado (global) - Técnicas universais validadas
 * 2. Conhecimento do Tenant (RAG) - Aprendizado automático por tenant
 * 
 * @author Elyon AI
 * @since 05/12/2025
 */

import { PrismaClient } from '@prisma/client';
import { embeddingService } from './embeddings';

const prisma = new PrismaClient();

// Tipos
export interface ConhecimentoCuradoInput {
  categoria: string;
  subcategoria?: string;
  titulo: string;
  texto: string;
  contextoUso: string;
  exemplo?: string;
  tipoImovel?: string[];
  faixaPreco?: string;
  tipoNegocio?: string[];
  scoreEficacia?: number;
  fonte?: string;
  criadoPor?: string;
}

export interface BuscaConhecimentoParams {
  query: string;
  categoria?: string;
  tipoImovel?: string;
  faixaPreco?: string;
  tipoNegocio?: string;
  limite?: number;
}

export interface ConhecimentoEncontrado {
  id: string;
  categoria: string;
  titulo: string;
  texto: string;
  contextoUso: string;
  exemplo?: string;
  scoreEficacia: number;
  similaridade: number;
}

class ConhecimentoCuradoService {

  /**
   * Adiciona novo conhecimento curado
   */
  async adicionar(input: ConhecimentoCuradoInput): Promise<string> {
    console.log(`[CONHECIMENTO CURADO] Adicionando: ${input.titulo}`);

    const textoParaEmbedding = `${input.titulo}. ${input.texto}. Usar quando: ${input.contextoUso}`;
    const embedding = await embeddingService.gerar(textoParaEmbedding);
    const vetorString = `[${embedding.join(',')}]`;

    const id = require('crypto').randomUUID();

    await prisma.$executeRawUnsafe(`
      INSERT INTO conhecimento_curado (
        id, categoria, subcategoria, titulo, texto, "contextoUso", exemplo, "tipoImovel", "faixaPreco", "tipoNegocio", "scoreEficacia", fonte, "criadoPor", embedding, "criadoEm", "atualizadoEm", ativo, ordem, "embeddingModelo"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::vector, NOW(), NOW(), true, 0, 'text-embedding-3-small'
      )
    `,
      id,
      input.categoria,
      input.subcategoria || null,
      input.titulo,
      input.texto,
      input.contextoUso,
      input.exemplo || null,
      input.tipoImovel || [],
      input.faixaPreco || null,
      input.tipoNegocio || [],
      input.scoreEficacia || 80,
      input.fonte || 'manual',
      input.criadoPor || null,
      vetorString
    );

    console.log(`[CONHECIMENTO CURADO] ✅ Adicionado com ID: ${id}`);
    return id;
  }

  /**
   * Busca conhecimento curado por similaridade semântica
   */
  async buscar(params: BuscaConhecimentoParams): Promise<ConhecimentoEncontrado[]> {
    const { query, categoria, tipoImovel, faixaPreco, tipoNegocio, limite = 5 } = params;

    const queryEmbedding = await embeddingService.gerar(query);
    const vetorString = `[${queryEmbedding.join(',')}]`;

    let sqlQuery = `
      SELECT id, categoria, subcategoria, titulo, texto, "contextoUso", exemplo, "tipoImovel", "faixaPreco", "tipoNegocio", "scoreEficacia",
      1 - (embedding <=> $1::vector) AS similaridade
      FROM conhecimento_curado
      WHERE ativo = true AND embedding IS NOT NULL
    `;
    const sqlParams: any[] = [vetorString];
    let queryIndex = 2;

    if (categoria) {
      sqlQuery += ` AND categoria = $${queryIndex++}`;
      sqlParams.push(categoria);
    }
    if (faixaPreco) {
      sqlQuery += ` AND "faixaPreco" = $${queryIndex++}`;
      sqlParams.push(faixaPreco);
    }
    // Para simplificar arrays do postgres (tipoImovel e tipoNegocio), a filtragem pode ser feita pós query 
    // ou usaremos uma condição mais simples. Vamos filtrar similaridade nativamente:

    sqlQuery += ` AND 1 - (embedding <=> $1::vector) > 0.3`;

    const conhecimentos: any[] = await prisma.$queryRawUnsafe(sqlQuery, ...sqlParams);

    // Calcular similaridade e filtrar na memória se existirem regras mais complexas de arrays
    const resultados: ConhecimentoEncontrado[] = [];

    for (const conhecimento of conhecimentos) {
      // Verificar filtros de aplicabilidade
      if (tipoImovel && conhecimento.tipoImovel && conhecimento.tipoImovel.length > 0) {
        if (!conhecimento.tipoImovel.includes(tipoImovel)) continue;
      }
      if (tipoNegocio && conhecimento.tipoNegocio && conhecimento.tipoNegocio.length > 0) {
        if (!conhecimento.tipoNegocio.includes(tipoNegocio)) continue;
      }

      resultados.push({
        id: conhecimento.id,
        categoria: conhecimento.categoria,
        titulo: conhecimento.titulo,
        texto: conhecimento.texto,
        contextoUso: conhecimento.contextoUso,
        exemplo: conhecimento.exemplo || undefined,
        scoreEficacia: Number(conhecimento.scoreEficacia),
        similaridade: conhecimento.similaridade,
      });
    }

    // Ordenar por similaridade * eficácia e limitar
    return resultados
      .sort((a, b) => (b.similaridade * b.scoreEficacia) - (a.similaridade * a.scoreEficacia))
      .slice(0, limite);
  }

  /**
   * Busca rápida por categoria (sem embedding)
   */
  async buscarPorCategoria(categoria: string, limite: number = 10): Promise<ConhecimentoEncontrado[]> {
    const conhecimentos = await prisma.conhecimentoCurado.findMany({
      where: {
        categoria,
        ativo: true,
      },
      orderBy: [
        { scoreEficacia: 'desc' },
        { ordem: 'asc' },
      ],
      take: limite,
    });

    return conhecimentos.map(c => ({
      id: c.id,
      categoria: c.categoria,
      titulo: c.titulo,
      texto: c.texto,
      contextoUso: c.contextoUso,
      exemplo: c.exemplo || undefined,
      scoreEficacia: Number(c.scoreEficacia),
      similaridade: 1, // Busca direta, não por similaridade
    }));
  }

  /**
   * Busca híbrida: conhecimento curado + conhecimento do tenant
   * Esta é a função principal usada pelo SDR
   */
  async buscarHibrido(
    query: string,
    tenantId: string,
    params?: {
      categoria?: string;
      tipoImovel?: string;
      faixaPreco?: string;
      tipoNegocio?: string;
      limiteCurado?: number;
      limiteTenant?: number;
    }
  ): Promise<{
    curado: ConhecimentoEncontrado[];
    tenant: ConhecimentoEncontrado[];
  }> {
    const {
      categoria,
      tipoImovel,
      faixaPreco,
      tipoNegocio,
      limiteCurado = 3,
      limiteTenant = 5,
    } = params || {};

    // Gerar embedding da query uma vez
    const queryEmbedding = await embeddingService.gerar(query);

    // Buscar conhecimento curado (global)
    const curado = await this.buscar({
      query,
      categoria,
      tipoImovel,
      faixaPreco,
      tipoNegocio,
      limite: limiteCurado,
    });

    // Buscar conhecimento do tenant (RAG)
    const tenant = await this.buscarConhecimentoTenant(
      queryEmbedding,
      tenantId,
      limiteTenant
    );

    return { curado, tenant };
  }

  /**
   * Busca conhecimento específico do tenant (RAG automático)
   */
  private async buscarConhecimentoTenant(
    queryEmbedding: number[],
    tenantId: string,
    limite: number
  ): Promise<ConhecimentoEncontrado[]> {
    const vetorString = `[${queryEmbedding.join(',')}]`;

    const querySql = `
      SELECT id, "tipoConteudo", "textoOriginal", metadados, "scoreQualidade",
      1 - (embedding <=> $1::vector) AS similaridade
      FROM conversas_embeddings
      WHERE "tenantId" = $2 AND "scoreQualidade" >= 70 AND embedding IS NOT NULL
      AND 1 - (embedding <=> $1::vector) > 0.4
    `;

    const embeddings: any[] = await prisma.$queryRawUnsafe(querySql, vetorString, tenantId);

    const resultados: ConhecimentoEncontrado[] = [];

    for (const emb of embeddings) {
      const metadados = emb.metadados as any || {};
      resultados.push({
        id: emb.id,
        categoria: emb.tipoConteudo,
        titulo: metadados.titulo || emb.tipoConteudo,
        texto: emb.textoOriginal,
        contextoUso: metadados.contexto || 'Aprendido de conversa real',
        scoreEficacia: Number(emb.scoreQualidade),
        similaridade: emb.similaridade,
      });
    }

    return resultados
      .sort((a, b) => (b.similaridade * b.scoreEficacia) - (a.similaridade * a.scoreEficacia))
      .slice(0, limite);
  }

  /**
   * Calcula similaridade de cosseno entre dois vetores
   */
  private calcularSimilaridade(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Lista todas as categorias disponíveis
   */
  async listarCategorias(): Promise<{ categoria: string; total: number }[]> {
    const result = await prisma.conhecimentoCurado.groupBy({
      by: ['categoria'],
      where: { ativo: true },
      _count: { id: true },
    });

    return result.map(r => ({
      categoria: r.categoria,
      total: r._count.id,
    }));
  }

  /**
   * Obtém estatísticas do conhecimento curado
   */
  async obterEstatisticas(): Promise<{
    totalConhecimentos: number;
    porCategoria: { categoria: string; total: number }[];
    porFonte: { fonte: string; total: number }[];
    mediaEficacia: number;
  }> {
    const [total, porCategoria, porFonte, stats] = await Promise.all([
      prisma.conhecimentoCurado.count({ where: { ativo: true } }),
      prisma.conhecimentoCurado.groupBy({
        by: ['categoria'],
        where: { ativo: true },
        _count: { id: true },
      }),
      prisma.conhecimentoCurado.groupBy({
        by: ['fonte'],
        where: { ativo: true },
        _count: { id: true },
      }),
      prisma.conhecimentoCurado.aggregate({
        where: { ativo: true },
        _avg: { scoreEficacia: true },
      }),
    ]);

    return {
      totalConhecimentos: total,
      porCategoria: porCategoria.map(r => ({ categoria: r.categoria, total: r._count.id })),
      porFonte: porFonte.map(r => ({ fonte: r.fonte || 'manual', total: r._count.id })),
      mediaEficacia: Number(stats._avg.scoreEficacia) || 0,
    };
  }

  /**
   * Atualiza conhecimento existente
   */
  async atualizar(id: string, input: Partial<ConhecimentoCuradoInput>): Promise<void> {
    const updateData: any = { ...input };

    // Se texto ou contexto mudou, regenerar embedding
    if (input.texto || input.contextoUso || input.titulo) {
      const atual = await prisma.conhecimentoCurado.findUnique({
        where: { id },
        select: { titulo: true, texto: true, contextoUso: true },
      });

      if (atual) {
        const textoParaEmbedding = `${input.titulo || atual.titulo}. ${input.texto || atual.texto}. Usar quando: ${input.contextoUso || atual.contextoUso}`;
        const embedding = await embeddingService.gerar(textoParaEmbedding);
        const vetorString = `[${embedding.join(',')}]`;

        await prisma.$executeRawUnsafe(`
          UPDATE conhecimento_curado
          SET embedding = $1::vector, "atualizadoEm" = NOW()
          WHERE id = $2
        `, vetorString, id);
      }
    }

    // Atualizar dados comuns, remove embedding para não esbarrar no erro de "Unsupported" do Prisma Client
    delete updateData.embedding;

    if (Object.keys(updateData).length > 0) {
      await prisma.conhecimentoCurado.update({
        where: { id },
        data: updateData,
      });
    }

    console.log(`[CONHECIMENTO CURADO] ✅ Atualizado: ${id}`);
  }

  /**
   * Remove conhecimento (soft delete)
   */
  async remover(id: string): Promise<void> {
    await prisma.conhecimentoCurado.update({
      where: { id },
      data: { ativo: false },
    });

    console.log(`[CONHECIMENTO CURADO] ❌ Removido: ${id}`);
  }
}

export const conhecimentoCuradoService = new ConhecimentoCuradoService();
