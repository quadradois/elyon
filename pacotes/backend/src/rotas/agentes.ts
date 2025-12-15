import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { sintetizarPerfilRAG } from '../utilitarios/sintetizarPerfil';

// Tipo completo do ConfiguracaoAgente para forçar o TS a usar o modelo atualizado
type ConfiguracaoAgenteCompleto = {
  id: string;
  tenantId: string;
  tipoAgente: string;
  modoCreacao: string;
  templateBase: string | null;
  nome: string;
  avatar: string | null;
  genero: string;
  personalidade: Prisma.JsonValue;
  expertise: Prisma.JsonValue;
  scripts: Prisma.JsonValue;
  regrasNegocio: Prisma.JsonValue;
  perfilImobiliaria: Prisma.JsonValue | null;
  ragPerfilTexto: string | null;
  promptCustomizado: string | null;
  toolsCustomizadas: Prisma.JsonValue | null;
  status: string;
  estaAtivo: boolean;
  termosAceitos: boolean;
  termosAceitosEm: Date | null;
  termosVersao: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

const router = Router();

// ====================================
// ENUMS (espelham o Prisma)
// ====================================

const TipoAgenteEnum = z.enum([
  'SDR_VENDAS',
  'SDR_LOCACAO',
  'SDR_CAPTACAO',
  'DOCUMENTOS',
  'PERSONALIZADO'
]);

const ModoCriacaoEnum = z.enum([
  'PRE_TREINADO',
  'PERSONALIZADO'
]);

const StatusAgenteEnum = z.enum([
  'RASCUNHO',
  'ATIVO',
  'PAUSADO'
]);

// ====================================
// SCHEMAS DE VALIDAÇÃO
// ====================================

const PersonalidadeSchema = z.object({
  tom: z.enum(['formal', 'amigavel', 'entusiasta']).default('amigavel'),
  usarEmojis: z.boolean().default(true),
  nivelFormalidade: z.number().min(1).max(5).default(3),
});

const ExpertiseSchema = z.object({
  bairros: z.array(z.string()).default([]),
  tiposImovel: z.array(z.string()).default([]),
  faixaPreco: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
});

const ScriptsSchema = z.object({
  saudacao: z.string().default('Olá! Como posso ajudar você hoje?'),
  despedida: z.string().default('Foi um prazer ajudar! Até logo!'),
  ausencia: z.string().default('No momento estou indisponível, mas retorno em breve.'),
  transferencia: z.string().default('Vou transferir você para um de nossos especialistas.'),
});

const RegrasNegocioSchema = z.object({
  horarioAtendimento: z.object({
    inicio: z.string().default('08:00'),
    fim: z.string().default('18:00'),
  }).optional(),
  diasAtendimento: z.array(z.string()).default(['seg', 'ter', 'qua', 'qui', 'sex']),
  tempoMaximoResposta: z.number().default(60), // segundos
  transferirApos: z.number().default(3), // número de mensagens sem qualificação
});

// Schema para Perfil da Imobiliária (Quiz)
const PerfilLocacaoSchema = z.object({
  garantiasAceitas: z.array(z.string()).default(['FIADOR', 'SEGURO_FIANCA']),
  taxaAdministracao: z.number().min(0).max(20).default(10),
  taxaPrimeiroAluguel: z.boolean().default(true),
  prazoMinimoContrato: z.number().min(6).max(36).default(12),
  aceitaPet: z.boolean().default(true),
  fazVistoriaEntrada: z.boolean().default(true),
  fazVistoriaSaida: z.boolean().default(true),
  tempoMedioContrato: z.number().default(30),
  observacoesLocacao: z.string().optional(),
});

const PerfilVendaSchema = z.object({
  comissaoPadrao: z.number().min(1).max(10).default(6),
  aceitaExclusividade: z.boolean().default(true),
  tempoExclusividade: z.number().min(30).max(180).optional(),
  fazAvaliacaoGratuita: z.boolean().default(true),
  fazFotoProfissional: z.boolean().default(true),
  fazTourVirtual: z.boolean().default(false),
  anunciaPortais: z.array(z.string()).default(['ZAP Imóveis', 'Viva Real']),
  temParcerias: z.boolean().default(true),
  percentualParceria: z.number().min(20).max(80).optional(),
  observacoesVenda: z.string().optional(),
});

const DadosGeraisImobiliariaSchema = z.object({
  nomeImobiliaria: z.string().default(''),
  diferenciais: z.array(z.string()).default([]),
  tempoMercado: z.number().optional(),
  atendeFinalDeSemana: z.boolean().default(false),
  horarioAtendimento: z.string().optional(),
  // Serviços oferecidos
  trabalhaComLocacao: z.boolean().default(true),
  trabalhaComVenda: z.boolean().default(true),
  // Informações de contato
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  site: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
});

const PerfilImobiliariaSchema = z.object({
  dadosGerais: DadosGeraisImobiliariaSchema.default({}),
  locacao: PerfilLocacaoSchema.default({}),
  venda: PerfilVendaSchema.default({}),
}).optional();

// Schema para Tools Customizadas (Modo Avançado)
const ToolCustomizadaSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().min(1),
  parametros: z.record(z.any()).optional(),
  acao: z.enum(['consultar_api', 'buscar_imovel', 'agendar_visita', 'calcular_financiamento', 'custom']),
});

