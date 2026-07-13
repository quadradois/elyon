import { Request } from 'express';

/**
 * Retorna exclusivamente o tenant derivado pelo middleware de autenticação.
 * Header, query e body nunca são fontes de identidade/autorização.
 */
export function getTenantId(req: Request): string | null {
  return req.tenantId || req.usuario?.tenantId || null;
}
