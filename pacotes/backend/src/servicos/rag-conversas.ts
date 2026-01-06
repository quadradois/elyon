/**
 * RAG DE CONVERSAS
 * 
 * Serviço responsável por:
 * 1. Processar conversas finalizadas e extrair conhecimento
 * 2. Gerar embeddings de chunks relevantes
 * 3. Buscar contexto de conversas similares para melhorar respostas
 * 
 * Tipos de conhecimento extraído:
 * - Objeções superadas com sucesso
 * - Perguntas frequentes e respostas eficazes
 * - Padrões de qualificação de leads
 * - Intenções e necessidades dos clientes
 * 
 * NOTA: Usa Claude Haiku 4.5 para extração de conhecimento (mais econômico)
 */

import { prisma } from '../lib/db';
import { embeddingService } from './embeddings';
import { openaiService } from './openai';

export interface ChunkConversa {
  texto: string;
  tipo: 'resumo_conversa' | 'intencao_lead' | 'objecao_superada' | 'pergunta_frequente' | 'script_eficaz';
  metadados: {
    conversaId?: string;
    leadId?: string;
    temperatura?: string;
    resultado?: string;
    scoreQualidade?: number;
  };
}

export interface ResultadoBuscaRAG {
  chunks: Array<{
    texto: string;
    tipo: string;
    similaridade: number;
    metadados: any;
  }>;
  contextoFormatado: string;
}

class RAGConversasService {
  private readonly LIMIAR_SIMILARIDADE = 0.7;
  private readonly MAX_CHUNKS_RETORNADOS = 5;

  /**
   * Processa uma conversa finalizada e extrai conhecimento para RAG
   */
  async processarConversaFinalizada(conversaId: string): Promise<void> {
    console.log(`[RAG] 📚 Processando conversa ${conversaId} para RAG`);

    try {
      // 1. Buscar conversa com mensagens
      const conversa = await prisma.conversa.findUnique({
        where: { id: conversaId },
        include: {
          mensagens: {
            orderBy: { enviadaEm: 'asc' }
          },
          lead: {
            include: { tenant: true }
          }
        }
      });

      if (!conversa || conversa.mensagens.length < 3) {
        console.log(`[RAG] ⏭️  Conversa muito curta, pulando`);
        return;
      }

      // 2. Formatar histórico para análise
      const historicoTexto = conversa.mensagens
        .map((m: any) => `${m.remetente === 'usuario' ? 'Cliente' : 'Agente'}: ${m.conteudo}`)
        .join('\n');

      // 3. Extrair chunks de conhecimento usando IA
      const chunks = await this.extrairChunks(historicoTexto, conversa.lead);

      console.log(`[RAG] 📝 Extraídos ${chunks.length} chunks da conversa`);

      // 4. Gerar embeddings e salvar
      for (const chunk of chunks) {
        await this.salvarChunk(chunk, conversa.lead.tenantId, conversaId, conversa.leadId);
      }

      console.log(`[RAG] ✅ Conversa processada e indexada com sucesso`);

    } catch (error) {
      console.error('[RAG] ❌ Erro ao processar conversa:', error);
    }
  }