// Schema base para criação de agente (Modo Rápido)
const CriarAgenteSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  avatar: z.string().optional().nullable(), // Aceita qualquer string, vazia ou null
  genero: z.enum(['feminino', 'masculino']).default('feminino'),
  tipoAgente: TipoAgenteEnum.default('SDR_CAPTACAO'),
  modoCreacao: ModoCriacaoEnum.default('PRE_TREINADO'),
  templateBase: z.string().optional(),
  personalidade: PersonalidadeSchema.optional().default({}),
  expertise: ExpertiseSchema.optional().default({}),
  scripts: ScriptsSchema.optional().default({}),
  regrasNegocio: RegrasNegocioSchema.optional().default({}),
  perfilImobiliaria: PerfilImobiliariaSchema,
  estaAtivo: z.boolean().default(false), // Começa desativado (RASCUNHO)
  termosAceitos: z.boolean().default(false),
  termosVersao: z.string().optional(),
  sessaoWhatsappId: z.string().optional().nullable(),
});

// Schema para Modo Avançado (100% customizado)
const CriarAgenteAvancadoSchema = CriarAgenteSchema.extend({
  modoCreacao: z.literal('PERSONALIZADO'),
  tipoAgente: z.literal('PERSONALIZADO'),
  promptCustomizado: z.string().min(50, 'Prompt deve ter pelo menos 50 caracteres'),
  toolsCustomizadas: z.array(ToolCustomizadaSchema).optional(),
  objetivo: z.string().min(10, 'Descreva o objetivo do agente'),
  contexto: z.string().optional(),
  restricoes: z.array(z.string()).optional(),
  termosAceitos: z.literal(true, {
    errorMap: () => ({ message: 'Você deve aceitar os termos para usar o Modo Avançado' })
  }),
});

const AtualizarAgenteSchema = CriarAgenteSchema.partial();

// Schema para mudança de status
const MudarStatusSchema = z.object({
  novoStatus: StatusAgenteEnum,
  motivo: z.string().optional(),
});

// ====================================
// MIDDLEWARE: Extrair Tenant do Token
// ====================================

// Por enquanto, simula extração do tenant do header
// TODO: Integrar com middleware de autenticação real
const extrairTenantId = (req: Request): string | null => {
  if ((req as any).tenantId) return (req as any).tenantId;
  if (req.headers['x-tenant-id']) return req.headers['x-tenant-id'] as string;
  if (req.query.tenantId) return req.query.tenantId as string;
  return null;
};

// ============================================
// HELPERS
// ============================================



// ============================================
// ROTAS
// ============================================

/**
 * POST /api/agentes/configurar-rapido
 * Endpoint simplificado para o Wizard (cria ou atualiza)
 */
