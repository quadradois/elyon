import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { verificarAutenticacao } from '../middleware/middleware-auth';
import { openaiService } from '../servicos/openai';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// CRUD PLAYBOOKS
// ============================================

/**
 * GET /api/playbooks
 * Lista todos os playbooks do tenant
 */
router.get('/', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).usuario.tenantId;

        const playbooks = await prisma.playbook.findMany({
            where: { tenantId },
            include: {
                agente: { select: { nome: true } },
                _count: { select: { etapas: true } }
            },
            orderBy: { criadoEm: 'desc' }
        });

        res.json({ playbooks });
    } catch (error: any) {
        console.error('[PLAYBOOKS] Erro ao listar:', error);
        res.status(500).json({ error: 'Erro ao listar playbooks' });
    }
});

/**
 * GET /api/playbooks/:id
 * Busca um playbook específico com todas as relações
 */
router.get('/:id', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const tenantId = (req as any).usuario.tenantId;

        const playbook = await prisma.playbook.findFirst({
            where: { id, tenantId },
            include: {
                etapas: {
                    orderBy: { ordem: 'asc' },
                    include: {
                        itens: { orderBy: { ordem: 'asc' } },
                        objecoes: { orderBy: { criadoEm: 'asc' } }
                    }
                }
            }
        });

        if (!playbook) {
            return res.status(404).json({ error: 'Playbook não encontrado' });
        }

        res.json({ playbook });
    } catch (error: any) {
        console.error('[PLAYBOOKS] Erro ao buscar:', error);
        res.status(500).json({ error: 'Erro ao buscar playbook' });
    }
});

/**
 * POST /api/playbooks
 * Cria um novo playbook
 */
router.post('/', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).usuario.tenantId;
        const usuarioId = (req as any).usuario.id;
        const { nome, descricao, tipo, agenteId } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const playbook = await prisma.playbook.create({
            data: {
                tenantId,
                nome,
                descricao,
                tipo: tipo || 'QUALIFICACAO',
                agenteId: agenteId || null,
                criadoPorId: usuarioId
            }
        });

        res.status(201).json({ playbook });
    } catch (error: any) {
        console.error('[PLAYBOOKS] Erro ao criar:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Já existe um playbook com este nome' });
        }
        res.status(500).json({ error: 'Erro ao criar playbook' });
    }
});

/**
 * PUT /api/playbooks/:id
 * Atualiza um playbook existente (incluindo etapas, itens e objeções)
 */
router.put('/:id', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const tenantId = (req as any).usuario.tenantId;
        const { nome, descricao, tipo, estaAtivo, etapas } = req.body;

        // Verificar se playbook existe e pertence ao tenant
        const existing = await prisma.playbook.findFirst({
            where: { id, tenantId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Playbook não encontrado' });
        }

        // Atualizar playbook em transação
        const playbook = await prisma.$transaction(async (tx) => {
            // 1. Atualizar dados básicos
            const updated = await tx.playbook.update({
                where: { id },
                data: {
                    nome,
                    descricao,
                    tipo,
                    estaAtivo
                }
            });

            // 2. Se etapas foram enviadas, atualizar estrutura completa
            if (etapas && Array.isArray(etapas)) {
                // Deletar etapas antigas (cascade deletará itens e objeções)
                await tx.playbookStage.deleteMany({
                    where: { playbookId: id }
                });

                // Criar novas etapas com itens e objeções
                for (const etapa of etapas) {
                    await tx.playbookStage.create({
                        data: {
                            playbookId: id,
                            nome: etapa.nome,
                            descricao: etapa.descricao,
                            icone: etapa.icone || '📋',
                            ordem: etapa.ordem,
                            scriptTexto: etapa.scriptTexto,
                            aiPromptContext: etapa.aiPromptContext,
                            itens: {
                                create: (etapa.itens || []).map((item: any) => ({
                                    texto: item.texto,
                                    tipoItem: item.tipoItem || 'CHECKBOX',
                                    opcoes: item.opcoes || [],
                                    placeholder: item.placeholder,
                                    scorePontos: item.scorePontos || 0,
                                    atualizaCampo: item.atualizaCampo,
                                    obrigatorio: item.obrigatorio || false,
                                    aiExtrairPadrao: item.aiExtrairPadrao,
                                    aiPreencherAuto: item.aiPreencherAuto || false,
                                    ordem: item.ordem
                                }))
                            },
                            objecoes: {
                                create: (etapa.objecoes || []).map((obj: any) => ({
                                    gatilho: obj.objecaoTexto || obj.gatilho || '',
                                    resposta: obj.respostaTexto || obj.resposta || '',
                                    ordem: obj.ordem
                                }))
                            }
                        }
                    });
                }
            }

            return updated;
        });

        res.json({ playbook });
    } catch (error: any) {
        console.error('[PLAYBOOKS] Erro ao atualizar:', error);
        res.status(500).json({ error: 'Erro ao atualizar playbook' });
    }
});

