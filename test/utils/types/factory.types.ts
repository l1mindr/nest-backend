import { Response } from 'supertest';
import { ApiClient } from '../../helpers/apiClient-helper';
import { TestUser } from './user.types';

export type FactoryContext<TUser, TResponse> = {
  client: ApiClient;
  user: TUser;
  response: TResponse;
};

export type CreateUserResponse = {
  register: Response;
};

export type AuthenticatedUserResponse = CreateUserResponse & {
  login: Response;
};

export type CreateUserContext = FactoryContext<TestUser, CreateUserResponse>;

export type AuthenticatedUserContext = FactoryContext<
  TestUser,
  AuthenticatedUserResponse
>;
