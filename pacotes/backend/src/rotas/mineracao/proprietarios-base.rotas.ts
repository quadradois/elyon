/**
 * Identificação de proprietários em lote pela base local (imoveis_rancho).
 *
 * Rota M2M do Lab Captação+Mineração (F1.2): leitura pura em um único
 * findMany — sem créditos, sem Assertiva, sem scraper, sem delay de batch.
 * Consumida pelo CRM QuadraDois via API key (escopo mineracao:read).
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/db';
import { responderErro } from '../../utilitarios/resposta';

const router = Router();

const LOTE_MAXIMO = 500;

const esquemaCorpo = z.object({
  inscricoes: z.array(z.string().trim().min(1)).min(1).max(LOTE_MAXIMO)
});

router.post('/proprietarios-base', async (req, res) => {
  const corpo = esquemaCorpo.safeParse(req.body);
  if (!corpo.success) {
    responderErro(res, 400, `Corpo inválido: informe inscricoes (1 a ${LOTE_MAXIMO} inscrições cartográficas)`);
    return;
  }

  try {
    const imoveis = await prisma.imovelRancho.findMany({
      where: { inscricaoCartografica: { in: corpo.data.inscricoes } },
      select: { inscricaoCartografica: true, nomePessoa: true, cpfCnpj: true, tipoPessoa: true }
    });

    res.json({
      total: imoveis.length,
      proprietarios: imoveis.map((imovel) => ({
        inscricao: imovel.inscricaoCartografica,
        nomePessoa: imovel.nomePessoa,
        cpfCnpj: imovel.cpfCnpj,
        tipoPessoa: imovel.tipoPessoa
      }))
    });
  } catch (erro) {
    responderErro(res, 500, 'Falha ao consultar a base local de proprietários');
  }
});

export default router;
