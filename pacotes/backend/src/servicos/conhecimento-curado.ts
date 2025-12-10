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
    
    // Gerar embedding do texto + contexto
    const textoParaEmbedding = `${input.titulo}. ${input.texto}. Usar quando: ${input.contextoUso}`;
    const embedding = await embeddingService.gerar(textoParaEmbedding);
    
    const conhecimento = await prisma.conhecimentoCurado.create({
      data: {
        categoria: input.categoria,
        subcategoria: input.subcategoria,
        titulo: input.titulo,
        texto: input.texto,
        contextoUso: input.contextoUso,
        exemplo: input.exemplo,
        tipoImovel: input.tipoImovel || [],
        faixaPreco: input.faixaPreco,
        tipoNegocio: input.tipoNegocio || [],
        scoreEficacia: input.scoreEficacia || 80,
        fonte: input.fonte || 'manual',
        criadoPor: input.criadoPor,
        embedding: JSON.stringify(embedding),
      },
    });
    
    console.log(`[CONHECIMENTO CURADO] ✅ Adicionado com ID: ${conhecimento.id}`);
    return conhecimento.id;
  }

  /**
   * Busca conhecimento curado por similaridade semântica
   */
  async buscar(params: BuscaConhecimentoParams): Promise<ConhecimentoEncontrado[]> {
    const { query, categoria, tipoImovel, faixaPreco, tipoNegocio, limite = 5 } = params;
    
    // Gerar embedding da query
    const queryEmbedding = await embeddingService.gerar(query);
    
    // Buscar todos os conhecimentos ativos
    const whereClause: any = { ativo: true };
    if (categoria) whereClause.categoria = categoria;
    
    const conhecimentos = await prisma.conhecimentoCurado.findMany({
      where: whereClause,
      select: {
        id: true,
        categoria: true,
        subcategoria: true,
        titulo: true,
        texto: true,
        contextoUso: true,
        exemplo: true,
        tipoImovel: true,
        faixaPreco: true,
        tipoNegocio: true,
        scoreEficacia: true,
        embedding: true,
      },
    });
    
    // Calcular similaridade e filtrar
    const resultados: ConhecimentoEncontrado[] = [];
    
    for (const conhecimento of conhecimentos) {
      if (!conhecimento.embedding) continue;
      
      // Verificar filtros de aplicabilidade
      if (tipoImovel && conhecimento.tipoImovel.length > 0) {
        if (!conhecimento.tipoImovel.includes(tipoImovel)) continue;
      }
      if (faixaPreco && conhecimento.faixaPreco) {
        if (conhecimento.faixaPreco !== faixaPreco) continue;
      }
      if (tipoNegocio && conhecimento.tipoNegocio.length > 0) {
        if (!conhecimento.tipoNegocio.includes(tipoNegocio)) continue;
      }
      
      const embedding = JSON.parse(conhecimento.embedding);
      const similaridade = this.calcularSimilaridade(queryEmbedding, embedding);
      
      if (similaridade > 0.3) { // Threshold mínimo
        resultados.push({
          id: conhecimento.id,
          categoria: conhecimento.categoria,
          titulo: conhecimento.titulo,
          texto: conhecimento.texto,
          contextoUso: conhecimento.contextoUso,
          exemplo: conhecimento.exemplo || undefined,
          scoreEficacia: Number(conhecimento.scoreEficacia),
          similaridade,
        });
      }
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
    const embeddings = await prisma.conversaEmbedding.findMany({
      where: {
        tenantId,
        scoreQualidade: { gte: 70 }, // Só alta qualidade
      },
      select: {
        id: true,
        tipoConteudo: true,
        textoOriginal: true,
        metadados: true,
        embedding: true,
        scoreQualidade: true,
      },
    });
    
    const resultados: ConhecimentoEncontrado[] = [];
    
    for (const emb of embeddings) {
      const embedding = JSON.parse(emb.embedding);
      const similaridade = this.calcularSimilaridade(queryEmbedding, embedding);
      
      if (similaridade > 0.4) {
        const metadados = emb.metadados as any || {};
        resultados.push({
          id: emb.id,
          categoria: emb.tipoConteudo,
          titulo: metadados.titulo || emb.tipoConteudo,
          texto: emb.textoOriginal,
          contextoUso: metadados.contexto || 'Aprendido de conversa real',
          scoreEficacia: Number(emb.scoreQualidade),
          similaridade,
        });
      }
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
        updateData.embedding = JSON.stringify(embedding);
      }
    }
    
    await prisma.conhecimentoCurado.update({
      where: { id },
      data: updateData,
    });
    
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
