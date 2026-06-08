import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DeviceContext } from '../context/device-context.interface';

export const Device = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): DeviceContext => {
    const request = ctx.switchToHttp().getRequest();

    return request.device;
  }
);