  /**
   * Extrai chunks de conhecimento de uma conversa usando IA (Claude Haiku 4.5)
   */
  private async extrairChunks(historicoTexto: string, lead: any): Promise<ChunkConversa[]> {
    const prompt = `Analise esta conversa de um agente imobiliário com um cliente e extraia conhecimento reutilizável.

CONVERSA:
${historicoTexto}

INSTRUÇÕES:
Extraia APENAS chunks que seriam úteis para futuras conversas similares:
1. Se houve uma objeção que foi bem superada, extraia a técnica usada
2. Se o cliente fez uma pergunta frequente, extraia pergunta e resposta eficaz
3. Se o agente usou um script que funcionou bem, extraia o padrão
4. Extraia a intenção principal do cliente se ficou clara

Retorne um JSON array com os chunks:
[
  {
    "tipo": "objecao_superada" | "pergunta_frequente" | "script_eficaz" | "intencao_lead",
    "texto": "descrição resumida do conhecimento extraído",
    "scoreQualidade": 0-100
  }
]

Se não houver conhecimento útil para extrair, retorne array vazio: []

IMPORTANTE: Seja seletivo. Extraia APENAS insights realmente úteis e de alta qualidade.`;

    try {
      const resposta = await openaiService.gerarResposta(
        [
          { role: 'system', content: 'Você é um especialista em análise de conversas. Responda apenas com um JSON válido.' },
          { role: 'user', content: prompt }
        ],
        {
          model: 'gpt-4o',
          maxTokens: 1000,
          temperature: 0.3,
          json: true
        }
      );

      // Limpar blocos de código markdown se houver (ex: ```json ... ```)
      const limpo = resposta.replace(/```json/g, '').replace(/```/g, '').trim();

      // Extrair JSON da resposta
      const jsonMatch = limpo.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const chunksRaw = JSON.parse(jsonMatch[0]);

      return chunksRaw
        .filter((c: any) => c.scoreQualidade >= 60) // Filtrar chunks de baixa qualidade
        .map((c: any) => ({
          texto: c.texto,
          tipo: c.tipo,
          metadados: {
            leadId: lead.id,
            temperatura: lead.temperatura,
            resultado: lead.status,
            scoreQualidade: c.scoreQualidade
          }
        }));

    } catch (error) {
      console.error('[RAG] Erro ao extrair chunks:', error);
      return [];
    }
  }

  /**
   * Salva um chunk no banco com seu embedding
   */
  private async salvarChunk(
    chunk: ChunkConversa,
    tenantId: string,
    conversaId: string,
    leadId: string
  ): Promise<void> {
    try {
      // Gerar embedding
      const textoPreparado = embeddingService.prepararTexto(chunk.texto);
      const vetorEmbedding = await embeddingService.gerar(textoPreparado);
      const embeddingString = embeddingService.serializar(vetorEmbedding);

      // Salvar no banco
      await prisma.conversaEmbedding.create({
        data: {
          tenantId,
          conversaId,
          leadId,
          textoOriginal: chunk.texto,
          tipoConteudo: chunk.tipo,
          metadados: chunk.metadados,
          embedding: embeddingString,
          scoreQualidade: chunk.metadados.scoreQualidade || 0
        }
      });

    } catch (error) {
      console.error('[RAG] Erro ao salvar chunk:', error);
    }
  }

