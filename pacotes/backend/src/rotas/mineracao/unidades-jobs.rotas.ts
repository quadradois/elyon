import { responderErro } from '../../utilitarios/resposta';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { criarJobUnidades, obterStatusJobUnidades } from '../../servicos/job-unidades';

const router = Router();

// Schema de validação
const iniciarJobSchema = z.object({
    cdedificio: z.number({ required_error: 'Código do local é obrigatório' }),
    tipo: z.enum(['edificio', 'condominio'], { required_error: 'Tipo do local é obrigatório' }),
    nomeEdificio: z.string().optional()
});

/**
 * POST /iniciar
 * Inicia um job de busca de unidades
 */
router.post('/iniciar', async (req: Request, res: Response) => {
    try {
        const { cdedificio, tipo, nomeEdificio } = iniciarJobSchema.parse(req.body);

        console.log(`[JobUnidadesRoutes] Iniciando job para ${tipo} ${cdedificio}`);

        const jobId = await criarJobUnidades(cdedificio, tipo, nomeEdificio);

        return res.status(201).json({
            sucesso: true,
            jobId,
            mensagem: 'Job de busca iniciado'
        });
    } catch (error) {
        console.error('[JobUnidadesRoutes] Erro ao iniciar job:', error);
        if (error instanceof z.ZodError) {
            return responderErro(res, 400, error.errors[0].message);
        }
        return responderErro(res, 500, 'Erro ao iniciar job');
    }
});

/**
 * GET /:id/status
 * Retorna o status do job
 */
router.get('/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const job = await obterStatusJobUnidades(id);

        if (!job) {
            return responderErro(res, 404, 'Job não encontrado');
        }

        return res.json({
            id: job.id,
            status: job.status,
            mensagem: job.mensagem,
            total: job.total,
            processados: job.processados,
            progresso: job.total > 0 ? Math.round((job.processados / job.total) * 100) : 0
        });
    } catch (error) {
        console.error('[JobUnidadesRoutes] Erro ao consultar status:', error);
        return responderErro(res, 500, 'Erro ao consultar status');
    }
});

/**
 * GET /:id/resultado
 * Retorna o resultado final do job
 */
router.get('/:id/resultado', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const job = await obterStatusJobUnidades(id);

        if (!job) {
            return responderErro(res, 404, 'Job não encontrado');
        }

        if (job.status !== 'concluido') {
            return responderErro(res, 400, 'Job ainda não foi concluído', {status: job.status});
        }

        return res.json({
            unidades: job.unidades,
            total: job.total
        });
    } catch (error) {
        console.error('[JobUnidadesRoutes] Erro ao obter resultado:', error);
        return responderErro(res, 500, 'Erro ao obter resultado');
    }
});

export default router;
