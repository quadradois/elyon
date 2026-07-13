/**
 * Rota de Documentos do Lead
 *
 * GET  /api/leads/:id/documentos    — lista documentos do lead
 * DELETE /api/leads/:id/documentos/:docId — remove documento
 * GET  /api/leads/:id/documentos/:docId/download — download via signed URL
 */

import { responderErro } from '../utilitarios/resposta';
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../lib/s3';
import { getTenantId } from '../utils/tenant';

const router = Router();

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'rag-eloyn';

// Extensão → mimeType mapeamento de exibição
function classificarTipoMime(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'imagem';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'documento';
}

async function validarAcessoLead(leadId: string, tenantId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, tenantId: true }
  });

  if (!lead) return { ok: false as const, status: 404 as const, erro: 'Lead não encontrado' };
  if (lead.tenantId !== tenantId) {
    console.warn(`[SECURITY][DOCS] Acesso cruzado bloqueado: lead=${leadId} tenantReq=${tenantId} tenantLead=${lead.tenantId}`);
    return { ok: false as const, status: 403 as const, erro: 'Acesso negado' };
  }

  return { ok: true as const, lead };
}

// ─────────────────────────────────────────────────
// GET /api/leads/:id/documentos
// ─────────────────────────────────────────────────
router.get('/:id/documentos', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id: leadId } = req.params;

    const acesso = await validarAcessoLead(leadId, tenantId);
    if (!acesso.ok) {
      return responderErro(res, acesso.status, acesso.erro);
    }

    const documentos = await (prisma as any).documentoLead.findMany({
      where: { leadId },
      orderBy: { criadoEm: 'desc' },
    });

    res.json({ documentos });
  } catch (error) {
    console.error('[DocumentosLead] Erro ao listar:', error);
    responderErro(res, 500, 'Erro ao buscar documentos do lead.');
  }
});

// ─────────────────────────────────────────────────
// GET /api/leads/:id/documentos/:docId/download
// Retorna signed URL válida por 5 minutos
// ─────────────────────────────────────────────────
router.get('/:id/documentos/:docId/download', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id: leadId, docId } = req.params;

    const acesso = await validarAcessoLead(leadId, tenantId);
    if (!acesso.ok) {
      return responderErro(res, acesso.status, acesso.erro);
    }

    const doc = await (prisma as any).documentoLead.findFirst({
      where: { id: docId, leadId },
    });

    if (!doc) return responderErro(res, 404, 'Documento não encontrado.');

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: doc.s3Key,
    });

    // cast: @aws-sdk/client-s3 e s3-request-presigner estão em versões
    // diferentes no package.json e trazem cópias distintas dos tipos @smithy.
    const url = await getSignedUrl(s3Client as any, command, { expiresIn: 300 });
    res.json({ url });
  } catch (error) {
    console.error('[DocumentosLead] Erro ao gerar URL:', error);
    responderErro(res, 500, 'Erro ao gerar URL de download.');
  }
});

// ─────────────────────────────────────────────────
// DELETE /api/leads/:id/documentos/:docId
// ─────────────────────────────────────────────────
router.delete('/:id/documentos/:docId', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { id: leadId, docId } = req.params;

    const acesso = await validarAcessoLead(leadId, tenantId);
    if (!acesso.ok) {
      return responderErro(res, acesso.status, acesso.erro);
    }

    const doc = await (prisma as any).documentoLead.findFirst({
      where: { id: docId, leadId },
    });

    if (!doc) return responderErro(res, 404, 'Documento não encontrado.');

    // Deletar do S3
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: doc.s3Key,
      }));
    } catch (s3Err) {
      console.warn('[DocumentosLead] Falha ao deletar do S3 (continua):', s3Err);
    }

    // Deletar do banco
    await (prisma as any).documentoLead.delete({ where: { id: docId } });

    res.json({ sucesso: true });
  } catch (error) {
    console.error('[DocumentosLead] Erro ao deletar:', error);
    responderErro(res, 500, 'Erro ao remover documento.');
  }
});

// Exportar helper para uso no webhook
export { classificarTipoMime, BUCKET_NAME };

export default router;