  /**
   * Busca contexto relevante de conversas anteriores
   */
  async buscarContextoRelevante(
    tenantId: string,
    mensagemAtual: string,
    tiposDesejados?: string[]
  ): Promise<ResultadoBuscaRAG> {
    console.log(`[RAG] 🔍 Buscando contexto para: "${mensagemAtual.substring(0, 50)}..."`);

    try {
      // 1. Gerar embedding da mensagem atual
      const textoPreparado = embeddingService.prepararTexto(mensagemAtual);
      const vetorBusca = await embeddingService.gerar(textoPreparado);

      // 2. Buscar chunks do tenant
      const whereClause: any = { tenantId };
      if (tiposDesejados && tiposDesejados.length > 0) {
        whereClause.tipoConteudo = { in: tiposDesejados };
      }

      const chunksDb = await prisma.conversaEmbedding.findMany({
        where: whereClause,
        orderBy: { scoreQualidade: 'desc' },
        take: 50 // Pegar os melhores 50 para filtrar por similaridade
      });

      if (chunksDb.length === 0) {
        return { chunks: [], contextoFormatado: '' };
      }

      // 3. Calcular similaridade e ordenar
      type ChunkComSimilaridade = typeof chunksDb[0] & { similaridade: number };
      const chunksComSimilaridade: ChunkComSimilaridade[] = chunksDb.map((chunk: any) => {
        const vetorChunk = embeddingService.desserializar(chunk.embedding);
        const similaridade = embeddingService.calcularSimilaridade(vetorBusca, vetorChunk);
        return {
          ...chunk,
          similaridade
        };
      });

      // 4. Filtrar por limiar e pegar os melhores
      const chunksRelevantes = chunksComSimilaridade
        .filter((c: ChunkComSimilaridade) => c.similaridade >= this.LIMIAR_SIMILARIDADE)
        .sort((a: ChunkComSimilaridade, b: ChunkComSimilaridade) => b.similaridade - a.similaridade)
        .slice(0, this.MAX_CHUNKS_RETORNADOS);

      // 5. Atualizar contador de uso
      for (const chunk of chunksRelevantes) {
        await prisma.conversaEmbedding.update({
          where: { id: chunk.id },
          data: { vezesUtilizado: { increment: 1 } }
        });
      }

      // 6. Formatar contexto para o prompt
      const contextoFormatado = this.formatarContexto(chunksRelevantes);

      console.log(`[RAG] ✅ Encontrados ${chunksRelevantes.length} chunks relevantes`);

      return {
        chunks: chunksRelevantes.map((c: any) => ({
          texto: c.textoOriginal,
          tipo: c.tipoConteudo,
          similaridade: c.similaridade,
          metadados: c.metadados
        })),
        contextoFormatado
      };

    } catch (error) {
      console.error('[RAG] ❌ Erro na busca:', error);
      return { chunks: [], contextoFormatado: '' };
    }
  }

  /**
   * Formata chunks encontrados em texto para o prompt do agente
   */
  private formatarContexto(chunks: any[]): string {
    if (chunks.length === 0) return '';

    const partes: string[] = ['### Conhecimento de Conversas Anteriores ###\n'];

    for (const chunk of chunks) {
      const tipoLabel = this.getTipoLabel(chunk.tipoConteudo);
      partes.push(`[${tipoLabel}] ${chunk.textoOriginal}\n`);
    }

    return partes.join('\n');
  }

  private getTipoLabel(tipo: string): string {
    const labels: Record<string, string> = {
      'objecao_superada': '💡 Objeção superada',
      'pergunta_frequente': '❓ Pergunta frequente',
      'script_eficaz': '📜 Script eficaz',
      'intencao_lead': '🎯 Intenção típica'
    };
    return labels[tipo] || tipo;
  }

  /**
   * Registra feedback sobre um chunk (se foi útil ou não)
   */
  async registrarFeedback(chunkId: string, positivo: boolean): Promise<void> {
    try {
      const campo = positivo ? 'feedbackPositivo' : 'feedbackNegativo';
      await prisma.conversaEmbedding.update({
        where: { id: chunkId },
        data: { [campo]: { increment: 1 } }
      });
    } catch (error) {
      console.error('[RAG] Erro ao registrar feedback:', error);
    }
  }

  /**
   * Processa conversas finalizadas em lote (para job noturno)
   */
  async processarConversasPendentes(limite: number = 100): Promise<number> {
    console.log(`[RAG] 🔄 Iniciando processamento em lote (limite: ${limite})`);

    try {
      // Buscar conversas finalizadas ainda não processadas
      const conversas = await prisma.conversa.findMany({
        where: {
          estadoConversa: 'finalizada',
          // Não existe embedding para esta conversa
          NOT: {
            id: {
              in: (await prisma.conversaEmbedding.findMany({
                select: { conversaId: true },
                where: { conversaId: { not: null } }
              })).map((e: any) => e.conversaId).filter(Boolean)
            }
          }
        },
        take: limite,
        orderBy: { finalizadaEm: 'desc' }
      });

      console.log(`[RAG] 📋 Encontradas ${conversas.length} conversas para processar`);

      let processadas = 0;
      for (const conversa of conversas) {
        await this.processarConversaFinalizada(conversa.id);
        processadas++;
      }

      console.log(`[RAG] ✅ Processamento em lote concluído: ${processadas} conversas`);
      return processadas;

    } catch (error) {
      console.error('[RAG] ❌ Erro no processamento em lote:', error);
      return 0;
    }
  }

