import { Injectable } from '@nestjs/common';
import { RateLimitCounterService } from './rate-limit-counter.service';

@Injectable()
export class RateLimitCheckService {
  constructor(
    private readonly rateLimitCounterService: RateLimitCounterService
  ) {}

  async consume(
    route: string,
    ip: string,
    limit: number,
    ttl: number
  ): Promise<boolean> {
    const count = await this.rateLimitCounterService.increment(route, ip, ttl);

    return count <= limit;
  }
}
