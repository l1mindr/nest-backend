import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { HashingProvider } from './hashing.provider';

@Injectable()
export class BcryptProvider implements HashingProvider {
  private readonly defaultRounds: number;

  constructor(configService: ConfigService) {
    this.defaultRounds = configService.get<number>('BCRYPT_ROUNDS') ?? 10;
  }

  async hash(data: string | Buffer, roundsSalt: number = this.defaultRounds) {
    const getSalt = await bcrypt.genSalt(roundsSalt);
    return bcrypt.hash(data, getSalt);
  }

  compare(data: string | Buffer, encrypted: string) {
    return bcrypt.compare(data, encrypted);
  }
}