  /**
   * Estatísticas do RAG de conversas
   */
  async obterEstatisticas(tenantId: string): Promise<{
    totalChunks: number;
    chunksPorTipo: Record<string, number>;
    mediaQualidade: number;
    maisUtilizados: Array<{ texto: string; vezesUtilizado: number }>;
  }> {
    const chunks = await prisma.conversaEmbedding.findMany({
      where: { tenantId },
      select: {
        tipoConteudo: true,
        scoreQualidade: true,
        vezesUtilizado: true,
        textoOriginal: true
      }
    });

    const chunksPorTipo: Record<string, number> = {};
    let somaQualidade = 0;

    for (const chunk of chunks) {
      chunksPorTipo[chunk.tipoConteudo] = (chunksPorTipo[chunk.tipoConteudo] || 0) + 1;
      somaQualidade += Number(chunk.scoreQualidade);
    }

    const maisUtilizados = chunks
      .sort((a: any, b: any) => b.vezesUtilizado - a.vezesUtilizado)
      .slice(0, 5)
      .map((c: any) => ({
        texto: c.textoOriginal.substring(0, 100),
        vezesUtilizado: c.vezesUtilizado
      }));

    return {
      totalChunks: chunks.length,
      chunksPorTipo,
      mediaQualidade: chunks.length > 0 ? somaQualidade / chunks.length : 0,
      maisUtilizados
    };
  }

  // ============================================
  // RAG PARA PROSPECÇÃO ATIVA (MVP)
  // ============================================

  /**
   * Processa uma conversa de prospecção que CONVERTEU
   * Chamado quando: agendar_avaliacao ou converter_para_lead
   * 
   * MVP: Apenas conversões para aprender com sucesso
   * Futuro: Expandir para engajamentos longos
   */
  async processarConversaoProspeccao(params: {
    contatoId: string;
    tenantId: string;
    tipoConversao: 'AGENDAMENTO' | 'LEAD' | 'INTERESSE';
    empreendimento?: string;
  }): Promise<void> {
    const { contatoId, tenantId, tipoConversao, empreendimento } = params;

    console.log(`[RAG-Prospecção] 📚 Processando conversão: ${tipoConversao} (contato: ${contatoId})`);

    try {
      // 1. Buscar mensagens da conversa de prospecção
      const mensagens = await prisma.mensagemProspeccao.findMany({
        where: { contatoId },
        orderBy: { dataHora: 'asc' }
      });

      if (mensagens.length < 4) {
        console.log(`[RAG-Prospecção] ⏭️ Conversa muito curta (${mensagens.length} msgs), pulando`);
        return;
      }

      // 2. Buscar dados do contato
      const contato = await prisma.contato.findUnique({
        where: { id: contatoId },
        include: {
          campanha: {
            include: { empreendimento: true }
          }
        }
      });

      // 3. Formatar histórico para análise
      const historicoTexto = mensagens
        .map((m: any) => `${m.direcao === 'ENTRADA' ? 'Cliente' : 'Agente'}: ${m.conteudo}`)
        .join('\n');

      // 4. Extrair chunks com contexto de prospecção
      const chunks = await this.extrairChunksProspeccao(
        historicoTexto,
        tipoConversao,
        empreendimento || (contato?.campanha?.empreendimento as any)?.nome || 'Empreendimento'
      );

      console.log(`[RAG-Prospecção] 📝 Extraídos ${chunks.length} chunks da conversão`);

      // 5. Salvar chunks com embedding
      for (const chunk of chunks) {
        await this.salvarChunkProspeccao(chunk, tenantId, contatoId);
      }

      console.log(`[RAG-Prospecção] ✅ Conversão processada e indexada com sucesso`);

    } catch (error) {
      console.error('[RAG-Prospecção] ❌ Erro ao processar conversão:', error);
    }
  }