/**
 * DELETE /api/playbooks/:id
 * Remove um playbook
 */
router.delete('/:id', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const tenantId = (req as any).usuario.tenantId;

        const existing = await prisma.playbook.findFirst({
            where: { id, tenantId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Playbook não encontrado' });
        }

        await prisma.playbook.delete({
            where: { id }
        });

        res.json({ success: true, message: 'Playbook excluído' });
    } catch (error: any) {
        console.error('[PLAYBOOKS] Erro ao excluir:', error);
        res.status(500).json({ error: 'Erro ao excluir playbook' });
    }
});

/**
 * POST /api/playbooks/:id/duplicar
 * Duplica um playbook existente
 */
router.post('/:id/duplicar', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const tenantId = (req as any).usuario.tenantId;
        const usuarioId = (req as any).usuario.id;

        // Buscar playbook original com todas as relações
        const original = await prisma.playbook.findFirst({
            where: { id, tenantId },
            include: {
                etapas: {
                    include: {
                        itens: true,
                        objecoes: true
                    }
                }
            }
        });

        if (!original) {
            return res.status(404).json({ error: 'Playbook não encontrado' });
        }

        // Criar cópia
        const copia = await prisma.playbook.create({
            data: {
                tenantId,
                nome: `${original.nome} (Cópia)`,
                descricao: original.descricao,
                tipo: original.tipo,
                criadoPorId: usuarioId,
                etapas: {
                    create: original.etapas.map((etapa, eIndex) => ({
                        nome: etapa.nome,
                        descricao: etapa.descricao,
                        icone: etapa.icone,
                        ordem: eIndex,
                        scriptTexto: etapa.scriptTexto,
                        aiPromptContext: etapa.aiPromptContext,
                        itens: {
                            create: etapa.itens.map((item, iIndex) => ({
                                texto: item.texto,
                                tipoItem: item.tipoItem,
                                opcoes: item.opcoes as string[],
                                placeholder: item.placeholder,
                                scorePontos: item.scorePontos,
                                atualizaCampo: item.atualizaCampo,
                                obrigatorio: item.obrigatorio,
                                aiExtrairPadrao: item.aiExtrairPadrao,
                                aiPreencherAuto: item.aiPreencherAuto,
                                ordem: iIndex
                            }))
                        },
                        objecoes: {
                            create: etapa.objecoes.map((obj: any, oIndex) => ({
                                gatilho: obj.objecaoTexto || obj.gatilho || '',
                                resposta: obj.respostaTexto || obj.resposta || '',
                                ordem: oIndex
                            }))
                        }
                    }))
                }
            }
        });

        res.status(201).json({ playbook: copia });
    } catch (error: any) {
        console.error('[PLAYBOOKS] Erro ao duplicar:', error);
        res.status(500).json({ error: 'Erro ao duplicar playbook' });
    }
});

// ============================================
// AI GENERATION - CONVERSOR INTELIGENTE
// ============================================

/**
 * POST /api/playbooks/gerar
 * Converte qualquer texto/JSON em um playbook estruturado usando IA
 * 
 * Aceita:
 * - Texto livre descrevendo o atendimento
 * - JSON em qualquer formato (guias, manuais, etc)
 * - Lista de perguntas/objeções
 */
