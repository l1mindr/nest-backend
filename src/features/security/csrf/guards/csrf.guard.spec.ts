import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from '../csrf.service';

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let csrfService: CsrfService;
  let reflector: Reflector;

  beforeEach(() => {
    csrfService = { validate: jest.fn() } as unknown as CsrfService;
    reflector = new Reflector();
    guard = new CsrfGuard(reflector, csrfService);
  });

  function mockContext(method: string, req: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn()
    } as unknown as ExecutionContext;
  }

  it('should skip when @SkipCsrf() is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);

    const ctx = mockContext('POST', { method: 'POST', cookies: {} });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(csrfService.validate).not.toHaveBeenCalled();
  });

  it('should skip for GET requests', () => {
    const ctx = mockContext('GET', { method: 'GET', cookies: {} });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(csrfService.validate).not.toHaveBeenCalled();
  });

  it('should skip for HEAD requests', () => {
    const ctx = mockContext('HEAD', { method: 'HEAD', cookies: {} });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(csrfService.validate).not.toHaveBeenCalled();
  });

  it('should skip for OPTIONS requests', () => {
    const ctx = mockContext('OPTIONS', {
      method: 'OPTIONS',
      cookies: {}
    });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(csrfService.validate).not.toHaveBeenCalled();
  });

  it('should validate CSRF token for POST using session from request', () => {
    (csrfService.validate as jest.Mock).mockReturnValue(true);

    const req = {
      method: 'POST',
      cookies: { csrf_token: 'valid-token' },
      header: () => 'valid-token',
      session: { id: 'session-123' }
    };

    const ctx = mockContext('POST', req);

    expect(guard.canActivate(ctx)).toBe(true);
    expect(csrfService.validate).toHaveBeenCalledWith(
      'valid-token',
      'valid-token',
      'session-123'
    );
  });

  it('should validate CSRF token for DELETE', () => {
    (csrfService.validate as jest.Mock).mockReturnValue(true);

    const req = {
      method: 'DELETE',
      cookies: { csrf_token: 'tok' },
      header: () => 'tok',
      session: { id: 'sess-1' }
    };

    const ctx = mockContext('DELETE', req);

    expect(guard.canActivate(ctx)).toBe(true);
    expect(csrfService.validate).toHaveBeenCalledWith('tok', 'tok', 'sess-1');
  });

  it('should throw when session is missing', () => {
    const req = {
      method: 'POST',
      cookies: { csrf_token: 'tok' },
      header: () => 'tok',
      session: undefined
    };

    const ctx = mockContext('POST', req);

    expect(() => guard.canActivate(ctx)).toThrow();
    expect(csrfService.validate).toHaveBeenCalledWith('tok', 'tok', undefined);
  });

  it('should throw when CSRF validation fails', () => {
    (csrfService.validate as jest.Mock).mockReturnValue(false);

    const req = {
      method: 'POST',
      cookies: { csrf_token: 'bad' },
      header: () => 'bad',
      session: { id: 'sess-1' }
    };

    const ctx = mockContext('POST', req);

    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('should pass undefined header when x-csrf-token is absent', () => {
    (csrfService.validate as jest.Mock).mockReturnValue(true);

    const req = {
      method: 'POST',
      cookies: { csrf_token: 'tok' },
      header: () => undefined,
      session: { id: 'sess-1' }
    };

    const ctx = mockContext('POST', req);

    guard.canActivate(ctx);
    expect(csrfService.validate).toHaveBeenCalledWith(
      'tok',
      undefined,
      'sess-1'
    );
  });

  it('should pass undefined cookie when csrf_token cookie is absent', () => {
    (csrfService.validate as jest.Mock).mockReturnValue(true);

    const req = {
      method: 'POST',
      cookies: {},
      header: () => 'tok',
      session: { id: 'sess-1' }
    };

    const ctx = mockContext('POST', req);

    guard.canActivate(ctx);
    expect(csrfService.validate).toHaveBeenCalledWith(
      undefined,
      'tok',
      'sess-1'
    );
  });
});
