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
