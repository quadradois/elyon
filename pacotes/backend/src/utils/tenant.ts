import { Request } from 'express';

/**
 * Extrai o tenantId do request
 * Prioridade: req.tenantId (middleware) > header x-tenant-id > query param
 */
export function getTenantId(req: Request): string | null {
  if ((req as any).tenantId) return (req as any).tenantId;
  if (req.headers['x-tenant-id']) return req.headers['x-tenant-id'] as string;
  if (req.query.tenantId) return req.query.tenantId as string;
  return null;
}