router.post('/configurar-rapido', async (req: Request, res: Response) => {
  try {
    const tenantId = extrairTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ erro: 'Tenant não identificado' });
    }

    // Validar dados parciais (o wizard envia passo a passo, mas aqui assumimos o final)
    // Na prática, o frontend envia tudo no final.
    const {
      nome,
      perfilImobiliaria,
      ragPerfilTexto
    } = req.body;

    // Verificar se já existe agente
    let agente = await prisma.configuracaoAgente.findFirst({
      where: { tenantId }
    });

    if (!agente) {
      // Criar agente com dados básicos se não existir
      agente = await prisma.configuracaoAgente.create({
        data: {
          tenantId,
          nome: nome || 'Sofia',
          tipoAgente: 'SDR_CAPTACAO',
          modoCreacao: 'PRE_TREINADO',
          genero: 'feminino',
          perfilImobiliaria: perfilImobiliaria as any,
          ragPerfilTexto,
          personalidade: {
            tom: 'amigavel',
            usarEmojis: true,
            nivelFormalidade: 3
          },
          expertise: {
            bairros: [],
            tiposImovel: []
          },
          scripts: {
            saudacao: 'Olá! Como posso ajudar você hoje?',
            despedida: 'Foi um prazer ajudar! Até logo!'
          },
          regrasNegocio: {},
          status: 'RASCUNHO',
          estaAtivo: false,
          termosAceitos: false,
        } as any
      });
      console.log(`[Agentes] ✅ Agente "${nome || 'Sofia'}" criado automaticamente para tenant ${tenantId}`);
    } else {
      // Atualizar agente existente
      agente = await prisma.configuracaoAgente.update({
        where: { id: agente.id },
        data: {
          ...(nome && { nome }),
          ...(perfilImobiliaria && { perfilImobiliaria: perfilImobiliaria as any }),
          ...(ragPerfilTexto && { ragPerfilTexto }),
        } as any
      });
      console.log(`[Agentes] ✅ Perfil atualizado para agente "${agente.nome}"`);
    }

    res.json({
      mensagem: 'Perfil salvo com sucesso!',
      id: agente.id,
      nome: agente.nome,
      ragGerado: !!ragPerfilTexto
    });
  } catch (error) {
    console.error('[Agentes] Erro ao salvar perfil:', error);
    res.status(500).json({ erro: 'Erro interno ao salvar perfil' });
  }
});

