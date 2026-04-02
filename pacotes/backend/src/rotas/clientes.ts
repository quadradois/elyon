
import { responderErro } from '../utilitarios/resposta';
import { Router, Request } from 'express';
import { prisma } from '../lib/db';
import { getTenantId } from '../utils/tenant';

const router = Router();

// GET /api/clientes - Listar clientes do tenant
router.get('/', async (req, res) => {
    try {
        const tenantId = getTenantId(req);

        if (!tenantId) {
            return responderErro(res, 401, 'Não autorizado - tenant não identificado');
        }

        const { busca } = req.query;

        const where: any = {
            tenantId,
            status: 'ATIVO'
        };

        if (busca) {
            where.OR = [
                { nome: { contains: String(busca), mode: 'insensitive' } },
                { email: { contains: String(busca), mode: 'insensitive' } },
                { telefone: { contains: String(busca) } },
                { cpf: { contains: String(busca) } }
            ];
        }

        const clientes = await prisma.cliente.findMany({
            where,
            orderBy: { nome: 'asc' },
            include: {
                lead: {
                    select: {
                        contratoUrl: true,
                        dataAssinatura: true,
                        origem: true
                    }
                }
            }
        });

        res.json(clientes);
    } catch (error) {
        console.error('Erro ao listar clientes:', error);
        responderErro(res, 500, 'Erro interno ao listar clientes');
    }
});

// GET /api/clientes/:id - Detalhes do cliente
router.get('/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;

        if (!tenantId) {
            return responderErro(res, 401, 'Não autorizado - tenant não identificado');
        }

        const cliente = await prisma.cliente.findUnique({
            where: { id },
            include: {
                lead: {
                    include: {
                        imoveis: true,
                        contratos: {
                            orderBy: { criadoEm: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!cliente) {
            return responderErro(res, 404, 'Cliente não encontrado');
        }

        if (cliente.tenantId !== tenantId) {
            return responderErro(res, 403, 'Acesso negado');
        }

        res.json(cliente);
    } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        responderErro(res, 500, 'Erro interno ao buscar cliente');
    }
});

// PATCH /api/clientes/:id - Atualizar cliente
router.patch('/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;
        const dados = req.body;

        if (!tenantId) {
            return responderErro(res, 401, 'Não autorizado - tenant não identificado');
        }

        const cliente = await prisma.cliente.findUnique({ where: { id } });

        if (!cliente) return responderErro(res, 404, 'Cliente não encontrado');
        if (cliente.tenantId !== tenantId) return responderErro(res, 403, 'Acesso negado');

        const camposPermitidos = ['nome', 'email', 'telefone', 'cpf', 'endereco', 'status'];
        const dadosAtualizacao: any = {};

        for (const campo of camposPermitidos) {
            if (dados[campo] !== undefined) {
                dadosAtualizacao[campo] = dados[campo];
            }
        }

        const clienteAtualizado = await prisma.cliente.update({
            where: { id },
            data: dadosAtualizacao
        });

        res.json(clienteAtualizado);

    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        responderErro(res, 500, 'Erro interno');
    }
});

export default router;
