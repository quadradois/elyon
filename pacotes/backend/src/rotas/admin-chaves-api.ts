/**
 * Administração de chaves de API M2M (Lab Captação+Mineração, F1.2).
 *
 * Exclusiva de SUPER_ADMIN. A chave em claro (`ely_<32 hex>`) é exibida
 * UMA única vez na resposta de criação; o banco guarda apenas o hash
 * SHA-256 (middleware-api-key.ts autentica pelo header x-api-key).
 */
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { hashChaveApi } from '../middleware/middleware-api-key';
import { verificarSuperAdmin } from '../middleware/middleware-auth';
import { responderErro } from '../utilitarios/resposta';

const router = Router();

const esquemaCriacao = z.object({
  nome: z.string().trim().min(1),
  escopos: z.array(z.string().trim().min(1)).min(1),
  expiraEm: z.coerce.date().optional()
});

// POST /api/admin/chaves-api — cria e exibe a chave uma única vez
router.post('/', verificarSuperAdmin, async (req, res) => {
  const corpo = esquemaCriacao.safeParse(req.body);
  if (!corpo.success) {
    responderErro(res, 400, 'Corpo inválido: informe nome e ao menos um escopo');
    return;
  }

  const chave = `ely_${randomBytes(16).toString('hex')}`;

  try {
    const registro = await prisma.chaveApi.create({
      data: {
        nome: corpo.data.nome,
        prefixo: chave.slice(0, 8),
        chaveHash: hashChaveApi(chave),
        escopos: corpo.data.escopos,
        expiraEm: corpo.data.expiraEm ?? null
      }
    });

    res.status(201).json({
      id: registro.id,
      nome: registro.nome,
      prefixo: registro.prefixo,
      escopos: registro.escopos,
      chave,
      aviso: 'Guarde esta chave agora: ela não será exibida novamente.'
    });
  } catch (erro) {
    responderErro(res, 500, 'Falha ao criar a chave de API');
  }
});

// PATCH /api/admin/chaves-api/:id — desativa (revogação imediata)
router.patch('/:id', verificarSuperAdmin, async (req, res) => {
  try {
    const registro = await prisma.chaveApi.update({
      where: { id: req.params.id },
      data: { ativa: false }
    });
    res.json({ id: registro.id, ativa: registro.ativa });
  } catch (erro) {
    responderErro(res, 404, 'Chave não encontrada');
  }
});

export default router;