/**
 * GET /api/agentes
 * Lista o agente do tenant atual (cada tenant tem no máximo 1 agente)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = extrairTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        erro: 'Tenant não identificado',
        mensagem: 'Envie o header X-Tenant-Id ou faça login'
      });
    }

    const agente = await prisma.configuracaoAgente.findFirst({
      where: { tenantId },
      include: {
        tenant: {
          select: { nome: true, slug: true }
        },
        sessaoWhatsapp: {
          select: { id: true, nome: true, numeroWhatsapp: true }
        }
      }
    });

    if (!agente) {
      return res.status(404).json({
        erro: 'Agente não encontrado',
        mensagem: 'Configure seu agente para começar',
        sugestao: 'POST /api/agentes para criar'
      });
    }

    res.json({ agente });
  } catch (error) {
    console.error('[Agentes] Erro ao listar:', error);
    res.status(500).json({ erro: 'Erro interno ao listar agente' });
  }
});

/**
 * GET /api/agentes/:id
 * Obtém detalhes de um agente específico
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = extrairTenantId(req);

    const agente = await prisma.configuracaoAgente.findUnique({
      where: { id },
      include: {
        tenant: {
          select: { nome: true, slug: true }
        },
        sessaoWhatsapp: {
          select: { id: true, nome: true, numeroWhatsapp: true }
        }
      }
    });

    if (!agente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    // Verificar se o agente pertence ao tenant (segurança)
    if (tenantId && agente.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado a este agente' });
    }

    res.json({ agente });
  } catch (error) {
    console.error('[Agentes] Erro ao obter:', error);
    res.status(500).json({ erro: 'Erro interno ao obter agente' });
  }
});

/**
 * POST /api/agentes
 * Cria um novo agente para o tenant
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = extrairTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        erro: 'Tenant não identificado',
        mensagem: 'Envie o header X-Tenant-Id ou faça login'
      });
    }

    // Verificar se tenant existe
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ erro: 'Tenant não encontrado' });
    }

    // Verificar limite de agentes (1 base + extras)
    const totalAgentes = await prisma.configuracaoAgente.count({
      where: { tenantId }
    });

    const limiteAgentes = 1 + (tenant.agentesExtras || 0);

    if (totalAgentes >= limiteAgentes) {
      return res.status(403).json({
        erro: 'Limite de agentes atingido',
        codigo: 'LIMITE_ATINGIDO',
        mensagem: `Seu plano permite ${limiteAgentes} agente(s). Contrate um agente extra para continuar.`,
        limite: limiteAgentes,
        atual: totalAgentes
      });
    }

    // Validar dados de entrada
    console.log('[Agentes] Dados recebidos:', JSON.stringify(req.body, null, 2));

    const validacao = CriarAgenteSchema.safeParse(req.body);
    if (!validacao.success) {
      console.log('[Agentes] Erro de validação:', validacao.error.flatten());
      return res.status(400).json({
        erro: 'Dados inválidos',
        detalhes: validacao.error.flatten()
      });
    }

    const dados = validacao.data;

    // Sintetizar RAG do perfil da imobiliária (se fornecido)
    let ragPerfilTexto: string | null = null;
    if (dados.perfilImobiliaria) {
      try {
        ragPerfilTexto = sintetizarPerfilRAG(dados.perfilImobiliaria as any);
        console.log('[Agentes] ✅ RAG do perfil sintetizado com sucesso');
      } catch (err) {
        console.warn('[Agentes] ⚠️ Erro ao sintetizar RAG do perfil:', err);
      }
    }

    // Criar agente
    const novoAgente = await prisma.configuracaoAgente.create({
      data: {
        tenantId,
        nome: dados.nome,
        avatar: dados.avatar,
        genero: dados.genero,
        tipoAgente: dados.tipoAgente,
        modoCreacao: dados.modoCreacao,
        templateBase: dados.templateBase,
        personalidade: dados.personalidade as any,
        expertise: dados.expertise as any,
        scripts: dados.scripts as any,
        regrasNegocio: dados.regrasNegocio as any,
        perfilImobiliaria: dados.perfilImobiliaria as any,
        ragPerfilTexto,
        estaAtivo: dados.estaAtivo,
        termosAceitos: dados.termosAceitos,
        termosAceitosEm: dados.termosAceitos ? new Date() : null,
        termosVersao: dados.termosAceitos ? (dados.termosVersao || '1.0') : null,
        status: dados.termosAceitos ? 'RASCUNHO' : 'RASCUNHO', // Sempre começa como rascunho
        sessaoWhatsappId: dados.sessaoWhatsappId,
      } as any,
      include: {
        tenant: {
          select: { nome: true, slug: true }
        }
      }
    });

    console.log(`[Agentes] ✅ Agente "${novoAgente.nome}" criado para tenant ${tenant.nome} (termosAceitos: ${novoAgente.termosAceitos})`);

    res.status(201).json({
      mensagem: 'Agente criado com sucesso!',
      agente: novoAgente
    });
  } catch (error) {
    console.error('[Agentes] Erro ao criar:', error);
    res.status(500).json({ erro: 'Erro interno ao criar agente' });
  }
});

/**
 * PUT /api/agentes/:id
 * Atualiza um agente existente
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = extrairTenantId(req);

    // Verificar se agente existe
    const agenteExistente = await prisma.configuracaoAgente.findUnique({
      where: { id }
    });

    if (!agenteExistente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    // Verificar permissão
    if (tenantId && agenteExistente.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado a este agente' });
    }

    // Validar dados de entrada
    const validacao = AtualizarAgenteSchema.safeParse(req.body);
    if (!validacao.success) {
      return res.status(400).json({
        erro: 'Dados inválidos',
        detalhes: validacao.error.flatten()
      });
    }

    const dados = validacao.data;

    // Preparar dados para atualização (merge com existente para campos JSON)
    const dadosAtualizacao: any = {};

    if (dados.nome !== undefined) dadosAtualizacao.nome = dados.nome;
    if (dados.avatar !== undefined) dadosAtualizacao.avatar = dados.avatar;
    if (dados.estaAtivo !== undefined) dadosAtualizacao.estaAtivo = dados.estaAtivo;
    if (dados.sessaoWhatsappId !== undefined) dadosAtualizacao.sessaoWhatsappId = dados.sessaoWhatsappId;

    // Para campos JSON, fazer merge com valores existentes
    if (dados.personalidade !== undefined) {
      dadosAtualizacao.personalidade = {
        ...(agenteExistente.personalidade as object || {}),
        ...dados.personalidade
      };
    }

    if (dados.expertise !== undefined) {
      dadosAtualizacao.expertise = {
        ...(agenteExistente.expertise as object || {}),
        ...dados.expertise
      };
    }

    if (dados.scripts !== undefined) {
      dadosAtualizacao.scripts = {
        ...(agenteExistente.scripts as object || {}),
        ...dados.scripts
      };
    }

    if (dados.regrasNegocio !== undefined) {
      dadosAtualizacao.regrasNegocio = {
        ...(agenteExistente.regrasNegocio as object || {}),
        ...dados.regrasNegocio
      };
    }

    // Atualizar
    const agenteAtualizado = await prisma.configuracaoAgente.update({
      where: { id },
      data: dadosAtualizacao,
      include: {
        tenant: {
          select: { nome: true, slug: true }
        }
      }
    });

    console.log(`[Agentes] ✅ Agente "${agenteAtualizado.nome}" atualizado`);

    res.json({
      mensagem: 'Agente atualizado com sucesso!',
      agente: agenteAtualizado
    });
  } catch (error) {
    console.error('[Agentes] Erro ao atualizar:', error);
    res.status(500).json({ erro: 'Erro interno ao atualizar agente' });
  }
});

/**
 * PATCH /api/agentes/:id/ativar
 * Ativa o agente (muda status para ATIVO)
 */
