import { responderErro } from '../utilitarios/resposta';
import { Router } from 'express';
import { sincronizacaoService } from '../servicos/sincronizacao-mapa';

const router = Router();

// Middleware de segurança simples (idealmente usaria auth admin)
const checkAdmin = (req: any, res: any, next: any) => {
    const apiKey = req.headers['x-admin-key'];
    if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
        return responderErro(res, 401, 'Não autorizado');
    }
    next();
};

/**
 * POST /sincronizar/bairros
 * Dispara a sincronização de bairros
 */
router.post('/bairros', checkAdmin, async (req, res) => {
    try {
        // Rodar em background para não travar a req
        sincronizacaoService.sincronizarBairros()
            .then(resultado => {
                console.log('[API] Sincronização de bairros concluída:', resultado);
            })
            .catch(erro => {
                console.error('[API] Erro na sincronização de bairros:', erro);
            });

        return res.json({
            mensagem: 'Sincronização de bairros iniciada em background',
            status: 'PROCESSANDO'
        });
    } catch (error) {
        return responderErro(res, 500, 'Erro ao iniciar sincronização');
    }
});

/**
 * POST /sincronizar/edificios
 * Dispara a sincronização de edifícios
 */
router.post('/edificios', checkAdmin, async (req, res) => {
    try {
        sincronizacaoService.sincronizarEdificios()
            .then(resultado => {
                console.log('[API] Sincronização de edifícios concluída:', resultado);
            })
            .catch(erro => {
                console.error('[API] Erro na sincronização de edifícios:', erro);
            });

        return res.json({
            mensagem: 'Sincronização de edifícios iniciada em background. Isso pode levar alguns minutos.',
            status: 'PROCESSANDO'
        });
    } catch (error) {
        return responderErro(res, 500, 'Erro ao iniciar sincronização');
    }
});

/**
 * POST /sincronizar/unidades
 * Dispara a sincronização de todas as unidades (Heavy Load)
 */
router.post('/unidades', checkAdmin, async (req, res) => {
    try {
        sincronizacaoService.sincronizarUnidades()
            .then(resultado => {
                console.log('[API] Sincronização de unidades concluída:', resultado);
            })
            .catch(erro => {
                console.error('[API] Erro na sincronização de unidades:', erro);
            });

        return res.json({
            mensagem: 'Sincronização de unidades iniciada em background. Isso pode levar VÁRIOS MINUTOS.',
            status: 'PROCESSANDO'
        });
    } catch (error) {
        return responderErro(res, 500, 'Erro ao iniciar sincronização');
    }
});

/**
 * POST /sincronizar/completo
 * Executa sincronização completa (bairros + edifícios + unidades)
 */
router.post('/completo', checkAdmin, async (_req, res) => {
    try {
        sincronizacaoService.sincronizarTudo('manual')
            .then(resultado => {
                console.log('[API] Sincronização completa concluída:', resultado);
            })
            .catch(erro => {
                console.error('[API] Erro na sincronização completa:', erro);
            });

        return res.json({
            mensagem: 'Sincronização completa iniciada em background',
            status: 'PROCESSANDO'
        });
    } catch (error) {
        return responderErro(res, 500, 'Erro ao iniciar sincronização completa');
    }
});

/**
 * GET /sincronizar/status
 * Retorna status da última execução de sincronização completa
 */
router.get('/status', checkAdmin, async (_req, res) => {
    try {
        const ultima = await sincronizacaoService.obterUltimaExecucao();

        return res.json({
            ultimaExecucao: ultima || null
        });
    } catch (error) {
        return responderErro(res, 500, 'Erro ao consultar status da sincronização');
    }
});

export default router;
