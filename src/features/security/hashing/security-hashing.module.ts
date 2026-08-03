import { Module } from '@nestjs/common';
import { SecurityHasher } from './security-hasher.service';

@Module({
  providers: [SecurityHasher],
  exports: [SecurityHasher]
})
export class SecurityHashingModule {}