router.patch('/:id/ativar', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const agenteExistente = await prisma.configuracaoAgente.findUnique({
      where: { id }
    }) as ConfiguracaoAgenteCompleto | null;

    if (!agenteExistente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    // Validações antes de ativar
    const errosValidacao: string[] = [];

    if (!agenteExistente.nome || agenteExistente.nome.length < 2) {
      errosValidacao.push('Nome do agente é obrigatório');
    }

    if (!agenteExistente.termosAceitos) {
      errosValidacao.push('Termos de uso devem ser aceitos para ativar o agente');
    }

    // Se for modo personalizado, precisa ter prompt
    if (agenteExistente.modoCreacao === 'PERSONALIZADO' && !agenteExistente.promptCustomizado) {
      errosValidacao.push('Agentes personalizados precisam de um prompt customizado');
    }

    if (errosValidacao.length > 0) {
      return res.status(400).json({
        erro: 'Não é possível ativar o agente',
        validacoes: errosValidacao
      });
    }

    const agente = await prisma.configuracaoAgente.update({
      where: { id },
      data: {
        estaAtivo: true,
        status: 'ATIVO'
      } as any
    });

    console.log(`[Agentes] ✅ Agente "${agente.nome}" ativado (status: ATIVO)`);
    res.json({
      mensagem: 'Agente ativado!',
      estaAtivo: true,
      status: 'ATIVO'
    });
  } catch (error) {
    console.error('[Agentes] Erro ao ativar:', error);
    res.status(500).json({ erro: 'Erro interno ao ativar agente' });
  }
});

/**
 * PATCH /api/agentes/:id/pausar
 * Pausa o agente (muda status para PAUSADO)
 */
router.patch('/:id/pausar', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const agenteExistente = await prisma.configuracaoAgente.findUnique({
      where: { id }
    }) as ConfiguracaoAgenteCompleto | null;

    if (!agenteExistente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    // Só pode pausar se estiver ativo
    if (agenteExistente.status !== 'ATIVO') {
      return res.status(400).json({
        erro: 'Só é possível pausar agentes ativos',
        statusAtual: agenteExistente.status
      });
    }

    const agente = await prisma.configuracaoAgente.update({
      where: { id },
      data: {
        estaAtivo: false,
        status: 'PAUSADO'
      } as any
    });

    console.log(`[Agentes] ⏸️ Agente "${agente.nome}" pausado. Motivo: ${motivo || 'Não informado'}`);
    res.json({
      mensagem: 'Agente pausado. Novas conversas irão para fila humana.',
      estaAtivo: false,
      status: 'PAUSADO'
    });
  } catch (error) {
    console.error('[Agentes] Erro ao pausar:', error);
    res.status(500).json({ erro: 'Erro interno ao pausar agente' });
  }
});

/**
 * PATCH /api/agentes/:id/desativar
 * Desativa o agente (volta para RASCUNHO - conversas vão para fila humana)
 */
