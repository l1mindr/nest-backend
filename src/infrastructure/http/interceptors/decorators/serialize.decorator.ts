import { Type, UseInterceptors } from '@nestjs/common';
import { SerializeInterceptor } from '../serialize.interceptor';

export function Serialize<T>(dto: Type<T>) {
  return UseInterceptors(new SerializeInterceptor(dto));
}
