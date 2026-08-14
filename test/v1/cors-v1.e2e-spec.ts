import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../bootstrap/test-app';

describe('CORS preflight (e2e) version: 1', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { app: testApp } = await createTestApp();
    app = testApp;
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('OPTIONS /v1/auth/register (preflight)', () => {
    it('should respond 204 with CORS headers for the allowed origin', async () => {
      const res = await request(app.getHttpServer())
        .options('/v1/auth/register')
        .set('Origin', 'http://localhost:4321')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:4321'
      );
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(
        res.headers['access-control-allow-methods']
          ?.split(',')
          .map((m: string) => m.trim().toUpperCase())
      ).toEqual(expect.arrayContaining(['POST', 'OPTIONS']));
    });

    it('should not echo CORS headers for a disallowed origin', async () => {
      const res = await request(app.getHttpServer())
        .options('/v1/auth/register')
        .set('Origin', 'http://evil.example.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');

      // The CORS middleware must not reflect an untrusted origin.
      expect(res.headers['access-control-allow-origin']).not.toBe(
        'http://evil.example.com'
      );
    });

    it('should not allow wildcard origin', async () => {
      const res = await request(app.getHttpServer())
        .options('/v1/auth/register')
        .set('Origin', 'http://localhost:4321')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');

      // Wildcard '*' and credentials:true are mutually exclusive; the header
      // must always be the explicit origin, never '*'.
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });
  });

  describe('POST /v1/auth/register (actual request)', () => {
    it('should include CORS headers on the actual response', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Origin', 'http://localhost:4321')
        .set('Content-Type', 'application/json')
        .send({
          email: 'cors-test@example.com',
          username: 'corstest',
          password: 'CorrectHorseBattery9!'
        });

      // 201 Created or a business-level error (422) both prove the route exists.
      expect([201, 422]).toContain(res.status);
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:4321'
      );
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });
});
