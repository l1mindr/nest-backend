import * as Joi from 'joi';

// Allowed environments
const NODE_ENVS = ['development', 'production', 'test', 'staging'] as const;

function shannonEntropy(s: string): number {
  if (!s || s.length === 0) return 0;
  const freq: Record<string, number> = {};
  for (const ch of s) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  let entropy = 0;
  const len = s.length;
  for (const k of Object.keys(freq)) {
    const p = freq[k] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy; // bits per character
}

function secretValidator(minLength: number, minEntropyPerChar: number) {
  return Joi.string()
    .min(minLength)
    .custom((value, helpers) => {
      const entropy = shannonEntropy(value);
      if (entropy < minEntropyPerChar) {
        return helpers.error('any.custom', {
          message: `insufficient entropy: ${entropy.toFixed(2)} bits/char (required >= ${minEntropyPerChar})`
        });
      }
      return value;
    }, 'Entropy validation');
}

export const ENV_VALIDATION_SCHEMA = Joi.object({
  DATA_SOURCE_USERNAME: Joi.string().min(1).required(),
  DATA_SOURCE_PASSWORD: Joi.string().min(1).required(),
  DATA_SOURCE_HOST: Joi.alternatives()
    .try(Joi.string().hostname(), Joi.string().ip())
    .required(),
  DATA_SOURCE_PORT: Joi.number().integer().min(1).max(65535).required(),
  DATA_SOURCE_DATABASE: Joi.string().min(1).required(),

  DATA_SOURCE_POOL_SIZE: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .optional()
    .messages({
      'number.base': 'DATA_SOURCE_POOL_SIZE must be a valid integer.',
      'number.integer': 'DATA_SOURCE_POOL_SIZE must be a valid integer.',
      'number.min': 'DATA_SOURCE_POOL_SIZE must be between 1 and 100.',
      'number.max': 'DATA_SOURCE_POOL_SIZE must be between 1 and 100.'
    }),
  DATA_SOURCE_CONNECT_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(60000)
    .default(10000)
    .optional()
    .messages({
      'number.base':
        'DATA_SOURCE_CONNECT_TIMEOUT_MS must be a valid integer in milliseconds.',
      'number.integer':
        'DATA_SOURCE_CONNECT_TIMEOUT_MS must be a valid integer in milliseconds.',
      'number.min':
        'DATA_SOURCE_CONNECT_TIMEOUT_MS must be between 1000 and 60000 milliseconds.',
      'number.max':
        'DATA_SOURCE_CONNECT_TIMEOUT_MS must be between 1000 and 60000 milliseconds.'
    }),
  DATA_SOURCE_IDLE_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(600000)
    .default(30000)
    .optional()
    .messages({
      'number.base':
        'DATA_SOURCE_IDLE_TIMEOUT_MS must be a valid integer in milliseconds.',
      'number.integer':
        'DATA_SOURCE_IDLE_TIMEOUT_MS must be a valid integer in milliseconds.',
      'number.min':
        'DATA_SOURCE_IDLE_TIMEOUT_MS must be between 1000 and 600000 milliseconds.',
      'number.max':
        'DATA_SOURCE_IDLE_TIMEOUT_MS must be between 1000 and 600000 milliseconds.'
    }),

  REDIS_HOST: Joi.alternatives()
    .try(Joi.string().hostname(), Joi.string().ip())
    .required(),
  REDIS_PORT: Joi.number().integer().min(1).max(65535).required(),
  REDIS_PASSWORD: Joi.when('NODE_ENV', {
    is: 'production',
    then: secretValidator(16, 3.0).required(),
    otherwise: Joi.string().optional().allow('', null)
  }),
  REDIS_DB: Joi.number().integer().min(0).optional(),

  MAX_ACTIVE_SESSIONS: Joi.number().integer().min(5).required(),

  APP_NAME: Joi.string().min(1).max(60).default('NestJS Backend').optional(),

  // Public base URL of the deployment. Advertised as a server entry in the
  // OpenAPI document so generated clients target the right host.
  PUBLIC_API_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .optional()
    .messages({
      'string.uri': 'PUBLIC_API_URL must be an absolute http(s) URL.'
    }),

  EMAIL_HOST: Joi.alternatives()
    .try(Joi.string().hostname(), Joi.string().ip())
    .required(),
  EMAIL_PORT: Joi.number()
    .integer()
    .min(1)
    .max(65535)
    .default(587)
    .optional()
    .messages({
      'number.base': 'EMAIL_PORT must be a valid integer.',
      'number.integer': 'EMAIL_PORT must be a valid integer.',
      'number.min': 'EMAIL_PORT must be between 1 and 65535.',
      'number.max': 'EMAIL_PORT must be between 1 and 65535.'
    }),
  EMAIL_SECURE: Joi.boolean().default(false).optional(),
  EMAIL_USER: Joi.string().min(1).required().messages({
    'string.empty': 'EMAIL_USER is required for SMTP authentication.'
  }),
  EMAIL_APP_PASSWORD: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().min(8).required()
  }).messages({
    'string.empty': 'EMAIL_APP_PASSWORD is required for SMTP authentication.',
    'string.min': 'EMAIL_APP_PASSWORD must be at least {#limit} characters.'
  }),
  EMAIL_FROM: Joi.string().min(3).required().messages({
    'string.empty': 'EMAIL_FROM is required as the sender address.'
  }),

  // Namespaces every BullMQ key so deployments sharing a Redis instance do not
  // consume each other's jobs.
  QUEUE_PREFIX: Joi.string().min(1).max(40).default('bull').optional(),

  // Email delivery is queued and retried; see docs/email.md for how these
  // interact with the verification code lifetime.
  EMAIL_QUEUE_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(5)
    .optional()
    .messages({
      'number.min': 'EMAIL_QUEUE_ATTEMPTS must be at least 1.',
      'number.max': 'EMAIL_QUEUE_ATTEMPTS must be between 1 and 20.'
    }),
  EMAIL_QUEUE_BACKOFF_MS: Joi.number()
    .integer()
    .min(100)
    .max(300000)
    .default(5000)
    .optional()
    .messages({
      'number.min':
        'EMAIL_QUEUE_BACKOFF_MS must be between 100 and 300000 milliseconds.',
      'number.max':
        'EMAIL_QUEUE_BACKOFF_MS must be between 100 and 300000 milliseconds.'
    }),
  EMAIL_QUEUE_KEEP_COMPLETED: Joi.number()
    .integer()
    .min(0)
    .max(100000)
    .default(100)
    .optional(),
  EMAIL_QUEUE_KEEP_FAILED: Joi.number()
    .integer()
    .min(0)
    .max(100000)
    .default(1000)
    .optional(),
  // Caps how long publishing may block a request when Redis is unreachable.
  EMAIL_QUEUE_PUBLISH_TIMEOUT_MS: Joi.number()
    .integer()
    .min(100)
    .max(30000)
    .default(2000)
    .optional()
    .messages({
      'number.max':
        'EMAIL_QUEUE_PUBLISH_TIMEOUT_MS must not exceed 30000 milliseconds; publishing is on the request path.'
    }),

  // Asset catalogue synchronization from CoinGecko. The recurring BullMQ job
  // fires every ASSET_SYNC_INTERVAL seconds; a failed run is retried with
  // exponential backoff rather than never, since a temporary CoinGecko outage
  // must not delete or corrupt the persisted catalogue.
  ASSET_SYNC_INTERVAL: Joi.number()
    .integer()
    .min(300)
    .max(604800)
    .default(3600)
    .optional()
    .messages({
      'number.min':
        'ASSET_SYNC_INTERVAL must be at least 300 seconds (5 minutes).',
      'number.max':
        'ASSET_SYNC_INTERVAL must not exceed 604800 seconds (7 days).'
    }),
  ASSET_SYNC_QUEUE_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(4)
    .optional()
    .messages({
      'number.min': 'ASSET_SYNC_QUEUE_ATTEMPTS must be at least 1.',
      'number.max': 'ASSET_SYNC_QUEUE_ATTEMPTS must be between 1 and 20.'
    }),
  ASSET_SYNC_QUEUE_BACKOFF_MS: Joi.number()
    .integer()
    .min(1000)
    .max(1800000)
    .default(60000)
    .optional()
    .messages({
      'number.min':
        'ASSET_SYNC_QUEUE_BACKOFF_MS must be at least 1000 milliseconds.',
      'number.max':
        'ASSET_SYNC_QUEUE_BACKOFF_MS must not exceed 1800000 milliseconds.'
    }),
  ASSET_SYNC_QUEUE_KEEP_COMPLETED: Joi.number()
    .integer()
    .min(0)
    .max(100000)
    .default(10)
    .optional(),
  ASSET_SYNC_QUEUE_KEEP_FAILED: Joi.number()
    .integer()
    .min(0)
    .max(100000)
    .default(50)
    .optional(),
  // Caps how long enqueuing a manual sync may block the request when Redis is
  // unreachable.
  ASSET_SYNC_QUEUE_PUBLISH_TIMEOUT_MS: Joi.number()
    .integer()
    .min(100)
    .max(30000)
    .default(2000)
    .optional()
    .messages({
      'number.max':
        'ASSET_SYNC_QUEUE_PUBLISH_TIMEOUT_MS must not exceed 30000 milliseconds; publishing is on the request path.'
    }),

  // Optional CoinGecko API key for plans that require one. Read from the
  // environment only; it is never committed and never exposed to clients.
  COINGECKO_API_KEY: Joi.string().min(16).max(128).optional().messages({
    'string.min': 'COINGECKO_API_KEY must be at least 16 characters when set.'
  }),

  // The public CoinGecko API allows the free market-range endpoint without a
  // key. The base URL is trusted server configuration only — never derived
  // from client input — so a misconfigured deployment fails startup validation
  // rather than enabling SSRF through a request parameter.
  COINGECKO_BASE_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .optional()
    .messages({
      'string.uri': 'COINGECKO_BASE_URL must be an absolute https URL.'
    }),
  COINGECKO_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(60000)
    .default(10000)
    .optional()
    .messages({
      'number.min':
        'COINGECKO_TIMEOUT_MS must be between 1000 and 60000 milliseconds.',
      'number.max':
        'COINGECKO_TIMEOUT_MS must be between 1000 and 60000 milliseconds.'
    }),
  COINGECKO_RETRIES: Joi.number()
    .integer()
    .min(0)
    .max(5)
    .default(2)
    .optional()
    .messages({
      'number.max': 'COINGECKO_RETRIES must not exceed 5.'
    }),
  COINGECKO_BACKOFF_MS: Joi.number()
    .integer()
    .min(100)
    .max(60000)
    .default(1000)
    .optional()
    .messages({
      'number.min':
        'COINGECKO_BACKOFF_MS must be between 100 and 60000 milliseconds.',
      'number.max':
        'COINGECKO_BACKOFF_MS must be between 100 and 60000 milliseconds.'
    }),

  BCRYPT_ROUNDS: Joi.number()
    .integer()
    .min(4)
    .max(15)
    .default(10)
    .optional()
    .messages({
      'number.base': 'BCRYPT_ROUNDS must be a valid integer.',
      'number.integer': 'BCRYPT_ROUNDS must be a valid integer.',
      'number.min': 'BCRYPT_ROUNDS must be between 4 and 15.',
      'number.max': 'BCRYPT_ROUNDS must be between 4 and 15.'
    }),

  // Argon2id parameters for password hashing. Defaults reflect the production
  // configuration documented in docs/password-hashing.md. Validation runs at
  // startup so a misconfigured cost cannot silently weaken password storage.
  ARGON2_MEMORY_COST: Joi.number()
    .integer()
    .min(8192)
    .max(1048576)
    .default(65536)
    .optional()
    .messages({
      'number.base': 'ARGON2_MEMORY_COST must be a valid integer (KB).',
      'number.integer': 'ARGON2_MEMORY_COST must be a valid integer (KB).',
      'number.min': 'ARGON2_MEMORY_COST must be at least 8192 KB (8 MiB).',
      'number.max': 'ARGON2_MEMORY_COST must not exceed 1048576 KB (1 GiB).'
    }),
  ARGON2_TIME_COST: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(3)
    .optional()
    .messages({
      'number.base': 'ARGON2_TIME_COST must be a valid integer.',
      'number.integer': 'ARGON2_TIME_COST must be a valid integer.',
      'number.min': 'ARGON2_TIME_COST must be at least 1.',
      'number.max': 'ARGON2_TIME_COST must not exceed 10.'
    }),
  ARGON2_PARALLELISM: Joi.number()
    .integer()
    .min(1)
    .max(16)
    .default(4)
    .optional()
    .messages({
      'number.base': 'ARGON2_PARALLELISM must be a valid integer.',
      'number.integer': 'ARGON2_PARALLELISM must be a valid integer.',
      'number.min': 'ARGON2_PARALLELISM must be at least 1.',
      'number.max': 'ARGON2_PARALLELISM must not exceed 16.'
    }),
  ARGON2_HASH_LENGTH: Joi.number()
    .integer()
    .min(16)
    .max(64)
    .default(32)
    .optional()
    .messages({
      'number.base': 'ARGON2_HASH_LENGTH must be a valid integer (bytes).',
      'number.integer': 'ARGON2_HASH_LENGTH must be a valid integer (bytes).',
      'number.min': 'ARGON2_HASH_LENGTH must be at least 16 bytes.',
      'number.max': 'ARGON2_HASH_LENGTH must not exceed 64 bytes.'
    }),

  LOG_LEVEL: Joi.string()
    .valid('info', 'debug', 'warn', 'error', 'silent')
    .optional(),
  E2E_LOGS: Joi.string().valid('true', 'false').optional(),

  // Strong secrets with entropy checks. In production require longer/more entropy.
  ACCESS_TOKEN_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: secretValidator(64, 3.5).required(),
    otherwise: secretValidator(32, 3.0).required()
  }),
  REFRESH_TOKEN_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: secretValidator(64, 3.5).required(),
    otherwise: secretValidator(32, 3.0).required()
  }).invalid(Joi.ref('ACCESS_TOKEN_SECRET')),
  CSRF_TOKEN_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: secretValidator(32, 3.0).required(),
    otherwise: secretValidator(16, 2.5).required()
  }).invalid(Joi.ref('ACCESS_TOKEN_SECRET'), Joi.ref('REFRESH_TOKEN_SECRET')),

  // Keys the HMAC behind device identifiers and rate-limit Redis keys. Defaulted
  // outside production so existing dev machines and CI jobs need no new value;
  // rotating it resets every derived device id and rate-limit counter at once.
  SECURITY_HASH_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: secretValidator(32, 3.0).required(),
    otherwise: Joi.string()
      .min(16)
      .default('local-development-security-hash-secret')
  }).invalid(
    Joi.ref('ACCESS_TOKEN_SECRET'),
    Joi.ref('REFRESH_TOKEN_SECRET'),
    Joi.ref('CSRF_TOKEN_SECRET')
  ),

  NODE_ENV: Joi.string()
    .valid(...NODE_ENVS)
    .required()
})
  .custom((obj, helpers) => {
    // Additional cross-field validations and production safety checks
    if (obj.NODE_ENV === 'production') {
      // Ensure DB and Redis passwords are not the same as tokens or empty
      if (
        obj.DATA_SOURCE_PASSWORD &&
        (obj.DATA_SOURCE_PASSWORD === obj.ACCESS_TOKEN_SECRET ||
          obj.DATA_SOURCE_PASSWORD === obj.REFRESH_TOKEN_SECRET)
      ) {
        return helpers.error('any.custom', {
          message:
            'DATA_SOURCE_PASSWORD must not be identical to any token secret'
        });
      }

      if (!obj.REDIS_PASSWORD) {
        return helpers.error('any.custom', {
          message: 'REDIS_PASSWORD is required in production'
        });
      }

      if (
        obj.EMAIL_APP_PASSWORD &&
        (obj.EMAIL_APP_PASSWORD === obj.ACCESS_TOKEN_SECRET ||
          obj.EMAIL_APP_PASSWORD === obj.REFRESH_TOKEN_SECRET ||
          obj.EMAIL_APP_PASSWORD === obj.CSRF_TOKEN_SECRET)
      ) {
        return helpers.error('any.custom', {
          message:
            'EMAIL_APP_PASSWORD must not be identical to any token secret'
        });
      }

      // Prevent using localhost for Redis in production
      const host = (obj.REDIS_HOST || '').toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        return helpers.error('any.custom', {
          message: 'Redis host must not be localhost in production'
        });
      }

      // Reject obviously weak token secrets in production (redundant but defensive)
      const minProdLen = 64;
      if (
        typeof obj.ACCESS_TOKEN_SECRET === 'string' &&
        obj.ACCESS_TOKEN_SECRET.length < minProdLen
      ) {
        return helpers.error('any.custom', {
          message: `ACCESS_TOKEN_SECRET must be at least ${minProdLen} characters in production`
        });
      }
    }

    return obj;
  }, 'Production safety checks')
  .prefs({ errors: { label: 'key' } });
