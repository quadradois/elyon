/**
 * Unidades de um lote GEO360 (Lab Captação+Mineração, F1.7).
 *
 * A busca por nome retorna empreendimentos da base canônica GEO360
 * (`fonte: 'geo360'`, com `cidade` + `idLote`), enquanto `/unidades/:cdedificio`
 * só enxerga a base legada de edifícios — clicar num resultado de busca dava
 * lista vazia. Esta rota fecha o buraco lendo as unidades direto de
 * `imoveis_rancho` (índice `cidade, id_lote`), no mesmo formato de resposta.
 * Leitura pura e paginada; sem créditos, sem Assertiva, sem scraper.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/db';
import { responderErro } from '../../utilitarios/resposta';

const router = Router();

const LIMITE_PADRAO = 100;
const LIMITE_MAXIMO = 500;

const esquemaQuery = z.object({
  cidade: z.string().trim().min(2),
  idLote: z.coerce.number().int().positive(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().positive().max(LIMITE_MAXIMO).default(LIMITE_PADRAO)
});

router.get('/unidades-lote', async (req, res) => {
  const params = esquemaQuery.safeParse(req.query);
  if (!params.success) {
    responderErro(res, 400, 'Parâmetros inválidos: informe cidade e idLote');
    return;
  }
  const { cidade, idLote, offset, limit } = params.data;

  try {
    const where = { cidade, idLote };
    const [total, imoveis] = await Promise.all([
      prisma.imovelRancho.count({ where }),
      prisma.imovelRancho.findMany({
        where,
        select: {
          inscricaoCartografica: true,
          complemento: true,
          logradouro: true,
          endereco: true,
          bairro: true,
          areaConstruida: true
        },
        orderBy: { inscricaoCartografica: 'asc' },
        skip: offset,
        take: limit
      })
    ]);

    res.json({
      total,
      offset,
      limit,
      hasMore: offset + imoveis.length < total,
      cidade,
      idLote,
      bairro: imoveis[0]?.bairro ?? null,
      unidades: imoveis.map((i) => ({
        nrinscr: i.inscricaoCartografica,
        incompl: i.complemento,
        nmlogradou: i.logradouro ?? i.endereco,
        nmbairro: i.bairro,
        areaedif: i.areaConstruida
      }))
    });
  } catch (erro) {
    responderErro(res, 500, 'Falha ao listar as unidades do lote');
  }
});

export default router;
