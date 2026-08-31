import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { EnvConfigModule } from './config/env-config/env-config.module.js';
import { DatabaseConfigModule } from './config/database-config/database-config.module.js';
import { CacheConfigModule } from './config/cache-config/cache-config.module.js';
import { IdempotencyModule } from './utils/idempotency/idempotency.module.js';
import { AuctionsModule } from './auctions/auctions.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BidsModule } from './bids/bids.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EnvConfigModule,
    DatabaseConfigModule,
    CacheConfigModule,
    IdempotencyModule,
    AuctionsModule,
    UsersModule,
    AuthModule,
    BidsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
