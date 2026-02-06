/**
 * ROTAS DE CONFIGURAÇÃO LLM (BYOK)
 * 
 * API para tenants gerenciarem suas próprias chaves de API de LLM.
 * Suporta múltiplos providers: OpenAI, Anthropic, Azure, Groq, etc.
 * 
 * @version 1.0
 * @date 2026-02-06
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { llmProviderFactory, encryptApiKey } from '../servicos/llm-provider-factory';
import { TipoLLM } from '@prisma/client';
import { verificarAutenticacao } from '../middleware/middleware-auth';

const router = Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(verificarAutenticacao);

// Fix: BigInt serialization
(BigInt.prototype as any).toJSON = function () {
    return Number(this);
};

// ====================================
// SCHEMAS DE VALIDAÇÃO
// ====================================

const createConfigSchema = z.object({
    tipoProvider: z.enum(['OPENAI', 'ANTHROPIC', 'AZURE_OPENAI', 'GOOGLE_VERTEX', 'GROQ', 'MISTRAL', 'TOGETHER', 'DEEPSEEK']),
    modeloPreferido: z.string().min(1).max(100),
    apiKey: z.string().min(10).max(500),
    baseUrl: z.union([z.string().url(), z.literal('')]).optional().nullable(),
    priorizacao: z.preprocess(
        (val) => (val ? Number(val) : undefined),
        z.number().int().min(1).max(10).optional()
    )
});

const updateConfigSchema = z.object({
    modeloPreferido: z.string().min(1).max(100).optional(),
    apiKey: z.string().min(10).max(500).optional(),
    baseUrl: z.preprocess(
        (val) => (val === '' ? undefined : val),
        z.string().url().nullable().optional()
    ),
    ativo: z.boolean().optional(),
    priorizacao: z.preprocess(
        (val) => (val ? Number(val) : undefined),
        z.number().int().min(1).max(10).optional()
    )
});

// ====================================
// LISTAR CONFIGURAÇÕES DO TENANT
// ====================================

router.get('/', async (req: any, res: any) => {
    try {
        const tenantId = req.tenantId;

        if (!tenantId) {
            return res.status(401).json({ erro: 'Tenant não identificado' });
        }

        const configs = await prisma.configuracaoLLM.findMany({
            where: { tenantId },
            orderBy: { priorizacao: 'asc' },
            select: {
                id: true,
                tipoProvider: true,
                modeloPreferido: true,
                ativo: true,
                priorizacao: true,
                baseUrl: true,
                totalChamadas: true,
                totalTokensInput: true,
                totalTokensOutput: true,
                custoEstimado: true,
                ultimoUsoEm: true,
                ultimoTesteOk: true,
                ultimoErro: true,
                criadoEm: true,
                atualizadoEm: true,
                // NÃO expor apiKeyCriptografada!
            }
        });

        // Adicionar info de providers disponíveis
        const providersDisponiveis = await llmProviderFactory.listarProvidersDisponiveis(tenantId);

        res.json({
            configs,
            providersDisponiveis,
            providerAtivo: configs.find(c => c.ativo)?.tipoProvider || 'SYSTEM_DEFAULT'
        });

    } catch (error: any) {
        console.error('[ConfigLLM] Erro ao listar:', error);
        res.status(500).json({ erro: 'Erro ao listar configurações' });
    }
});

// ====================================
// OBTER CONFIGURAÇÃO ATIVA
// ====================================

router.get('/ativa', async (req: any, res: any) => {
    try {
        const tenantId = req.tenantId;

        if (!tenantId) {
            return res.status(401).json({ erro: 'Tenant não identificado' });
        }

        const configAtiva = await prisma.configuracaoLLM.findFirst({
            where: { tenantId, ativo: true },
            orderBy: { priorizacao: 'asc' }
        });

        if (!configAtiva) {
            return res.json({
                usandoChaveSistema: true,
                provider: 'ANTHROPIC',
                modelo: 'claude-haiku-4-5-20251001',
                mensagem: 'Usando configuração padrão do sistema'
            });
        }

        res.json({
            usandoChaveSistema: !configAtiva.apiKeyCriptografada,
            provider: configAtiva.tipoProvider,
            modelo: configAtiva.modeloPreferido,
            ultimoUso: configAtiva.ultimoUsoEm,
            totalChamadas: configAtiva.totalChamadas
        });

    } catch (error: any) {
        console.error('[ConfigLLM] Erro ao buscar ativa:', error);
        res.status(500).json({ erro: 'Erro ao buscar configuração ativa' });
    }
});

// ====================================
// CRIAR NOVA CONFIGURAÇÃO
// ====================================

router.post('/', async (req: any, res: any) => {
    try {
        const tenantId = req.tenantId;

        if (!tenantId) {
            return res.status(401).json({ erro: 'Tenant não identificado' });
        }

        const validacao = createConfigSchema.safeParse(req.body);
        if (!validacao.success) {
            return res.status(400).json({
                erro: 'Dados inválidos',
                detalhes: validacao.error.format()
            });
        }

        const { tipoProvider, modeloPreferido, apiKey, baseUrl, priorizacao } = validacao.data;

        // Verificar se já existe config para este provider
        const existente = await prisma.configuracaoLLM.findUnique({
            where: {
                tenantId_tipoProvider: { tenantId, tipoProvider: tipoProvider as TipoLLM }
            }
        });

        if (existente) {
            return res.status(409).json({
                erro: 'Já existe configuração para este provider',
                sugestao: 'Use PUT para atualizar'
            });
        }

        // Criptografar API key
        const apiKeyCriptografada = encryptApiKey(apiKey);

        const config = await prisma.configuracaoLLM.create({
            data: {
                tenantId,
                tipoProvider: tipoProvider as TipoLLM,
                modeloPreferido,
                apiKeyCriptografada,
                baseUrl,
                priorizacao: priorizacao || 1,
                ativo: true
            }
        });

        console.log(`[ConfigLLM] ✅ Nova config criada: ${tenantId} -> ${tipoProvider}`);

        res.status(201).json({
            id: config.id,
            tipoProvider: config.tipoProvider,
            modeloPreferido: config.modeloPreferido,
            ativo: config.ativo,
            mensagem: 'Configuração criada com sucesso'
        });

    } catch (error: any) {
        console.error('[ConfigLLM] Erro ao criar:', error);
        res.status(500).json({ erro: 'Erro ao criar configuração' });
    }
});

// ====================================
// ATUALIZAR CONFIGURAÇÃO
// ====================================

router.put('/:tipoProvider', async (req: any, res: any) => {
    try {
        const tenantId = req.tenantId;
        const { tipoProvider } = req.params;

        if (!tenantId) {
            return res.status(401).json({ erro: 'Tenant não identificado' });
        }

        const validacao = updateConfigSchema.safeParse(req.body);
        if (!validacao.success) {
            return res.status(400).json({
                erro: 'Dados inválidos',
                detalhes: validacao.error.format()
            });
        }

        const existente = await prisma.configuracaoLLM.findUnique({
            where: {
                tenantId_tipoProvider: { tenantId, tipoProvider: tipoProvider as TipoLLM }
            }
        });

        if (!existente) {
            return res.status(404).json({ erro: 'Configuração não encontrada' });
        }

        const updateData: any = {};

        if (validacao.data.modeloPreferido) {
            updateData.modeloPreferido = validacao.data.modeloPreferido;
        }
        if (validacao.data.apiKey) {
            updateData.apiKeyCriptografada = encryptApiKey(validacao.data.apiKey);
        }
        if (validacao.data.baseUrl !== undefined) {
            updateData.baseUrl = validacao.data.baseUrl;
        }
        if (validacao.data.ativo !== undefined) {
            updateData.ativo = validacao.data.ativo;
        }
        if (validacao.data.priorizacao) {
            updateData.priorizacao = validacao.data.priorizacao;
        }

        const config = await prisma.configuracaoLLM.update({
            where: { id: existente.id },
            data: updateData
        });

        console.log(`[ConfigLLM] ✅ Config atualizada: ${tenantId} -> ${tipoProvider}`);

        res.json({
            id: config.id,
            tipoProvider: config.tipoProvider,
            modeloPreferido: config.modeloPreferido,
            ativo: config.ativo,
            mensagem: 'Configuração atualizada com sucesso'
        });

    } catch (error: any) {
        console.error('[ConfigLLM] Erro ao atualizar:', error);
        res.status(500).json({ erro: 'Erro ao atualizar configuração' });
    }
});

// ====================================
// EXCLUIR CONFIGURAÇÃO
// ====================================

router.delete('/:tipoProvider', async (req: any, res: any) => {
    try {
        const tenantId = req.tenantId;
        const { tipoProvider } = req.params;

        if (!tenantId) {
            return res.status(401).json({ erro: 'Tenant não identificado' });
        }

        const existente = await prisma.configuracaoLLM.findUnique({
            where: {
                tenantId_tipoProvider: { tenantId, tipoProvider: tipoProvider as TipoLLM }
            }
        });

        if (!existente) {
            return res.status(404).json({ erro: 'Configuração não encontrada' });
        }

        await prisma.configuracaoLLM.delete({
            where: { id: existente.id }
        });

        console.log(`[ConfigLLM] 🗑️ Config excluída: ${tenantId} -> ${tipoProvider}`);

        res.json({ mensagem: 'Configuração excluída com sucesso' });

    } catch (error: any) {
        console.error('[ConfigLLM] Erro ao excluir:', error);
        res.status(500).json({ erro: 'Erro ao excluir configuração' });
    }
});

// ====================================
// TESTAR CONEXÃO
// ====================================

router.post('/:tipoProvider/testar', async (req: any, res: any) => {
    try {
        const tenantId = req.tenantId;
        const { tipoProvider } = req.params;

        if (!tenantId) {
            return res.status(401).json({ erro: 'Tenant não identificado' });
        }

        const resultado = await llmProviderFactory.testarConexao(tenantId, tipoProvider as TipoLLM);

        if (resultado.sucesso) {
            res.json({
                sucesso: true,
                mensagem: 'Conexão testada com sucesso!'
            });
        } else {
            res.status(400).json({
                sucesso: false,
                erro: resultado.erro || 'Falha no teste de conexão'
            });
        }

    } catch (error: any) {
        console.error('[ConfigLLM] Erro ao testar:', error);
        res.status(500).json({ erro: 'Erro ao testar conexão' });
    }
});

// ====================================
// OBTER MÉTRICAS DE USO
// ====================================

router.get('/metricas', async (req: any, res: any) => {
    try {
        const tenantId = req.tenantId;

        if (!tenantId) {
            return res.status(401).json({ erro: 'Tenant não identificado' });
        }

        const configs = await prisma.configuracaoLLM.findMany({
            where: { tenantId },
            select: {
                tipoProvider: true,
                totalChamadas: true,
                totalTokensInput: true,
                totalTokensOutput: true,
                custoEstimado: true,
                ultimoUsoEm: true
            }
        });

        const totalGeral = configs.reduce((acc, c) => ({
            chamadas: acc.chamadas + c.totalChamadas,
            tokensInput: acc.tokensInput + Number(c.totalTokensInput),
            tokensOutput: acc.tokensOutput + Number(c.totalTokensOutput),
            custo: acc.custo + Number(c.custoEstimado)
        }), { chamadas: 0, tokensInput: 0, tokensOutput: 0, custo: 0 });

        res.json({
            porProvider: configs,
            total: totalGeral
        });

    } catch (error: any) {
        console.error('[ConfigLLM] Erro ao buscar métricas:', error);
        res.status(500).json({ erro: 'Erro ao buscar métricas' });
    }
});

export default router;
