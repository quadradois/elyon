/**
 * ROTAS DE SANDBOX / CHAT DE TESTE
 * 
 * Permite testar agentes antes de ativá-los.
 * Simula conversas sem enviar para WhatsApp real.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import {
  CATALOGO_AGENTES,
  gerarSystemPrompt,
  TipoAgente
} from '../agentes/templates-agentes';
import { openaiService } from '../servicos/openai';

const router = Router();

// ============================================
// SCHEMAS DE VALIDAÇÃO
// ============================================

const IniciarSandboxSchema = z.object({
  agenteId: z.string().uuid().optional(),
  tipoAgente: z.enum(['SDR_VENDAS', 'SDR_LOCACAO', 'SDR_CAPTACAO', 'DOCUMENTOS', 'SDR_V2_BETA']).optional(),
  personalizacao: z.object({
    nome: z.string().min(2),
    nomeImobiliaria: z.string().min(2),
    tom: z.enum(['formal', 'equilibrado', 'descontraido']).default('equilibrado'),
    usarEmojis: z.boolean().default(true),
    bairros: z.array(z.string()).optional(),
    tiposImovel: z.array(z.string()).optional(),
    diferenciais: z.array(z.string()).optional()
  }).optional()
});

const EnviarMensagemSchema = z.object({
  sessaoId: z.string(),
  mensagem: z.string().min(1).max(1000)
});

// ============================================
// ARMAZENAMENTO DE SESSÕES (In-Memory)
// ============================================

interface SessaoSandbox {
  id: string;
  tenantId: string;
  tipoAgente: TipoAgente;
  systemPrompt: string;
  historico: Array<{ role: 'user' | 'assistant'; content: string }>;
  criadaEm: Date;
  ultimaInteracaoEm: Date;
  personalizacao: any;
}

const sessoes = new Map<string, SessaoSandbox>();

// Limpar sessões antigas a cada 30 minutos
setInterval(() => {
  const agora = Date.now();
  const limiteMs = 30 * 60 * 1000; // 30 minutos

  for (const [id, sessao] of sessoes.entries()) {
    if (agora - sessao.ultimaInteracaoEm.getTime() > limiteMs) {
      sessoes.delete(id);
      console.log(`[SANDBOX] Sessão ${id} expirada e removida`);
    }
  }
}, 30 * 60 * 1000);

// ============================================
// ROTAS
// ============================================

/**
 * GET /api/sandbox/tipos
 * Lista tipos de agentes disponíveis para teste
 */
router.get('/tipos', async (_req: Request, res: Response) => {
  try {
    const tipos = Object.values(CATALOGO_AGENTES).map(template => ({
      tipo: template.tipo,
      icone: template.icone,
      titulo: template.titulo,
      descricao: template.descricao,
      corTema: template.corTema,
      defaultNome: template.defaultsPersonalizacao.nome
    }));

    res.json({ tipos });
  } catch (error: any) {
    console.error('[SANDBOX] Erro ao listar tipos:', error);
    res.status(500).json({ erro: 'Erro ao listar tipos de agentes' });
  }
});

/**
 * POST /api/sandbox/iniciar
 * Inicia uma nova sessão de teste
 */
