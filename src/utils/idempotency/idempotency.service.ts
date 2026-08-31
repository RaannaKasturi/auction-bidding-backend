import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../config/cache-config/cache-config.module.js';

export interface IdempotencyRecord {
  status: 'PROCESSING' | 'COMPLETED';
  response?: any;
}

const UUID_V4_OR_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // Validates <userId:uuid4/7>:<uuid7> format
  validateKey(
    key?: string,
    expectedUserId?: string,
  ): { userId: string; id: string } {
    if (!key || key.trim() === '') {
      throw new BadRequestException('X-Idempotency-Key header is required');
    }

    const parts = key.split(':');
    if (parts.length !== 2) {
      throw new BadRequestException(
        'X-Idempotency-Key must follow the format <userId>:<UUIDv7>',
      );
    }

    const [userId, uuidV7] = parts;

    if (!UUID_V4_OR_V7_REGEX.test(userId)) {
      throw new BadRequestException(
        'User ID in X-Idempotency-Key must be a valid UUIDv4 or UUIDv7',
      );
    }

    if (!UUID_V7_REGEX.test(uuidV7)) {
      throw new BadRequestException(
        'Request ID in X-Idempotency-Key must strictly be a valid UUIDv7',
      );
    }

    if (expectedUserId && userId !== expectedUserId) {
      throw new BadRequestException(
        'User ID in X-Idempotency-Key does not match the request user ID',
      );
    }

    return { userId, id: uuidV7 };
  }

  // Dynamic TTL based on auction end time
  calculateTtl(endTime: Date | string | number, bufferSeconds = 300): number {
    const endMs = new Date(endTime).getTime();
    const nowMs = Date.now();
    const diffSeconds = Math.ceil((endMs - nowMs) / 1000) + bufferSeconds;
    return Math.max(diffSeconds, bufferSeconds);
  }

  // Atomic Redis lock acquisition
  async acquireLock(
    key: string,
    ttlSeconds: number,
  ): Promise<{ acquired: boolean; cachedResult?: any }> {
    const redisKey = `idempotency:${key}`;
    const acquired = await this.redis.set(
      redisKey,
      JSON.stringify({ status: 'PROCESSING' }),
      'EX',
      ttlSeconds,
      'NX',
    );

    if (!acquired) {
      const cached = await this.redis.get(redisKey);
      if (!cached) {
        throw new ConflictException('Concurrent request conflict');
      }

      const parsed: IdempotencyRecord = JSON.parse(cached);
      if (parsed.status === 'PROCESSING') {
        throw new ConflictException(
          'Request with this idempotency key is currently in progress',
        );
      }

      return { acquired: false, cachedResult: parsed.response };
    }

    return { acquired: true };
  }

  // Cache completed response in Redis
  async saveResponse(
    key: string,
    response: any,
    ttlSeconds: number,
  ): Promise<void> {
    const redisKey = `idempotency:${key}`;
    await this.redis.set(
      redisKey,
      JSON.stringify({ status: 'COMPLETED', response }),
      'EX',
      ttlSeconds,
    );
  }

  // Release lock on error
  async releaseLock(key: string): Promise<void> {
    const redisKey = `idempotency:${key}`;
    await this.redis.del(redisKey);
  }
}