router.patch('/:id/desativar', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const agente = await prisma.configuracaoAgente.update({
      where: { id },
      data: {
        estaAtivo: false,
        status: 'RASCUNHO'
      } as any
    });

    console.log(`[Agentes] 🔄 Agente "${agente.nome}" voltou para rascunho`);
    res.json({
      mensagem: 'Agente desativado e voltou para rascunho.',
      estaAtivo: false,
      status: 'RASCUNHO'
    });
  } catch (error) {
    console.error('[Agentes] Erro ao desativar:', error);
    res.status(500).json({ erro: 'Erro interno ao desativar agente' });
  }
});

/**
 * PATCH /api/agentes/:id/aceitar-termos
 * Aceita os termos de uso do agente
 */
router.patch('/:id/aceitar-termos', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { versao } = req.body;

    const agente = await prisma.configuracaoAgente.update({
      where: { id },
      data: {
        termosAceitos: true,
        termosAceitosEm: new Date(),
        termosVersao: versao || '1.0'
      } as any
    });

    console.log(`[Agentes] ✅ Termos aceitos para agente "${agente.nome}"`);
    res.json({
      mensagem: 'Termos de uso aceitos com sucesso!',
      termosAceitos: true,
      termosAceitosEm: new Date()
    });
  } catch (error) {
    console.error('[Agentes] Erro ao aceitar termos:', error);
    res.status(500).json({ erro: 'Erro interno ao aceitar termos' });
  }
});

/**
 * PATCH /api/agentes/:id/perfil-imobiliaria
 * Atualiza o perfil da imobiliária e regenera o RAG
 */
router.patch('/:id/perfil-imobiliaria', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = extrairTenantId(req);

    // Verificar se agente existe
    const agenteExistente = await prisma.configuracaoAgente.findUnique({
      where: { id }
    });

    if (!agenteExistente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    // Verificar permissão
    if (tenantId && agenteExistente.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado a este agente' });
    }

    // Validar perfil
    const validacao = PerfilImobiliariaSchema.safeParse(req.body);
    if (!validacao.success) {
      return res.status(400).json({
        erro: 'Dados do perfil inválidos',
        detalhes: validacao.error.flatten()
      });
    }

    const perfilImobiliaria = validacao.data;

    // Sintetizar RAG
    let ragPerfilTexto: string | null = null;
    if (perfilImobiliaria) {
      try {
        ragPerfilTexto = sintetizarPerfilRAG(perfilImobiliaria as any);
        console.log('[Agentes] ✅ RAG do perfil re-sintetizado');
      } catch (err) {
        console.warn('[Agentes] ⚠️ Erro ao sintetizar RAG:', err);
      }
    }

    // Atualizar agente
    const agenteAtualizado = await prisma.configuracaoAgente.update({
      where: { id },
      data: {
        perfilImobiliaria: perfilImobiliaria as any,
        ragPerfilTexto
      } as any
    });

    console.log(`[Agentes] ✅ Perfil da imobiliária atualizado para "${agenteAtualizado.nome}"`);

    res.json({
      mensagem: 'Perfil da imobiliária atualizado!',
      perfilImobiliaria,
      ragGerado: !!ragPerfilTexto,
      ragPreview: ragPerfilTexto?.substring(0, 500) + '...'
    });
  } catch (error) {
    console.error('[Agentes] Erro ao atualizar perfil:', error);
    res.status(500).json({ erro: 'Erro interno ao atualizar perfil' });
  }
});

