import { IRequest } from '@infrastructure/http/interfaces/custom-request.interface';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IpAddress = createParamDecorator(
  (_: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<IRequest>();

    return request.ip;
  }
);
