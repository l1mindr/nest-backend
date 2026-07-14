import { createUserDto } from '../../helpers/create-user.helper';

export type TestUser = ReturnType<typeof createUserDto>;
