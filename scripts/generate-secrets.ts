import { randomBytes } from 'crypto';

const makeSecret = (length: number): string =>
  randomBytes(Math.ceil((length * 3) / 4))
    .toString('base64url')
    .slice(0, length);

const mode = process.argv[2] === 'production' ? 'production' : 'test';

const specs = {
  production: { access: 64, refresh: 64, csrf: 32 },
  test: { access: 32, refresh: 32, csrf: 16 }
}[mode];

console.log('ACCESS_TOKEN_SECRET=' + makeSecret(specs.access));
console.log('REFRESH_TOKEN_SECRET=' + makeSecret(specs.refresh));
console.log('CSRF_TOKEN_SECRET=' + makeSecret(specs.csrf));