/**
 * DELETE /api/agentes/:id
 * Exclui um agente permanentemente
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = extrairTenantId(req);

    const agenteExistente = await prisma.configuracaoAgente.findUnique({
      where: { id }
    });

    if (!agenteExistente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    // Verificar permissão
    if (tenantId && agenteExistente.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado a este agente' });
    }

    // Não permitir excluir agente ativo
    if (agenteExistente.estaAtivo) {
      return res.status(400).json({
        erro: 'Não é possível excluir um agente ativo',
        mensagem: 'Pause ou desative o agente antes de excluir'
      });
    }

    await prisma.configuracaoAgente.delete({
      where: { id }
    });

    console.log(`[Agentes] 🗑️ Agente "${agenteExistente.nome}" excluído permanentemente`);
    res.json({
      mensagem: 'Agente excluído com sucesso',
      id: agenteExistente.id,
      nome: agenteExistente.nome
    });
  } catch (error) {
    console.error('[Agentes] Erro ao excluir:', error);
    res.status(500).json({ erro: 'Erro interno ao excluir agente' });
  }
});

/**
 * PATCH /api/agentes/:id/status
 * Muda o status do agente com validações
 */
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validar entrada
    const validacao = MudarStatusSchema.safeParse(req.body);
    if (!validacao.success) {
      return res.status(400).json({
        erro: 'Dados inválidos',
        detalhes: validacao.error.flatten()
      });
    }

    const { novoStatus, motivo } = validacao.data;

    const agenteExistente = await prisma.configuracaoAgente.findUnique({
      where: { id }
    }) as ConfiguracaoAgenteCompleto | null;

    if (!agenteExistente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    const statusAtual = agenteExistente.status;

    // Regras de transição de status
    const transicoesValidas: Record<string, string[]> = {
      'RASCUNHO': ['ATIVO'],           // Rascunho só pode virar Ativo
      'ATIVO': ['PAUSADO', 'RASCUNHO'], // Ativo pode pausar ou voltar a rascunho
      'PAUSADO': ['ATIVO', 'RASCUNHO']  // Pausado pode reativar ou voltar a rascunho
    };

    if (!transicoesValidas[statusAtual]?.includes(novoStatus)) {
      return res.status(400).json({
        erro: `Transição inválida: ${statusAtual} → ${novoStatus}`,
        transicoesPermitidas: transicoesValidas[statusAtual]
      });
    }

    // Validações específicas para ativar
    if (novoStatus === 'ATIVO') {
      const errosValidacao: string[] = [];

      if (!agenteExistente.termosAceitos) {
        errosValidacao.push('Termos de uso devem ser aceitos');
      }

      if (agenteExistente.modoCreacao === 'PERSONALIZADO' && !agenteExistente.promptCustomizado) {
        errosValidacao.push('Prompt customizado é obrigatório para modo avançado');
      }

      if (errosValidacao.length > 0) {
        return res.status(400).json({
          erro: 'Não é possível ativar o agente',
          validacoes: errosValidacao
        });
      }
    }

    // Atualizar status
    const agente = await prisma.configuracaoAgente.update({
      where: { id },
      data: {
        status: novoStatus,
        estaAtivo: novoStatus === 'ATIVO'
      } as any
    });

    const emojis: Record<string, string> = {
      'ATIVO': '✅',
      'PAUSADO': '⏸️',
      'RASCUNHO': '📝'
    };

    console.log(`[Agentes] ${emojis[novoStatus]} Agente "${agente.nome}" status: ${statusAtual} → ${novoStatus}${motivo ? ` (${motivo})` : ''}`);

    res.json({
      mensagem: `Status alterado para ${novoStatus}`,
      statusAnterior: statusAtual,
      statusAtual: novoStatus,
      estaAtivo: novoStatus === 'ATIVO'
    });
  } catch (error) {
    console.error('[Agentes] Erro ao mudar status:', error);
    res.status(500).json({ erro: 'Erro interno ao mudar status' });
  }
});

/**
 * POST /api/agentes/modo-avancado
 * Cria um agente no modo avançado (100% customizado)
 */
