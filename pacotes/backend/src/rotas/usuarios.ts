import { Router } from 'express';
import { prisma } from '../lib/db';
import { verificarAutenticacao, verificarAdmin } from '../middleware/middleware-auth';
import { responderErro } from '../utilitarios/resposta';
import { hashSenha } from '../utilitarios/senha';
import { ServicoAuditoria } from '../servicos/servico-auditoria';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function senhaTemporaria(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let senha = '';
    for (let i = 0; i < 10; i++) {
        senha += chars[Math.floor(Math.random() * chars.length)];
    }
    return senha;
}

function camposPublicos(usuario: any) {
    return {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        telefone: usuario.telefone,
        avatar: usuario.avatar,
        estaAtivo: usuario.estaAtivo,
        criadoEm: usuario.criadoEm,
        ultimoLoginEm: usuario.ultimoLoginEm,
    };
}

// ─── GET /usuarios/me — Perfil do usuário logado ──────────────────────────────
router.get('/me', verificarAutenticacao, async (req, res) => {
    try {
        const usuario = await prisma.usuario.findUnique({
            where: { id: req.usuario!.id },
        });
        if (!usuario) return responderErro(res, 404, 'Usuário não encontrado');
        res.json(camposPublicos(usuario));
    } catch (err) {
        console.error('[Usuarios] Erro ao buscar perfil:', err);
        responderErro(res, 500, 'Erro interno');
    }
});

// ─── PUT /usuarios/me — Atualizar próprio perfil ─────────────────────────────
router.put('/me', verificarAutenticacao, async (req, res) => {
    try {
        const { nome, telefone, avatar } = req.body;

        const usuario = await prisma.usuario.update({
            where: { id: req.usuario!.id },
            data: {
                ...(nome && { nome }),
                ...(telefone !== undefined && { telefone }),
                ...(avatar !== undefined && { avatar }),
            },
        });

        ServicoAuditoria.registrar({
            tenantId: req.usuario!.tenantId,
            usuarioId: req.usuario!.id,
            acao: 'EDITAR_PERFIL_PROPRIO',
            entidade: 'Usuario',
            entidadeId: req.usuario!.id,
            detalhes: { campos: Object.keys(req.body) },
            ip: req.socket.remoteAddress || req.headers['x-forwarded-for'] as string
        });

        res.json(camposPublicos(usuario));
    } catch (err) {
        console.error('[Usuarios] Erro ao atualizar perfil:', err);
        responderErro(res, 500, 'Erro interno');
    }
});

// ─── GET /usuarios — Listar todos do tenant ───────────────────────────────────
router.get('/', verificarAdmin, async (req, res) => {
    try {
        const tenantId = req.usuario!.tenantId;
        const pagina = parseInt((req.query.pagina as string) || '1');
        const limite = parseInt((req.query.limite as string) || '20');
        const busca = (req.query.busca as string) || '';

        const where: any = { tenantId };
        if (busca) {
            where.OR = [
                { nome: { contains: busca, mode: 'insensitive' } },
                { email: { contains: busca, mode: 'insensitive' } },
            ];
        }

        const [usuarios, total] = await Promise.all([
            prisma.usuario.findMany({
                where,
                select: {
                    id: true, nome: true, email: true, papel: true,
                    telefone: true, avatar: true, estaAtivo: true,
                    criadoEm: true, ultimoLoginEm: true,
                },
                orderBy: { criadoEm: 'desc' },
                skip: (pagina - 1) * limite,
                take: limite,
            }),
            prisma.usuario.count({ where }),
        ]);

        res.json({
            dados: usuarios,
            paginacao: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
        });
    } catch (err) {
        console.error('[Usuarios] Erro ao listar:', err);
        responderErro(res, 500, 'Erro interno');
    }
});

// ─── POST /usuarios — Criar novo usuário ─────────────────────────────────────
router.post('/', verificarAdmin, async (req, res) => {
    try {
        const { nome, email, papel, telefone } = req.body;
        const tenantId = req.usuario!.tenantId;
        const papelCriador = req.usuario!.papel;

        if (!nome || !email) {
            return responderErro(res, 400, 'Nome e email são obrigatórios');
        }

        // ADMIN não pode criar outro ADMIN ou SUPER_ADMIN
        if (papelCriador === 'ADMIN' && ['ADMIN', 'SUPER_ADMIN'].includes(papel)) {
            return responderErro(res, 403, 'ADMINs só podem criar CORRETORs e VISUALIZADORs');
        }

        const papelFinal = papel || 'CORRETOR';
        const papelValidos = ['ADMIN', 'CORRETOR', 'VISUALIZADOR'];
        if (!papelValidos.includes(papelFinal)) {
            return responderErro(res, 400, `Papel inválido. Use: ${papelValidos.join(', ')}`);
        }

        const jaExiste = await prisma.usuario.findUnique({
            where: { tenantId_email: { tenantId, email } },
        });
        if (jaExiste) return responderErro(res, 409, 'Já existe um usuário com esse email no tenant');

        const senhaGerada = senhaTemporaria();
        const senhaHash = await hashSenha(senhaGerada);

        const usuario = await prisma.usuario.create({
            data: {
                tenantId,
                nome,
                email: email.toLowerCase().trim(),
                senha: senhaHash,
                papel: papelFinal,
                telefone: telefone || null,
            },
        });

        ServicoAuditoria.registrar({
            tenantId,
            usuarioId: req.usuario!.id,
            acao: 'CRIAR_USUARIO',
            entidade: 'Usuario',
            entidadeId: usuario.id,
            detalhes: { email: usuario.email, papel: usuario.papel },
            ip: req.socket.remoteAddress || req.headers['x-forwarded-for'] as string
        });

        // Retorna a senha temporária APENAS na criação (nunca mais)
        res.status(201).json({
            ...camposPublicos(usuario),
            senhaTemporaria: senhaGerada,
        });
    } catch (err) {
        console.error('[Usuarios] Erro ao criar:', err);
        responderErro(res, 500, 'Erro interno');
    }
});

