import { INestApplication } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { runMigrations, truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import {
  getCookie,
  getCookieValue,
  normalizeHeader
} from '../utils/cookie.util';

type CsrfCredentials = {
  accessCookie: string;
  refreshCookie: string;
  csrfCookie: string;
  csrfHeader: string;
  sessionId: string;
};

const decodeSessionId = (accessToken: string): string => {
  const payload = JSON.parse(
    Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')
  );

  return payload.sessionId;
};

const forgeCsrfToken = (sessionId: string, expiresAt: number): string => {
  const nonce = randomBytes(32).toString('hex');

  const signature = createHmac('sha256', process.env.CSRF_TOKEN_SECRET!)
    .update(`${nonce}.${expiresAt}.${sessionId}`)
    .digest('hex');

  return `${nonce}.${expiresAt}.${signature}`;
};

describe('CSRF protection (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } = await createTestApp();
    await runMigrations(testDataSource);

    app = testApp;
    dataSource = testDataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const authenticate = async (overrides = {}): Promise<CsrfCredentials> => {
    const {
      response: { login }
    } = await AuthFactory.authenticated(app, { overrides });

    const cookies = normalizeHeader(login.headers['set-cookie']);
    const accessToken = getCookieValue(cookies, 'access_token');

    return {
      accessCookie: getCookie(cookies, 'access_token'),
      refreshCookie: getCookie(cookies, 'refresh_token'),
      csrfCookie: getCookie(cookies, 'csrf_token'),
      csrfHeader: getCookieValue(cookies, 'csrf_token'),
      sessionId: decodeSessionId(accessToken)
    };
  };

  const terminateOthers = (
    credentials: CsrfCredentials,
    csrfHeader?: string
  ) => {
    const req = request(app.getHttpServer())
      .delete('/v1/sessions/others')
      .set(
        'Cookie',
        `${credentials.accessCookie}; ${credentials.refreshCookie}; ${credentials.csrfCookie}`
      );

    if (csrfHeader !== undefined) {
      req.set('X-CSRF-Token', csrfHeader);
    }

    return req;
  };

  it('should accept a mutating request with a valid CSRF token', async () => {
    const credentials = await authenticate();

    const res = await terminateOthers(credentials, credentials.csrfHeader);

    expect(res.status).toBe(204);
  });

  it('should reject a mutating request without the CSRF header', async () => {
    const credentials = await authenticate();

    const res = await terminateOthers(credentials);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_CSRF_TOKEN');
  });

  it('should reject a mutating request with a wrong CSRF token', async () => {
    const credentials = await authenticate();

    const wrongToken = forgeCsrfToken(
      credentials.sessionId,
      Date.now() + 60_000
    );

    const res = await terminateOthers(credentials, wrongToken);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_CSRF_TOKEN');
  });

  it('should reject an expired CSRF token', async () => {
    const credentials = await authenticate();

    // Correctly signed for this session, but already expired.
    const expiredToken = forgeCsrfToken(
      credentials.sessionId,
      Date.now() - 1_000
    );

    const res = await terminateOthers(
      { ...credentials, csrfCookie: `csrf_token=${expiredToken}` },
      expiredToken
    );

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_CSRF_TOKEN');
  });

  it('should reject a CSRF token issued for another session', async () => {
    const victim = await authenticate();
    const attacker = await authenticate({
      email: 'attacker@test.com',
      username: 'attacker'
    });

    // The attacker's cookie/header pair matches, but it is signed for the
    // attacker's session, not the victim's.
    const res = await terminateOthers(
      { ...victim, csrfCookie: attacker.csrfCookie },
      attacker.csrfHeader
    );

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_CSRF_TOKEN');
  });

  it('should reject a legacy unsigned double-submit token', async () => {
    const credentials = await authenticate();

    const legacyToken = randomBytes(32).toString('hex');

    const res = await terminateOthers(
      { ...credentials, csrfCookie: `csrf_token=${legacyToken}` },
      legacyToken
    );

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_CSRF_TOKEN');
  });

  it('should clear the CSRF cookie on logout', async () => {
    const credentials = await authenticate();

    const res = await request(app.getHttpServer())
      .delete('/v1/sessions')
      .set(
        'Cookie',
        `${credentials.accessCookie}; ${credentials.refreshCookie}; ${credentials.csrfCookie}`
      )
      .set('X-CSRF-Token', credentials.csrfHeader);

    expect(res.status).toBe(204);

    const cookies = normalizeHeader(res.headers['set-cookie']);
    const cleared = getCookie(cookies, 'csrf_token');

    expect(cleared).toBe('csrf_token=');
    expect(cookies.find((c) => c.startsWith('csrf_token='))).toContain(
      'Expires=Thu, 01 Jan 1970'
    );
  });
});