router.post('/gerar', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).usuario.tenantId;
        const { conteudo, tipo, contexto, salvarAutomatico } = req.body;

        if (!conteudo || conteudo.trim().length < 20) {
            return res.status(400).json({
                error: 'Conteúdo muito curto. Descreva seu atendimento com mais detalhes.'
            });
        }

        // OpenAI está sempre disponível (configuração obrigatória)
        console.log(`[PLAYBOOKS] 🤖 Gerando playbook com OpenAI para tenant ${tenantId}`);
        console.log(`[PLAYBOOKS] Conteúdo: ${conteudo.length} caracteres`);

        // Prompt especializado para conversão
        const prompt = `Você é um especialista em criar playbooks de vendas para imobiliárias brasileiras.

Analise o conteúdo abaixo e crie um playbook estruturado de qualificação de leads.

=== CONTEÚDO DO USUÁRIO ===
${conteudo}
${contexto ? `\n=== CONTEXTO ADICIONAL ===\n${contexto}` : ''}

=== REGRAS DE GERAÇÃO ===
1. IDENTIFIQUE O TIPO DE CAMPANHA no conteúdo:
   - OUTBOUND (Prospecção Ativa): Quando o corretor entra em contato com listas de leads
   - INBOUND (Receptivo): Quando o cliente entra em contato

2. Para campanhas OUTBOUND, crie etapas como:
   - Primeiro Contato / Abordagem Inicial
   - Qualificação BANT (Budget, Authority, Need, Timeline)
   - Despertar Interesse / Apresentação
   - Agendamento de Visita
   - Follow-up

3. Para campanhas INBOUND, crie etapas como:
   - Recepção / Boas-vindas
   - Descoberta de Necessidades
   - Qualificação Financeira
   - Apresentação de Opções
   - Agendamento / Fechamento

4. Cada etapa deve ter 2 a 5 itens de qualificação (perguntas ou checklist)
5. Para cada etapa, identifique 2-3 objeções comuns com respostas sugeridas
6. Use linguagem natural e amigável em português brasileiro
7. Priorize perguntas que qualificam: orçamento, urgência, poder de decisão, necessidade
8. Atribua pontuação (scorePontos) proporcionalmente à importância do item (0-30 pontos)

=== FORMATO DE RESPOSTA (JSON) ===
{
  "nome": "Nome sugerido para o playbook",
  "descricao": "Descrição breve do objetivo do playbook",
  "tipo": "${tipo || 'QUALIFICACAO'}",
  "etapas": [
    {
      "nome": "Nome da Etapa",
      "descricao": "Objetivo desta etapa",
      "icone": "emoji adequado (🎯, 💰, 📞, ✅, etc)",
      "scriptTexto": "Script sugerido para o corretor usar",
      "itens": [
        {
          "texto": "Pergunta ou item de checklist",
          "tipoItem": "CHECKBOX | TEXTO | SELECT | NUMERO | DATA",
          "opcoes": ["opção 1", "opção 2"] (apenas para SELECT),
          "obrigatorio": true/false,
          "scorePontos": 10
        }
      ],
      "objecoes": [
        {
          "objecaoTexto": "O que o cliente pode dizer",
          "respostaTexto": "Resposta sugerida para contornar"
        }
      ]
    }
  ],
  "sugestoes": ["Sugestão de melhoria 1", "Sugestão 2"]
}`;

        // Gerar com OpenAI
        const resposta = await openaiService.gerarResposta(
            [
                { role: 'system', content: 'Você é um assistente especializado em criar playbooks de vendas estruturados. Sempre responda em JSON válido.' },
                { role: 'user', content: prompt }
            ],
            {
                model: 'gpt-4o-mini',
                temperature: 0.3,
                maxTokens: 4096,
                json: true
            }
        );

        // Parse do JSON
        let resultado: {
            nome: string;
            descricao: string;
            tipo: string;
            etapas: any[];
            sugestoes?: string[];
        };

        try {
            resultado = JSON.parse(resposta);
        } catch (parseError) {
            console.error('[PLAYBOOKS] Erro ao parsear JSON:', resposta.substring(0, 200));
            return res.status(500).json({ error: 'Erro ao processar resposta da IA' });
        }

        console.log(`[PLAYBOOKS] ✅ Gerado: ${resultado.nome} com ${resultado.etapas?.length || 0} etapas`);

        // Helper para normalizar tipoItem para valores válidos do enum
        const normalizarTipoItem = (tipo: string): string => {
            const mapa: Record<string, string> = {
                'INPUT': 'TEXTO',
                'TEXT': 'TEXTO',
                'TEXTAREA': 'TEXTO',
                'DATE': 'DATA',
                'NUMBER': 'NUMERO',
                'NUMERIC': 'NUMERO',
                'CHECKBOX': 'CHECKBOX',
                'SELECT': 'SELECT',
                'TEXTO': 'TEXTO',
                'NUMERO': 'NUMERO',
                'DATA': 'DATA'
            };
            return mapa[tipo?.toUpperCase()] || 'CHECKBOX';
        };

        // Se salvarAutomatico, criar o playbook no banco
        let playbookSalvo = null;
        if (salvarAutomatico && resultado.etapas && resultado.etapas.length > 0) {
            const usuarioId = (req as any).usuario.id;

            playbookSalvo = await prisma.playbook.create({
                data: {
                    tenantId,
                    nome: resultado.nome,
                    descricao: resultado.descricao,
                    tipo: (resultado.tipo || 'QUALIFICACAO') as any,
                    criadoPorId: usuarioId,
                    etapas: {
                        create: resultado.etapas.map((etapa: any, eIndex: number) => ({
                            nome: etapa.nome || `Etapa ${eIndex + 1}`,
                            descricao: etapa.descricao || '',
                            icone: etapa.icone || '📋',
                            ordem: eIndex,
                            scriptTexto: etapa.scriptTexto || '',
                            itens: {
                                create: (etapa.itens || []).map((item: any, iIndex: number) => ({
                                    texto: item.texto || 'Item',
                                    tipoItem: normalizarTipoItem(item.tipoItem) as any,
                                    opcoes: item.opcoes || [],
                                    obrigatorio: item.obrigatorio || false,
                                    scorePontos: item.scorePontos || 0,
                                    ordem: iIndex
                                }))
                            },
                            objecoes: {
                                create: (etapa.objecoes || []).map((obj: any, oIndex: number) => ({
                                    gatilho: obj.objecaoTexto || obj.gatilho || 'Objeção',
                                    resposta: obj.respostaTexto || obj.resposta || 'Resposta',
                                    ordem: oIndex
                                }))
                            }
                        }))
                    }
                },
                include: {
                    etapas: {
                        include: { itens: true, objecoes: true }
                    }
                }
            });

            console.log(`[PLAYBOOKS] 💾 Playbook salvo: ${playbookSalvo.id}`);
        }

        res.json({
            sucesso: true,
            playbook: resultado,
            salvo: !!playbookSalvo,
            playbookId: playbookSalvo?.id,
            sugestoes: resultado.sugestoes || [],
            estatisticas: {
                etapas: resultado.etapas?.length || 0,
                itens: resultado.etapas?.reduce((acc: number, e: any) => acc + (e.itens?.length || 0), 0) || 0,
                objecoes: resultado.etapas?.reduce((acc: number, e: any) => acc + (e.objecoes?.length || 0), 0) || 0
            }
        });

    } catch (error: any) {
        console.error('[PLAYBOOKS] Erro ao gerar:', error);
        res.status(500).json({
            error: 'Erro ao gerar playbook com IA',
            detalhes: error.message
        });
    }
});

