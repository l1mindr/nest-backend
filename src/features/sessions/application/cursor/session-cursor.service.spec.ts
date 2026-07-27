import { SessionCursorService } from './session-cursor.service';

describe('SessionCursorService', () => {
  const service = new SessionCursorService();

  describe('encode', () => {
    it('should encode a cursor from data', () => {
      const data = {
        lastUsedAt: new Date('2026-07-14T09:00:00.000Z'),
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      };

      const encoded = service.encode(data);

      const decoded = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf-8')
      );
      expect(decoded.lastUsedAt).toBe('2026-07-14T09:00:00.000Z');
      expect(decoded.id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    });
  });

  describe('decode', () => {
    it('should return null when cursor is undefined', () => {
      expect(service.decode(undefined)).toBeNull();
    });

    it('should decode a valid cursor', () => {
      const payload = {
        lastUsedAt: '2026-07-14T09:00:00.000Z',
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      };
      const cursor = Buffer.from(JSON.stringify(payload), 'utf-8').toString(
        'base64url'
      );

      const result = service.decode(cursor);

      expect(result).toEqual({
        lastUsedAt: new Date('2026-07-14T09:00:00.000Z'),
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      });
    });

    it('should throw on invalid base64 cursor', () => {
      expect(() => service.decode('!!!invalid!!!')).toThrow();
    });

    it('should throw when cursor decodes to non-JSON value', () => {
      const cursor = Buffer.from('not-json', 'utf-8').toString('base64url');
      expect(() => service.decode(cursor)).toThrow();
    });

    it('should throw when cursor has missing fields', () => {
      const cursor = Buffer.from(
        JSON.stringify({ lastUsedAt: '2026-07-14T09:00:00.000Z' }),
        'utf-8'
      ).toString('base64url');
      expect(() => service.decode(cursor)).toThrow();
    });

    it('should throw when cursor id is not a UUID', () => {
      const cursor = Buffer.from(
        JSON.stringify({
          lastUsedAt: '2026-07-14T09:00:00.000Z',
          id: 'not-a-uuid'
        }),
        'utf-8'
      ).toString('base64url');
      expect(() => service.decode(cursor)).toThrow();
    });

    it('should throw when cursor has invalid timestamps', () => {
      const cursor = Buffer.from(
        JSON.stringify({
          lastUsedAt: 'not-a-date',
          id: 'aaa-bbbb-cccc-dddd-eeeeeeeeeeee'
        }),
        'utf-8'
      ).toString('base64url');
      expect(() => service.decode(cursor)).toThrow();
    });
  });
});
