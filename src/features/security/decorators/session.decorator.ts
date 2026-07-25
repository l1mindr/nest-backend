import { IRequest } from '@infrastructure/http/interfaces/custom-request.interface';
import { Session as SessionEntity } from '@features/sessions/entities/session.entity';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Session = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<IRequest>();
    return request.session as unknown as SessionEntity;
  }
);