// ============================================
// AI IMPORT/EXPORT
// ============================================

/**
 * POST /api/playbooks/export-template
 * Exporta um template JSON para ser preenchido por uma IA externa
 */
router.post('/export-template', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const { tipo, instrucoes } = req.body;

        const template = {
            _instrucoes: [
                'Este é um template para criar um Playbook de atendimento.',
                'Preencha os campos abaixo e envie de volta ao sistema.',
                'A IA deve seguir este roteiro para qualificar leads.',
                instrucoes || 'Crie um playbook de qualificação para imobiliária.'
            ],
            nome: 'Nome do Playbook',
            descricao: 'Descrição breve',
            tipo: tipo || 'QUALIFICACAO',
            etapas: [
                {
                    nome: 'Nome da Etapa 1',
                    descricao: 'Objetivo desta etapa',
                    icone: '👋',
                    scriptTexto: 'Script sugerido para o agente falar',
                    aiPromptContext: 'Contexto adicional para a IA',
                    itens: [
                        {
                            texto: 'Pergunta ou checklist item',
                            tipoItem: 'CHECKBOX',
                            opcoes: [],
                            obrigatorio: true,
                            scorePontos: 10
                        }
                    ],
                    objecoes: [
                        {
                            objecaoTexto: 'Se o cliente disser: "Não tenho interesse"',
                            resposta: 'Resposta sugerida: "Entendo! Mas posso..."'
                        }
                    ]
                }
            ]
        };

        res.json({ template });
    } catch (error: any) {
        console.error('[PLAYBOOKS] Erro ao exportar template:', error);
        res.status(500).json({ error: 'Erro ao exportar template' });
    }
});

