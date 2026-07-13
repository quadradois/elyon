import { getTenantId } from '../tenant';
import { Request } from 'express';

function mockReq(overrides: Partial<{
  tenantId: string;
  headers: Record<string, string>;
  query: Record<string, string>;
}>): Request {
  return {
    tenantId: overrides.tenantId,
    headers: overrides.headers || {},
    query: overrides.query || {},
  } as any;
}

describe('getTenantId', () => {
  it('prioriza req.tenantId (middleware)', () => {
    const req = mockReq({
      tenantId: 'tenant-middleware',
      headers: { 'x-tenant-id': 'tenant-header' },
      query: { tenantId: 'tenant-query' },
    });
    expect(getTenantId(req)).toBe('tenant-middleware');
  });

  it('ignora header x-tenant-id controlado pelo cliente', () => {
    const req = mockReq({
      headers: { 'x-tenant-id': 'tenant-header' },
      query: { tenantId: 'tenant-query' },
    });
    expect(getTenantId(req)).toBeNull();
  });

  it('ignora query param tenantId controlado pelo cliente', () => {
    const req = mockReq({
      query: { tenantId: 'tenant-query' },
    });
    expect(getTenantId(req)).toBeNull();
  });

  it('retorna null quando nenhuma fonte tem tenantId', () => {
    const req = mockReq({});
    expect(getTenantId(req)).toBeNull();
  });

  it('não usa fallback quando req.tenantId está ausente', () => {
    const req = mockReq({
      tenantId: undefined,
      headers: { 'x-tenant-id': 'fallback' },
    });
    expect(getTenantId(req)).toBeNull();
  });
});
