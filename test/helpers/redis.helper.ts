import { RedisService } from '@infrastructure/databases/redis/redis.service';
import { INestApplication } from '@nestjs/common';

export async function clearRedis(app: INestApplication) {
  const redis = app.get(RedisService);

  await redis.client.flushdb();
}