  /**
   * Extrai chunks específicos de conversas de prospecção
   */
  private async extrairChunksProspeccao(
    historicoTexto: string,
    tipoConversao: string,
    empreendimento: string
  ): Promise<ChunkConversa[]> {
    const prompt = `Analise esta conversa de PROSPECÇÃO ATIVA imobiliária que resultou em ${tipoConversao}.
O agente estava captando imóveis no empreendimento: ${empreendimento}

CONVERSA:
${historicoTexto}

INSTRUÇÕES:
Esta foi uma conversa de SUCESSO (converteu). Extraia conhecimento para replicar:

1. **Scripts que funcionaram**: Frases do agente que geraram resposta positiva
2. **Objeções superadas**: Como o agente contornou resistências
3. **Gatilhos de interesse**: O que fez o cliente demonstrar interesse
4. **Técnicas de fechamento**: Como o agente chegou ao agendamento/conversão

Retorne JSON array:
[
  {
    "tipo": "script_eficaz" | "objecao_superada" | "gatilho_interesse" | "tecnica_fechamento",
    "texto": "descrição clara e reutilizável do aprendizado",
    "contexto": "situação em que usar",
    "scoreQualidade": 0-100
  }
]

IMPORTANTE: 
- Extraia APENAS insights de ALTA qualidade e reutilizáveis
- Foque em técnicas que podem ser replicadas
- Se não houver insights úteis, retorne array vazio: []`;

    try {
      const resposta = await openaiService.gerarResposta(
          [
            { role: 'system', content: 'Você é um especialista em vendas imobiliárias. Responda apenas com um JSON válido.' },
            { role: 'user', content: prompt }
          ],
          {
            model: 'gpt-4o',
            maxTokens: 1000,
            temperature: 0.3,
            json: true
          }
        );

        // Limpar blocos de código markdown
        const limpo = resposta.replace(/```json/g, '').replace(/```/g, '').trim();

        // Extrair JSON da resposta
        const jsonMatch = limpo.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          return [];
        }

        const chunksRaw = JSON.parse(jsonMatch[0]);

        return chunksRaw
          .filter((c: any) => c.scoreQualidade >= 70) // Filtro mais alto para prospecção
          .map((c: any) => ({
            texto: `[${c.tipo.toUpperCase()}] ${c.texto}${c.contexto ? ` (Usar quando: ${c.contexto})` : ''}`,
            tipo: c.tipo as any,
            metadados: {
              resultado: tipoConversao,
              empreendimento,
              scoreQualidade: c.scoreQualidade,
              fonte: 'prospeccao_ativa'
            }
          }));

      } catch (error) {
        console.error('[RAG-Prospecção] Erro ao extrair chunks:', error);
        return [];
      }
    }

  /**
   * Salva chunk de prospecção com embedding
   */
  private async salvarChunkProspeccao(
      chunk: ChunkConversa,
      tenantId: string,
      contatoId: string
    ): Promise<void> {
    try {
      // Gerar embedding
      const textoPreparado = embeddingService.prepararTexto(chunk.texto);
      const vetorEmbedding = await embeddingService.gerar(textoPreparado);
      const embeddingString = embeddingService.serializar(vetorEmbedding);

      // Salvar no banco (usando conversaId para guardar contatoId)
      await prisma.conversaEmbedding.create({
        data: {
          tenantId,
          conversaId: contatoId, // Reutilizando campo para contatoId
          textoOriginal: chunk.texto,
          tipoConteudo: chunk.tipo,
          metadados: chunk.metadados,
          embedding: embeddingString,
          scoreQualidade: chunk.metadados.scoreQualidade || 0
        }
      });

    } catch (error) {
      console.error('[RAG-Prospecção] Erro ao salvar chunk:', error);
    }
  }
}

export const ragConversasService = new RAGConversasService();
