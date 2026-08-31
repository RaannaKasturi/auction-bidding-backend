import { Module, Global } from '@nestjs/common';
import { Redis } from 'ioredis';
import { EnvConfigService } from '../env-config/env-config.service.js';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [EnvConfigService],
      useFactory: (envConfigService: EnvConfigService) => {
        const redisUrl = envConfigService.getRedisUrl();
        return new Redis(redisUrl);
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class CacheConfigModule {}