// ─── GET /usuarios/:id — Buscar um usuário ────────────────────────────────────
router.get('/:id', verificarAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.usuario!.tenantId;

        const usuario = await prisma.usuario.findFirst({
            where: { id, tenantId },
        });
        if (!usuario) return responderErro(res, 404, 'Usuário não encontrado');
        res.json(camposPublicos(usuario));
    } catch (err) {
        console.error('[Usuarios] Erro ao buscar:', err);
        responderErro(res, 500, 'Erro interno');
    }
});

// ─── PUT /usuarios/:id — Atualizar usuário ────────────────────────────────────
router.put('/:id', verificarAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, papel, telefone, avatar, estaAtivo } = req.body;
        const tenantId = req.usuario!.tenantId;
        const papelCriador = req.usuario!.papel;

        // Impede desativar a si mesmo
        if (id === req.usuario!.id && estaAtivo === false) {
            return responderErro(res, 400, 'Você não pode desativar a si mesmo');
        }

        // ADMIN não pode promover para ADMIN ou SUPER_ADMIN
        if (papelCriador === 'ADMIN' && papel && ['ADMIN', 'SUPER_ADMIN'].includes(papel)) {
            return responderErro(res, 403, 'ADMINs não podem promover usuários a ADMIN');
        }

        const usuario = await prisma.usuario.findFirst({ where: { id, tenantId } });
        if (!usuario) return responderErro(res, 404, 'Usuário não encontrado');

        const atualizado = await prisma.usuario.update({
            where: { id },
            data: {
                ...(nome && { nome }),
                ...(papel && { papel }),
                ...(telefone !== undefined && { telefone }),
                ...(avatar !== undefined && { avatar }),
                ...(estaAtivo !== undefined && { estaAtivo }),
            },
        });

        ServicoAuditoria.registrar({
            tenantId,
            usuarioId: req.usuario!.id,
            acao: 'EDITAR_USUARIO',
            entidade: 'Usuario',
            entidadeId: id,
            detalhes: { campos: Object.keys(req.body) },
            ip: req.socket.remoteAddress || req.headers['x-forwarded-for'] as string
        });

        res.json(camposPublicos(atualizado));
    } catch (err) {
        console.error('[Usuarios] Erro ao atualizar:', err);
        responderErro(res, 500, 'Erro interno');
    }
});

// ─── DELETE /usuarios/:id — Desativar (soft delete) ──────────────────────────
router.delete('/:id', verificarAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.usuario!.tenantId;

        if (id === req.usuario!.id) {
            return responderErro(res, 400, 'Você não pode desativar a si mesmo');
        }

        const usuario = await prisma.usuario.findFirst({ where: { id, tenantId } });
        if (!usuario) return responderErro(res, 404, 'Usuário não encontrado');

        await prisma.usuario.update({ where: { id }, data: { estaAtivo: false } });
        
        ServicoAuditoria.registrar({
            tenantId,
            usuarioId: req.usuario!.id,
            acao: 'DESATIVAR_USUARIO',
            entidade: 'Usuario',
            entidadeId: id,
            ip: req.socket.remoteAddress || req.headers['x-forwarded-for'] as string
        });

        res.json({ mensagem: 'Usuário desativado com sucesso' });
    } catch (err) {
        console.error('[Usuarios] Erro ao desativar:', err);
        responderErro(res, 500, 'Erro interno');
    }
});

// ─── POST /usuarios/:id/resetar-senha ─────────────────────────────────────────
router.post('/:id/resetar-senha', verificarAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.usuario!.tenantId;

        const usuario = await prisma.usuario.findFirst({ where: { id, tenantId } });
        if (!usuario) return responderErro(res, 404, 'Usuário não encontrado');

        const novaSenha = senhaTemporaria();
        const senhaHash = await hashSenha(novaSenha);

        await prisma.usuario.update({ where: { id }, data: { senha: senhaHash } });

        ServicoAuditoria.registrar({
            tenantId,
            usuarioId: req.usuario!.id,
            acao: 'RESETAR_SENHA',
            entidade: 'Usuario',
            entidadeId: id,
            ip: req.socket.remoteAddress || req.headers['x-forwarded-for'] as string
        });

        res.json({
            mensagem: 'Senha resetada com sucesso',
            senhaTemporaria: novaSenha,
        });
    } catch (err) {
        console.error('[Usuarios] Erro ao resetar senha:', err);
        responderErro(res, 500, 'Erro interno');
    }
});

export default router;
