import { NextFunction, Request, Response } from 'express';
import { responderErro } from '../utilitarios/resposta';
import { verificarAutenticacao } from './middleware-auth';

interface RotaPublica {
  metodo: string;
  caminho: string;
}

// Toda nova rota nasce privada. Inclusões nesta lista exigem revisão de segurança.
export const ROTAS_PUBLICAS: readonly RotaPublica[] = Object.freeze([
  { metodo: 'GET', caminho: '/health' },
  { metodo: 'GET', caminho: '/api/saude' },
  { metodo: 'POST', caminho: '/api/auth/login' },
  { metodo: 'POST', caminho: '/api/auth/admin-login' },
  { metodo: 'POST', caminho: '/api/auth/refresh' },
  { metodo: 'GET', caminho: '/api/billing/pacotes' },
  { metodo: 'POST', caminho: '/api/billing/webhook/asaas' },
  { metodo: 'POST', caminho: '/webhooks' },
  { metodo: 'POST', caminho: '/webhooks/manus' }
]);

function normalizarCaminho(caminho: string): string {
  if (caminho.length > 1 && caminho.endsWith('/')) return caminho.slice(0, -1);
  return caminho;
}

export function ehRotaPublica(req: Pick<Request, 'method' | 'path'>): boolean {
  if (req.method.toUpperCase() === 'OPTIONS') return true;
  const caminho = normalizarCaminho(req.path);
  return ROTAS_PUBLICAS.some((rota) => rota.metodo === req.method.toUpperCase() && rota.caminho === caminho);
}

function valorTenant(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const normalizado = valor.trim();
  return normalizado || undefined;
}

function podeUsarAlvoAdministrativo(req: Request, canal: 'query' | 'body'): boolean {
  if (req.usuario?.papel !== 'SUPER_ADMIN') return false;
  if (canal === 'query') return req.path.startsWith('/api/admin/auditoria');
  return req.path.startsWith('/api/billing/admin/');
}

/**
 * Contenção compatível com handlers legados: rejeita divergência e substitui
 * canais controlados pelo cliente pelo tenant já derivado do usuário.
 */
export function normalizarContextoTenant(req: Request, res: Response, next: NextFunction): void {
  const tenantId = req.usuario?.tenantId || req.tenantId;
  if (!tenantId) {
    responderErro(res, 403, 'Usuário autenticado sem tenant associado');
    return;
  }

  const tenantHeader = valorTenant(req.headers['x-tenant-id']);
  const tenantQuery = valorTenant(req.query?.tenantId);
  const tenantBody = valorTenant(req.body?.tenantId);

  if (tenantHeader && tenantHeader !== tenantId) {
    responderErro(res, 403, 'Tenant informado diverge da identidade autenticada');
    return;
  }
  if (tenantQuery && tenantQuery !== tenantId && !podeUsarAlvoAdministrativo(req, 'query')) {
    responderErro(res, 403, 'Tenant informado diverge da identidade autenticada');
    return;
  }
  if (tenantBody && tenantBody !== tenantId && !podeUsarAlvoAdministrativo(req, 'body')) {
    responderErro(res, 403, 'Tenant informado diverge da identidade autenticada');
    return;
  }

  req.tenantId = tenantId;
  // Compatibilidade transitória; estes fallbacks serão removidos na onda seguinte.
  req.headers['x-tenant-id'] = tenantId;
  if (!podeUsarAlvoAdministrativo(req, 'query')) req.query.tenantId = tenantId;
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && !podeUsarAlvoAdministrativo(req, 'body')) {
    req.body.tenantId = tenantId;
  }
  next();
}

export function exigirAutenticacaoPorPadrao(req: Request, res: Response, next: NextFunction): void {
  if (ehRotaPublica(req)) {
    next();
    return;
  }
  void verificarAutenticacao(req, res, () => normalizarContextoTenant(req, res, next));
}
