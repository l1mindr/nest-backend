export function createUser(overrides = {}) {
  return {
    email: 'test@test.com',
    username: 'testuser',
    password: 'Password@123',
    ...overrides
  };
}