/**
 * POST /api/playbooks/import
 * Importa um playbook a partir de JSON preenchido por IA
 */
router.post('/import', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).usuario.tenantId;
        const usuarioId = (req as any).usuario.id;
        const { playbookData } = req.body;

        if (!playbookData || !playbookData.nome) {
            return res.status(400).json({ error: 'JSON inválido - nome é obrigatório' });
        }

        // Remover campos de instrução
        delete playbookData._instrucoes;

        // 🔄 MAPEAMENTO: Aceitar variações de nomes de campos
        // Etapas: etapas, stages, steps, fases
        let etapas = playbookData.etapas || playbookData.stages || playbookData.steps || playbookData.fases || [];

        console.log(`[PLAYBOOKS] Import: ${playbookData.nome} - ${etapas.length} etapas encontradas`);
        console.log(`[PLAYBOOKS] Campos do JSON:`, Object.keys(playbookData));

        // Criar playbook a partir do JSON
        const playbook = await prisma.playbook.create({
            data: {
                tenantId,
                nome: playbookData.nome,
                descricao: playbookData.descricao,
                tipo: playbookData.tipo || 'QUALIFICACAO',
                criadoPorId: usuarioId,
                etapas: {
                    create: etapas.map((etapa: any, eIndex: number) => {
                        // Mapear campos da etapa (nome, name, titulo)
                        const nomeEtapa = etapa.nome || etapa.name || etapa.titulo || `Etapa ${eIndex + 1}`;
                        const descricaoEtapa = etapa.descricao || etapa.description || etapa.objetivo || '';
                        const scriptEtapa = etapa.scriptTexto || etapa.script || etapa.script_texto || '';
                        const aiContextEtapa = etapa.aiPromptContext || etapa.ai_context || etapa.contexto || '';

                        // Mapear itens (itens, items, perguntas, questions, checklist)
                        const itensEtapa = etapa.itens || etapa.items || etapa.perguntas || etapa.questions || etapa.checklist || [];

                        // Mapear objeções (objecoes, objections, contornos)
                        const objecoesEtapa = etapa.objecoes || etapa.objections || etapa.contornos || [];

                        return {
                            nome: nomeEtapa,
                            descricao: descricaoEtapa,
                            icone: etapa.icone || etapa.icon || etapa.emoji || '📋',
                            ordem: etapa.ordem ?? eIndex,
                            scriptTexto: scriptEtapa,
                            aiPromptContext: aiContextEtapa,
                            itens: {
                                create: itensEtapa.map((item: any, iIndex: number) => ({
                                    texto: item.texto || item.text || item.pergunta || item.question || 'Item',
                                    tipoItem: item.tipoItem || item.tipo || item.type || 'CHECKBOX',
                                    opcoes: item.opcoes || item.options || [],
                                    placeholder: item.placeholder,
                                    scorePontos: item.scorePontos || item.score || item.pontos || 0,
                                    atualizaCampo: item.atualizaCampo || item.campo || item.field,
                                    obrigatorio: item.obrigatorio ?? item.required ?? false,
                                    aiExtrairPadrao: item.aiExtrairPadrao || item.regex || item.pattern,
                                    aiPreencherAuto: item.aiPreencherAuto ?? item.autoFill ?? false,
                                    ordem: item.ordem ?? iIndex
                                }))
                            },
                            objecoes: {
                                create: objecoesEtapa.map((obj: any, oIndex: number) => ({
                                    gatilho: obj.objecaoTexto || obj.objecao || obj.objection || obj.text || obj.gatilho || 'Objeção',
                                    resposta: obj.respostaTexto || obj.resposta || obj.response || obj.contorno || 'Resposta',
                                    ordem: obj.ordem ?? oIndex
                                }))
                            }
                        };
                    })
                }
            },
            include: {
                etapas: {
                    include: {
                        itens: true,
                        objecoes: true
                    }
                }
            }
        });

        res.status(201).json({
            playbook,
            message: `Playbook "${playbook.nome}" importado com ${playbook.etapas.length} etapas`
        });
    } catch (error: any) {
        console.error('[PLAYBOOKS] Erro ao importar:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Já existe um playbook com este nome' });
        }
        res.status(500).json({ error: 'Erro ao importar playbook' });
    }
});

export default router;
