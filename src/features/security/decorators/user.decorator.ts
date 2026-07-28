import { IRequest } from '@infrastructure/http/interfaces/custom-request.interface';
import { User as UserEntity } from '@features/users/domain/entities/user.entity';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<IRequest>();
    return request.user as unknown as UserEntity;
  }
);
