import { UserErrors } from '../../domain/errors/user-errors';

interface DatabaseError {
  code?: string;
  detail?: string;
}

function isDatabaseError(error: unknown): error is DatabaseError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export function throwOnUniqueConstraint(error: unknown): never {
  if (isDatabaseError(error) && error.code === '23505') {
    const detail = error.detail ?? '';

    if (detail.includes('email')) throw UserErrors.emailAlreadyExists();

    if (detail.includes('username')) throw UserErrors.usernameAlreadyExists();
  }

  throw error;
}
