/**
 * Rotas de Contratos
 * API para geração e aceite de contratos digitais
 */

import { responderErro } from '../utilitarios/resposta';
import { Router, Request, Response } from 'express';
import { getTenantId } from '../utils/tenant';
import {
    gerarContratoCaptacao,
    DadosContratoIncompletosError,
    registrarAceiteContrato,
    buscarContratoPorToken
} from '../contratos/contrato-service';

const router = Router();

// ============================================
// POST /api/contratos/gerar - Gerar contrato para um lead
// ============================================
router.post('/gerar', async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
            return responderErro(res, 401, 'Tenant não identificado');
        }

        const { leadId, tipoContrato = 'CAPTACAO' } = req.body;

        if (!leadId) {
            return responderErro(res, 400, 'leadId é obrigatório');
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
            mensagem: 'Autorização gerada com sucesso!'
        });

    } catch (error: any) {
        if (error instanceof DadosContratoIncompletosError) {
            return responderErro(
                res,
                400,
                'Preencha os dados obrigatórios do contrato no lead antes de gerar a autorização.',
                { faltantes: error.faltantes }
            );
        }
        console.error('[CONTRATOS] Erro ao gerar:', error);
        responderErro(res, 500, 'Erro interno do servidor');
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
            return responderErro(res, 404, 'Contrato não encontrado');
        }

        res.json(contrato);

    } catch (error: any) {
        console.error('[CONTRATOS] Erro ao buscar:', error);
        responderErro(res, 500, 'Erro interno do servidor');
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
            return responderErro(res, 400, resultado.message);
        }

        res.json({
            sucesso: true,
            mensagem: resultado.message
        });

    } catch (error: any) {
        console.error('[CONTRATOS] Erro ao aceitar:', error);
        responderErro(res, 500, 'Erro interno do servidor');
    }
});

// ============================================
// GET /api/contratos/lead/:leadId - Listar contratos de um lead
// ============================================
router.get('/lead/:leadId', async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
            return responderErro(res, 401, 'Tenant não identificado');
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
        responderErro(res, 500, 'Erro interno do servidor');
    }
});

export default router;
