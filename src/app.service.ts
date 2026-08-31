import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './config/cache-config/cache-config.module.js';
import { AppStatusResponseDto } from './app.dto.js';

@Injectable()
export class AppService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // Check system health status
  async getStatus(): Promise<AppStatusResponseDto> {
    let dbStatus = 'offline';
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        dbStatus = 'online';
      }
    } catch {
      dbStatus = 'offline';
    }

    let redisStatus = 'offline';
    try {
      const pong = await this.redis.ping();
      if (pong === 'PONG') {
        redisStatus = 'online';
      }
    } catch {
      redisStatus = 'offline';
    }

    return {
      server: 'online',
      database: dbStatus,
      redis: redisStatus,
      serverTime: new Date().toISOString(),
    };
  }
}
