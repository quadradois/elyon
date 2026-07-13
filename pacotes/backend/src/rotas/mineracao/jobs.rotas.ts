/**
 * Rotas de Jobs de Mineração (Assíncrono)
 * 
 * Endpoints:
 * - POST /iniciar: Cria um job e retorna jobId
 * - GET /:id/status: Retorna progresso do job
 * - GET /:id/resultado: Retorna dados quando concluído
 * - DELETE /:id: Cancela job em andamento
 */

import { responderErro } from '../../utilitarios/resposta';
import { Router, Request, Response } from 'express';
import {
    criarJobMineracao,
    obterStatusJob,
    obterResultadoJob,
    cancelarJob,
    ImovelInput
} from '../../servicos/job-mineracao';
import { z } from 'zod';

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const iniciarJobSchema = z.object({
    imoveis: z.array(z.object({
        nrinscr: z.string(),
        nmedificio: z.string().optional(),
        incompl: z.string().optional(),
        nmlogradou: z.string().optional(),
        nmbairro: z.string().optional(),
    }))
});

// ============================================
// ROTAS
// ============================================

/**
 * POST /jobs/iniciar
 * Cria um novo job de mineração
 */
router.post('/iniciar', async (req: Request, res: Response) => {
    try {
        const tenantId = req.tenantId as string;
        if (!tenantId) {
            return responderErro(res, 400, 'Tenant não identificado');
        }

        const { imoveis } = iniciarJobSchema.parse(req.body);

        if (imoveis.length === 0) {
            return responderErro(res, 400, 'Lista de imóveis vazia');
        }

        const modoTeste = req.headers['x-modo-teste'] === 'true';

        console.log(`[JobRoutes] Iniciando job para ${imoveis.length} imóveis (tenant: ${tenantId}, teste: ${modoTeste})`);

        const jobId = await criarJobMineracao(tenantId, imoveis as ImovelInput[], modoTeste);

        return res.status(201).json({
            sucesso: true,
            jobId,
            mensagem: `Job criado para processar ${imoveis.length} imóveis`,
            total: imoveis.length
        });
    } catch (error) {
        console.error('[JobRoutes] Erro ao iniciar job:', error);
        return responderErro(res, 500, 'Erro ao iniciar job de mineração');
    }
});

/**
 * GET /jobs/:id/status
 * Retorna status atual do job (para polling)
 */
router.get('/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const job = await obterStatusJob(id);

        if (!job) {
            return responderErro(res, 404, 'Job não encontrado');
        }

        return res.json({
            sucesso: true,
            job: {
                id: job.id,
                status: job.status,
                total: job.total,
                processados: job.processados,
                sucessos: job.sucessos,
                erros: job.erros,
                creditosConsumidos: job.creditosConsumidos,
                progresso: Math.round((job.processados / job.total) * 100),
                mensagem: job.mensagem,
                criadoEm: job.criadoEm,
                atualizadoEm: job.atualizadoEm
            }
        });
    } catch (error) {
        console.error('[JobRoutes] Erro ao obter status:', error);
        return responderErro(res, 500, 'Erro ao obter status do job');
    }
});

/**
 * GET /jobs/:id/resultado
 * Retorna resultado completo do job (quando concluído)
 */
router.get('/:id/resultado', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const job = await obterResultadoJob(id);

        if (!job) {
            return responderErro(res, 404, 'Job não encontrado');
        }

        if (job.status !== 'concluido') {
            return responderErro(res, 400, 'Job ainda não concluído', {
                status: job.status,
                progresso: Math.round((job.processados / job.total) * 100)
            });
        }

        console.log('[DEBUG] job.proprietarios type:', typeof job.proprietarios);
        console.log('[DEBUG] job.proprietarios isArray:', Array.isArray(job.proprietarios));
        console.log('[DEBUG] job.proprietarios length:', job.proprietarios?.length);

        return res.json({
            sucesso: true,
            proprietarios: job.proprietarios || [],
            creditos: {
                consumidos: job.creditosConsumidos
            },
            estatisticas: {
                total: job.total,
                sucessos: job.sucessos,
                erros: job.erros
            }
        });
    } catch (error) {
        console.error('[JobRoutes] Erro ao obter resultado:', error);
        return responderErro(res, 500, 'Erro ao obter resultado do job');
    }
});

/**
 * DELETE /jobs/:id
 * Cancela um job em andamento
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const cancelado = await cancelarJob(id);

        if (!cancelado) {
            return responderErro(res, 400, 'Não foi possível cancelar o job (já concluído ou não existe)');
        }

        return res.json({
            sucesso: true,
            mensagem: 'Job cancelado com sucesso'
        });
    } catch (error) {
        console.error('[JobRoutes] Erro ao cancelar job:', error);
        return responderErro(res, 500, 'Erro ao cancelar job');
    }
});

export default router;
