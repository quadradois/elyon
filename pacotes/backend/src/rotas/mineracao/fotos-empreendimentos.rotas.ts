/**
 * Fotos de empreendimentos pela base GEO360 (Lab Captação+Mineração, F1.6).
 *
 * Resolve a foto PRINCIPAL do lote para edifícios (cdedificio) e condomínios
 * horizontais (cdbairro): 1 unidade do empreendimento → imoveis_rancho.id_lote
 * → geo360_midias_lote (principal=1) → link público. Leitura pura em 3 queries.
 * Rota M2M consumida pelo CRM QuadraDois (escopo mineracao:read).
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/db';
import { responderErro } from '../../utilitarios/resposta';

const router = Router();

const LOTE_MAXIMO = 100;

const esquemaCorpo = z
  .object({
    edificios: z.array(z.number().int()).max(LOTE_MAXIMO).optional(),
    condominios: z.array(z.number().int()).max(LOTE_MAXIMO).optional()
  })
  .refine((c) => (c.edificios?.length || 0) + (c.condominios?.length || 0) > 0, {
    message: 'Informe edificios e/ou condominios'
  });

router.post('/fotos-empreendimentos', async (req, res) => {
  const corpo = esquemaCorpo.safeParse(req.body);
  if (!corpo.success) {
    responderErro(res, 400, `Corpo inválido: informe edificios e/ou condominios (máx. ${LOTE_MAXIMO} cada)`);
    return;
  }
  const edificios = corpo.data.edificios ?? [];
  const condominios = corpo.data.condominios ?? [];

  try {
    // 1) Uma unidade representante por empreendimento.
    const unidades = await prisma.imovel.findMany({
      where: {
        OR: [
          ...(edificios.length ? [{ codigoEdificio: { in: edificios } }] : []),
          ...(condominios.length ? [{ codigoBairro: { in: condominios }, codigoEdificio: null }] : [])
        ]
      },
      select: { codigoEdificio: true, codigoBairro: true, inscricaoIptu: true },
      distinct: ['codigoEdificio', 'codigoBairro']
    });
    if (!unidades.length) {
      res.json({ fotos: { edificios: {}, condominios: {} } });
      return;
    }

    // 2) Inscrição → lote (cidade + id_lote).
    const ranchos = await prisma.imovelRancho.findMany({
      where: { inscricaoCartografica: { in: unidades.map((u) => u.inscricaoIptu) } },
      select: { inscricaoCartografica: true, cidade: true, idLote: true }
    });
    const lotePorInscricao = new Map(
      ranchos
        .filter((r) => r.idLote !== null)
        .map((r) => [r.inscricaoCartografica, { cidade: r.cidade, idLote: r.idLote as number }])
    );
    if (!lotePorInscricao.size) {
      res.json({ fotos: { edificios: {}, condominios: {} } });
      return;
    }

    // 3) Foto principal de cada lote.
    const lotes = [...lotePorInscricao.values()];
    const midias = await prisma.geo360MidiaLote.findMany({
      where: {
        principal: 1,
        OR: lotes.map((l) => ({ cidade: l.cidade, idLote: l.idLote }))
      },
      select: { cidade: true, idLote: true, link: true }
    });
    const linkPorLote = new Map(midias.map((m) => [`${m.cidade}:${m.idLote}`, m.link]));

    const fotosEdificios: Record<string, string> = {};
    const fotosCondominios: Record<string, string> = {};
    for (const u of unidades) {
      const lote = lotePorInscricao.get(u.inscricaoIptu);
      if (!lote) continue;
      const link = linkPorLote.get(`${lote.cidade}:${lote.idLote}`);
      if (!link) continue;
      if (u.codigoEdificio !== null && u.codigoEdificio !== undefined) {
        fotosEdificios[String(u.codigoEdificio)] = link;
      } else if (u.codigoBairro !== null && u.codigoBairro !== undefined) {
        fotosCondominios[String(u.codigoBairro)] = link;
      }
    }

    res.json({ fotos: { edificios: fotosEdificios, condominios: fotosCondominios } });
  } catch (erro) {
    responderErro(res, 500, 'Falha ao consultar fotos dos empreendimentos');
  }
});

export default router;