router.post('/modo-avancado', async (req: Request, res: Response) => {
  try {
    const tenantId = extrairTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        erro: 'Tenant não identificado',
        mensagem: 'Envie o header X-Tenant-Id ou faça login'
      });
    }

    // Verificar se tenant existe
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ erro: 'Tenant não encontrado' });
    }

    // Verificar se já existe agente para este tenant
    const agenteExistente = await prisma.configuracaoAgente.findFirst({
      where: { tenantId }
    });

    if (agenteExistente) {
      return res.status(409).json({
        erro: 'Agente já existe',
        mensagem: 'Este tenant já possui um agente configurado. Use PUT para atualizar.',
        agenteId: agenteExistente.id
      });
    }

    // Validar dados de entrada (schema mais rigoroso)
    const validacao = CriarAgenteAvancadoSchema.safeParse(req.body);
    if (!validacao.success) {
      return res.status(400).json({
        erro: 'Dados inválidos para modo avançado',
        detalhes: validacao.error.flatten()
      });
    }

    const dados = validacao.data;

    // Criar agente no modo avançado
    const novoAgente = await prisma.configuracaoAgente.create({
      data: {
        tenantId,
        nome: dados.nome,
        avatar: dados.avatar,
        genero: dados.genero,
        tipoAgente: 'PERSONALIZADO',
        modoCreacao: 'PERSONALIZADO',
        promptCustomizado: dados.promptCustomizado,
        toolsCustomizadas: dados.toolsCustomizadas,
        personalidade: {
          ...(dados.personalidade as any),
          objetivo: dados.objetivo,
          contexto: dados.contexto,
          restricoes: dados.restricoes,
        },
        expertise: dados.expertise as any,
        scripts: dados.scripts as any,
        regrasNegocio: dados.regrasNegocio as any,
        status: 'RASCUNHO', // Começa em rascunho
        estaAtivo: false,
        termosAceitos: true,
        termosAceitosEm: new Date(),
        termosVersao: dados.termosVersao || '1.0.0',
      } as any,
      include: {
        tenant: {
          select: { nome: true, slug: true }
        }
      }
    });

    console.log(`[Agentes] ✅ Agente AVANÇADO "${novoAgente.nome}" criado para tenant ${tenant.nome}`);
    console.log(`[Agentes] ⚠️ Modo avançado - responsabilidade do cliente`);

    res.status(201).json({
      mensagem: 'Agente avançado criado com sucesso!',
      aviso: 'Por ser um agente personalizado, você tem total responsabilidade sobre seu comportamento.',
      agente: novoAgente
    });
  } catch (error) {
    console.error('[Agentes] Erro ao criar agente avançado:', error);
    res.status(500).json({ erro: 'Erro interno ao criar agente avançado' });
  }
});

/**
 * DELETE /api/agentes/:id
 * Remove um agente (soft delete ou hard delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = extrairTenantId(req);

    // Verificar se agente existe
    const agente = await prisma.configuracaoAgente.findUnique({
      where: { id }
    });

    if (!agente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    // Verificar permissão
    if (tenantId && agente.tenantId !== tenantId) {
      return res.status(403).json({ erro: 'Acesso negado a este agente' });
    }

    // Hard delete
    await prisma.configuracaoAgente.delete({
      where: { id }
    });

    console.log(`[Agentes] 🗑️ Agente "${agente.nome}" removido`);

    res.json({ mensagem: 'Agente removido com sucesso' });
  } catch (error) {
    console.error('[Agentes] Erro ao deletar:', error);
    res.status(500).json({ erro: 'Erro interno ao deletar agente' });
  }
});

/**
 * GET /api/agentes/:id/preview
 * Retorna como o agente responderia a uma mensagem de teste
 */
router.post('/:id/preview', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { mensagem } = req.body;

    if (!mensagem) {
      return res.status(400).json({ erro: 'Envie uma mensagem para testar' });
    }

    const agente = await prisma.configuracaoAgente.findUnique({
      where: { id }
    });

    if (!agente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }

    const personalidade = agente.personalidade as any;
    const scripts = agente.scripts as any;
    const expertise = agente.expertise as any;

    // Montar preview do prompt que seria usado
    const promptPreview = `
Você é ${agente.nome}, assistente virtual.

TOM DE VOZ: ${personalidade?.tom || 'amigável'}
USAR EMOJIS: ${personalidade?.usarEmojis ? 'Sim, moderadamente' : 'Não'}

ESPECIALIDADES:
- Bairros: ${expertise?.bairros?.join(', ') || 'Todos'}
- Tipos de Imóvel: ${expertise?.tiposImovel?.join(', ') || 'Todos'}

SCRIPTS:
- Saudação: "${scripts?.saudacao || 'Olá!'}"
- Despedida: "${scripts?.despedida || 'Até logo!'}"

MENSAGEM DO USUÁRIO: "${mensagem}"
    `.trim();

    // Por enquanto, retorna apenas o prompt (sem chamar OpenAI)
    // TODO: Integrar com OpenAI para resposta real
    res.json({
      agente: agente.nome,
      mensagemRecebida: mensagem,
      promptGerado: promptPreview,
      nota: 'Preview do prompt. Integração com OpenAI em desenvolvimento.'
    });
  } catch (error) {
    console.error('[Agentes] Erro no preview:', error);
    res.status(500).json({ erro: 'Erro interno no preview' });
  }
});

export default router;
