/**
 * API de Configuração de Integrações
 * 
 * Endpoints para gerenciar integrações CRM por tenant
 * 
 * @version 1.0
 * @date 22/12/2025
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { criptografar, descriptografar } from '../lib/crypto';
import { TipoIntegracao } from '@prisma/client';
import { verificarAutenticacao } from '../middleware/middleware-auth';

const router = Router();

/**
 * GET /api/configuracao/integracao
 * Lista todas as integrações do tenant
 */
router.get('/', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).tenantId;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant ID obrigatório' });
        }

        const integracoes = await prisma.configuracaoIntegracao.findMany({
            where: { tenantId },
            select: {
                id: true,
                tipo: true,
                nome: true,
                apiUrl: true,
                // Não retorna apiKeyCriptografada por segurança
                tenantIdDestino: true,
                ativo: true,
                ultimoTesteEm: true,
                ultimoTesteOk: true,
                ultimoErro: true,
                totalEnvios: true,
                totalSucessos: true,
                totalFalhas: true,
                ultimoEnvioEm: true,
                criadoEm: true,
                atualizadoEm: true
            }
        });

        return res.json({
            success: true,
            integracoes,
            total: integracoes.length
        });
    } catch (error) {
        console.error('[API] Erro ao listar integrações:', error);
        return res.status(500).json({ success: false, error: 'Erro interno' });
    }
});

/**
 * GET /api/configuracao/integracao/:tipo
 * Busca configuração específica por tipo
 */
router.get('/:tipo', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).tenantId;
        const { tipo } = req.params;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant ID obrigatório' });
        }

        const integracao = await prisma.configuracaoIntegracao.findUnique({
            where: {
                tenantId_tipo: {
                    tenantId,
                    tipo: tipo as TipoIntegracao
                }
            }
        });

        if (!integracao) {
            return res.json({ success: true, configurada: false, integracao: null });
        }

        // Retorna sem a chave criptografada
        const { apiKeyCriptografada, ...integracaoSemChave } = integracao;

        return res.json({
            success: true,
            configurada: true,
            integracao: {
                ...integracaoSemChave,
                temApiKey: !!apiKeyCriptografada
            }
        });
    } catch (error) {
        console.error('[API] Erro ao buscar integração:', error);
        return res.status(500).json({ success: false, error: 'Erro interno' });
    }
});

/**
 * POST /api/configuracao/integracao
 * Cria ou atualiza configuração de integração
 */
router.post('/', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).tenantId;
        const { tipo, nome, apiUrl, apiKey, tenantIdDestino } = req.body;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant ID obrigatório' });
        }

        if (!tipo || !apiUrl) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: tipo, apiUrl'
            });
        }

        // Criptografar API Key se fornecida
        const apiKeyCriptografada = apiKey ? criptografar(apiKey) : undefined;

        // Upsert: cria ou atualiza
        const integracao = await prisma.configuracaoIntegracao.upsert({
            where: {
                tenantId_tipo: {
                    tenantId,
                    tipo: tipo as TipoIntegracao
                }
            },
            create: {
                tenantId,
                tipo: tipo as TipoIntegracao,
                nome: nome || 'CRM Principal',
                apiUrl,
                apiKeyCriptografada: apiKeyCriptografada || '',
                tenantIdDestino: tenantIdDestino ? parseInt(tenantIdDestino) : null
            },
            update: {
                nome: nome || undefined,
                apiUrl,
                ...(apiKeyCriptografada && { apiKeyCriptografada }),
                tenantIdDestino: tenantIdDestino ? parseInt(tenantIdDestino) : undefined
            }
        });

        console.log(`[API] Integração ${tipo} configurada para tenant ${tenantId}`);

        return res.json({
            success: true,
            message: 'Integração configurada com sucesso',
            id: integracao.id
        });
    } catch (error) {
        console.error('[API] Erro ao salvar integração:', error);
        return res.status(500).json({ success: false, error: 'Erro interno' });
    }
});

/**
 * POST /api/configuracao/integracao/:tipo/testar
 * Testa conexão com a integração
 */
router.post('/:tipo/testar', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).tenantId;
        const { tipo } = req.params;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant ID obrigatório' });
        }

        const integracao = await prisma.configuracaoIntegracao.findUnique({
            where: {
                tenantId_tipo: {
                    tenantId,
                    tipo: tipo as TipoIntegracao
                }
            }
        });

        if (!integracao) {
            return res.status(404).json({
                success: false,
                error: 'Integração não configurada'
            });
        }

        // Descriptografar API Key
        let apiKey = '';
        try {
            apiKey = descriptografar(integracao.apiKeyCriptografada);
        } catch {
            await prisma.configuracaoIntegracao.update({
                where: { id: integracao.id },
                data: {
                    ultimoTesteEm: new Date(),
                    ultimoTesteOk: false,
                    ultimoErro: 'Falha ao descriptografar API Key'
                }
            });
            return res.status(400).json({ success: false, error: 'API Key inválida' });
        }

        // Testar conexão
        try {
            const testUrl = `${integracao.apiUrl}/leads/from-elyon/test`;
            const response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'X-Tenant-Id': integracao.tenantIdDestino?.toString() || '1'
                }
            });

            const isOk = response.status === 200 || response.status === 404; // 404 é esperado para test

            await prisma.configuracaoIntegracao.update({
                where: { id: integracao.id },
                data: {
                    ultimoTesteEm: new Date(),
                    ultimoTesteOk: isOk,
                    ultimoErro: isOk ? null : `HTTP ${response.status}`
                }
            });

            if (isOk) {
                return res.json({
                    success: true,
                    message: 'Conexão estabelecida com sucesso!'
                });
            } else {
                return res.json({
                    success: false,
                    error: `Erro HTTP ${response.status}`
                });
            }
        } catch (fetchError: any) {
            await prisma.configuracaoIntegracao.update({
                where: { id: integracao.id },
                data: {
                    ultimoTesteEm: new Date(),
                    ultimoTesteOk: false,
                    ultimoErro: fetchError.message || 'Erro de conexão'
                }
            });

            return res.json({
                success: false,
                error: fetchError.message || 'Não foi possível conectar'
            });
        }
    } catch (error) {
        console.error('[API] Erro ao testar integração:', error);
        return res.status(500).json({ success: false, error: 'Erro interno' });
    }
});

/**
 * DELETE /api/configuracao/integracao/:tipo
 * Remove configuração de integração
 */
router.delete('/:tipo', verificarAutenticacao, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).tenantId;
        const { tipo } = req.params;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant ID obrigatório' });
        }

        await prisma.configuracaoIntegracao.delete({
            where: {
                tenantId_tipo: {
                    tenantId,
                    tipo: tipo as TipoIntegracao
                }
            }
        });

        return res.json({ success: true, message: 'Integração removida' });
    } catch (error) {
        console.error('[API] Erro ao remover integração:', error);
        return res.status(500).json({ success: false, error: 'Erro interno' });
    }
});

export default router;
