import { responderErro } from '../utilitarios/resposta';
import { Router, Request } from 'express';
import { prisma } from '../lib/db';

const router = Router();

// Helper para tenantId (copiado de outros arquivos)
const getTenantId = async (req: Request): Promise<string> => {
    if (req.headers['x-tenant-id']) return req.headers['x-tenant-id'] as string;
    if (req.query.tenantId) return req.query.tenantId as string;

    // Fallback
    const tenant = await prisma.tenant.findFirst({ orderBy: { criadoEm: 'desc' } });
    return tenant?.id || '';
};

/**
 * GET /api/contatos
 * Busca global de contatos em todas as campanhas
 */
router.get('/', async (req, res) => {
    try {
        const tenantId = await getTenantId(req);
        const { busca, page = '1', limit = '20' } = req.query;

        // Filtro de Tenant (leads de prospecção ativa)
        const where: any = {
            tenantId,
            statusProspeccao: { not: null }
        };

        // Filtro de Busca
        if (busca && typeof busca === 'string' && busca.length > 2) {
            where.OR = [
                { nome: { contains: busca, mode: 'insensitive' } },
                { email: { contains: busca, mode: 'insensitive' } },
                { telefone: { contains: busca } },
                { cpf: { contains: busca.replace(/\D/g, '') } },
            ];
        }

        const pagina = Number(page) || 1;
        const itemsPorPagina = Number(limit) || 20;

        const [contatos, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                take: itemsPorPagina,
                skip: (pagina - 1) * itemsPorPagina,
                orderBy: { criadoEm: 'desc' },
                include: {
                    campanhaOrigem: {
                        select: { id: true, nome: true }
                    }
                }
            }),
            prisma.lead.count({ where })
        ]);

        // Formatar resposta
        const dados = contatos.map(c => ({
            id: c.id,
            nome: c.nome,
            telefone: c.telefone,
            email: c.email,
            cpf: c.cpf,
            status: c.statusProspeccao,
            campanha: c.campanhaOrigem?.nome ?? 'Sem campanha',
            campanhaId: c.campanhaOrigemId,
            virouLead: c.statusProspeccao === null,
            leadId: c.id,
            criadoEm: c.criadoEm
        }));

        return res.json({
            data: dados,
            meta: {
                total,
                pagina,
                totalPaginas: Math.ceil(total / itemsPorPagina)
            }
        });

    } catch (error) {
        console.error('[Contatos Global] Erro ao buscar:', error);
        return responderErro(res, 500, 'Erro interno ao buscar contatos');
    }
});

export default router;
