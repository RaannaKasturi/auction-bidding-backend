import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bid } from './entities/bid.entity.js';
import { Auction } from '../auctions/entities/auction.entity.js';
import { BidsService } from './bids.service.js';
import { BidsController } from './bids.controller.js';
import { IdempotencyModule } from '../utils/idempotency/idempotency.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Bid, Auction]), IdempotencyModule],
  providers: [BidsService],
  controllers: [BidsController],
  exports: [TypeOrmModule, BidsService],
})
export class BidsModule {}
