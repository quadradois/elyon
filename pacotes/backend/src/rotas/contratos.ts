/**
 * Rotas de Contratos
 * API para geração e aceite de contratos digitais
 */

import { Router, Request, Response } from 'express';
import {
    gerarContratoCaptacao,
    registrarAceiteContrato,
    buscarContratoPorToken
} from '../contratos/contrato-service';

const router = Router();

// Helper para extrair tenant
const getTenantId = (req: Request): string | null => {
    if ((req as any).tenantId) return (req as any).tenantId;
    if (req.headers['x-tenant-id']) return req.headers['x-tenant-id'] as string;
    return null;
};

// ============================================
// POST /api/contratos/gerar - Gerar contrato para um lead
// ============================================
router.post('/gerar', async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
            return res.status(401).json({ erro: 'Tenant não identificado' });
        }

        const { leadId, tipoContrato = 'CAPTACAO' } = req.body;

        if (!leadId) {
            return res.status(400).json({ erro: 'leadId é obrigatório' });
        }

        const resultado = await gerarContratoCaptacao({
            leadId,
            tenantId,
            tipoContrato
        });

        res.json({
            sucesso: true,
            contrato: {
                id: resultado.id,
                hash: resultado.hash,
                linkAceite: resultado.linkAceite
            },
            mensagem: 'Contrato gerado com sucesso!'
        });

    } catch (error: any) {
        console.error('[CONTRATOS] Erro ao gerar:', error);
        res.status(500).json({
            erro: error.message || 'Erro ao gerar contrato'
        });
    }
});

// ============================================
// GET /api/contratos/:token - Visualizar contrato (público)
// ============================================
router.get('/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        const contrato = await buscarContratoPorToken(token);

        if (!contrato) {
            return res.status(404).json({ erro: 'Contrato não encontrado' });
        }

        res.json(contrato);

    } catch (error: any) {
        console.error('[CONTRATOS] Erro ao buscar:', error);
        res.status(500).json({
            erro: error.message || 'Erro ao buscar contrato'
        });
    }
});

// ============================================
// GET /api/contratos/:token/html - Retorna HTML para renderização
// ============================================
router.get('/:token/html', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        const contrato = await buscarContratoPorToken(token);

        if (!contrato) {
            return res.status(404).send('<h1>Contrato não encontrado</h1>');
        }

        // Envia HTML direto para renderização
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(contrato.html);

    } catch (error: any) {
        console.error('[CONTRATOS] Erro ao buscar HTML:', error);
        res.status(500).send('<h1>Erro ao carregar contrato</h1>');
    }
});

// ============================================
// POST /api/contratos/:token/aceitar - Registrar aceite digital
// ============================================
router.post('/:token/aceitar', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        // Capturar dados do aceite
        const ip = req.headers['x-forwarded-for'] as string ||
            req.headers['x-real-ip'] as string ||
            req.socket.remoteAddress ||
            'IP não identificado';

        const userAgent = req.headers['user-agent'] || 'Navegador não identificado';

        const resultado = await registrarAceiteContrato({
            contratoId: token,
            ip: ip.split(',')[0].trim(), // Primeiro IP se houver múltiplos
            userAgent
        });

        if (!resultado.success) {
            return res.status(400).json({
                erro: resultado.message
            });
        }

        res.json({
            sucesso: true,
            mensagem: resultado.message
        });

    } catch (error: any) {
        console.error('[CONTRATOS] Erro ao aceitar:', error);
        res.status(500).json({
            erro: error.message || 'Erro ao registrar aceite'
        });
    }
});

// ============================================
// GET /api/contratos/lead/:leadId - Listar contratos de um lead
// ============================================
router.get('/lead/:leadId', async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
            return res.status(401).json({ erro: 'Tenant não identificado' });
        }

        const { leadId } = req.params;

        const contratos = await (require('../lib/db').prisma as any).contrato.findMany({
            where: {
                leadId,
                tenantId
            },
            orderBy: { geradoEm: 'desc' },
            select: {
                id: true,
                tipo: true,
                status: true,
                tokenAceite: true,
                hashDocumento: true,
                geradoEm: true,
                aceiteEm: true,
                vigenciaInicio: true,
                vigenciaFim: true
            }
        });

        res.json(contratos);

    } catch (error: any) {
        console.error('[CONTRATOS] Erro ao listar:', error);
        res.status(500).json({
            erro: error.message || 'Erro ao listar contratos'
        });
    }
});

export default router;
