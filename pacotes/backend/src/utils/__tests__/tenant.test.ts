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

  it('usa header x-tenant-id como segunda prioridade', () => {
    const req = mockReq({
      headers: { 'x-tenant-id': 'tenant-header' },
      query: { tenantId: 'tenant-query' },
    });
    expect(getTenantId(req)).toBe('tenant-header');
  });

  it('usa query param como terceira prioridade', () => {
    const req = mockReq({
      query: { tenantId: 'tenant-query' },
    });
    expect(getTenantId(req)).toBe('tenant-query');
  });

  it('retorna null quando nenhuma fonte tem tenantId', () => {
    const req = mockReq({});
    expect(getTenantId(req)).toBeNull();
  });

  it('ignora valores falsy de req.tenantId', () => {
    // se req.tenantId for undefined, deve cair no fallback
    const req = mockReq({
      tenantId: undefined,
      headers: { 'x-tenant-id': 'fallback' },
    });
    expect(getTenantId(req)).toBe('fallback');
  });
});