router.post('/iniciar', async (req: Request, res: Response) => {
  try {
    const dados = IniciarSandboxSchema.parse(req.body);
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autenticado' });
    }

    let tipoAgente: TipoAgente;
    let personalizacao: any;

    // Opção 1: Testar agente existente
    if (dados.agenteId) {
      const agente = await prisma.configuracaoAgente.findFirst({
        where: {
          id: dados.agenteId,
          tenantId
        },
        include: { tenant: true }
      });

      if (!agente) {
        return res.status(404).json({ erro: 'Agente não encontrado' });
      }

      // Usar tipoAgente se existir, senão inferir como SDR_VENDAS
      tipoAgente = ((agente as any).tipoAgente || 'SDR_VENDAS') as TipoAgente;
      personalizacao = {
        nome: agente.nome,
        nomeImobiliaria: agente.tenant.nome,
        tom: (agente.personalidade as any)?.tom || 'equilibrado',
        usarEmojis: (agente.personalidade as any)?.usarEmojis ?? true,
        bairros: (agente.expertise as any)?.bairros || [],
        tiposImovel: (agente.expertise as any)?.tiposImovel || [],
        diferenciais: (agente.expertise as any)?.diferenciais || []
      };
    }
    // Opção 2: Testar com personalização custom
    else if (dados.tipoAgente && dados.personalizacao) {
      tipoAgente = dados.tipoAgente as TipoAgente;
      personalizacao = dados.personalizacao;
    }
    else {
      return res.status(400).json({
        erro: 'Informe agenteId ou (tipoAgente + personalizacao)'
      });
    }

    // Gerar system prompt
    const systemPrompt = gerarSystemPrompt(tipoAgente, personalizacao);

    // Criar sessão
    const sessaoId = `sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const sessao: SessaoSandbox = {
      id: sessaoId,
      tenantId,
      tipoAgente,
      systemPrompt,
      historico: [],
      criadaEm: new Date(),
      ultimaInteracaoEm: new Date(),
      personalizacao
    };

    sessoes.set(sessaoId, sessao);

    // Gerar saudação inicial
    const template = CATALOGO_AGENTES[tipoAgente];
    let saudacao = template.defaultsPersonalizacao.saudacao;
    saudacao = saudacao.replace('{nome}', personalizacao.nome);
    saudacao = saudacao.replace('{imobiliaria}', personalizacao.nomeImobiliaria);

    // Adicionar ao histórico
    sessao.historico.push({ role: 'assistant', content: saudacao });

    console.log(`[SANDBOX] Nova sessão iniciada: ${sessaoId} (${tipoAgente})`);

    res.json({
      sessaoId,
      tipoAgente,
      nomeAgente: personalizacao.nome,
      saudacao,
      mensagem: 'Sessão de teste iniciada com sucesso'
    });

  } catch (error: any) {
    console.error('[SANDBOX] Erro ao iniciar:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        erro: 'Dados inválidos',
        detalhes: error.errors
      });
    }

    res.status(500).json({ erro: 'Erro ao iniciar sessão de teste' });
  }
});

/**
 * POST /api/sandbox/mensagem
 * Envia mensagem para o agente no sandbox
 */
router.post('/mensagem', async (req: Request, res: Response) => {
  try {
    const dados = EnviarMensagemSchema.parse(req.body);
    const tenantId = (req as any).tenantId;

    // Buscar sessão
    const sessao = sessoes.get(dados.sessaoId);

    if (!sessao) {
      return res.status(404).json({ erro: 'Sessão não encontrada ou expirada' });
    }

    if (sessao.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Sessão não pertence a este tenant' });
    }

    // Adicionar mensagem do usuário ao histórico
    sessao.historico.push({ role: 'user', content: dados.mensagem });
    sessao.ultimaInteracaoEm = new Date();

    // Gerar resposta do agente
    let resposta: string;

    if (sessao.tipoAgente === 'SDR_V2_BETA' as any) {
      const { agenteV2 } = await import('../agentes/agente-v2');
      resposta = await agenteV2.processarMensagem(
        sessao.historico,
        dados.mensagem,
        sessao.systemPrompt // <--- Passando o prompt compilado (RAG + Prompt)
      );
    } else {
      const mensagensOpenAI = [
        { role: 'system' as const, content: sessao.systemPrompt },
        ...sessao.historico.map(h => ({
          role: h.role as 'user' | 'assistant',
          content: h.content
        }))
      ];

      resposta = await openaiService.gerarResposta(mensagensOpenAI);
    }

    // Adicionar resposta ao histórico
    sessao.historico.push({ role: 'assistant', content: resposta });

    console.log(`[SANDBOX] ${dados.sessaoId}: "${dados.mensagem.substring(0, 50)}..." → "${resposta.substring(0, 50)}..."`);

    res.json({
      resposta,
      historicoTamanho: sessao.historico.length,
      sessaoId: dados.sessaoId
    });

  } catch (error: any) {
    console.error('[SANDBOX] Erro ao processar mensagem:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        erro: 'Dados inválidos',
        detalhes: error.errors
      });
    }

    res.status(500).json({ erro: 'Erro ao processar mensagem' });
  }
});

/**
 * GET /api/sandbox/:sessaoId
 * Retorna histórico da sessão
 */
router.get('/:sessaoId', async (req: Request, res: Response) => {
  try {
    const { sessaoId } = req.params;
    const tenantId = (req as any).tenantId;

    const sessao = sessoes.get(sessaoId);

    if (!sessao) {
      return res.status(404).json({ erro: 'Sessão não encontrada ou expirada' });
    }

    if (sessao.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Sessão não pertence a este tenant' });
    }

    res.json({
      sessaoId: sessao.id,
      tipoAgente: sessao.tipoAgente,
      nomeAgente: sessao.personalizacao.nome,
      historico: sessao.historico,
      criadaEm: sessao.criadaEm,
      ultimaInteracaoEm: sessao.ultimaInteracaoEm
    });

  } catch (error: any) {
    console.error('[SANDBOX] Erro ao buscar sessão:', error);
    res.status(500).json({ erro: 'Erro ao buscar sessão' });
  }
});

/**
 * DELETE /api/sandbox/:sessaoId
 * Encerra uma sessão de teste
 */
router.delete('/:sessaoId', async (req: Request, res: Response) => {
  try {
    const { sessaoId } = req.params;
    const tenantId = (req as any).tenantId;

    const sessao = sessoes.get(sessaoId);

    if (!sessao) {
      return res.status(404).json({ erro: 'Sessão não encontrada' });
    }

    if (sessao.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Sessão não pertence a este tenant' });
    }

    sessoes.delete(sessaoId);

    console.log(`[SANDBOX] Sessão ${sessaoId} encerrada manualmente`);

    res.json({
      mensagem: 'Sessão encerrada com sucesso',
      totalMensagens: sessao.historico.length
    });

  } catch (error: any) {
    console.error('[SANDBOX] Erro ao encerrar sessão:', error);
    res.status(500).json({ erro: 'Erro ao encerrar sessão' });
  }
});

/**
 * POST /api/sandbox/:sessaoId/avaliar
 * Registra feedback sobre o teste
 */
router.post('/:sessaoId/avaliar', async (req: Request, res: Response) => {
  try {
    const { sessaoId } = req.params;
    const { nota, comentario } = req.body;
    const tenantId = (req as any).tenantId;

    const sessao = sessoes.get(sessaoId);

    if (!sessao) {
      return res.status(404).json({ erro: 'Sessão não encontrada' });
    }

    if (sessao.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Sessão não pertence a este tenant' });
    }

    // TODO: Salvar avaliação no banco para métricas
    console.log(`[SANDBOX] Avaliação sessão ${sessaoId}: ${nota}/5 - ${comentario || 'Sem comentário'}`);

    res.json({
      mensagem: 'Avaliação registrada com sucesso',
      nota,
      comentario
    });

  } catch (error: any) {
    console.error('[SANDBOX] Erro ao registrar avaliação:', error);
    res.status(500).json({ erro: 'Erro ao registrar avaliação' });
  }
});

export default router;
