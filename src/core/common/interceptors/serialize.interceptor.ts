import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Type
} from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import { map } from 'rxjs/operators';

@Injectable()
export class SerializeInterceptor<T> implements NestInterceptor {
  constructor(private dto: Type<T>) {}

  intercept(_: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((data) =>
        plainToInstance(this.dto, data, {
          excludeExtraneousValues: true
        })
      )
    );
  }
}
