import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auction } from './entities/auction.entity.js';
import { Bid } from '../bids/entities/bid.entity.js';
import { AuctionsService } from './auctions.service.js';
import { AuctionsController } from './auctions.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Auction, Bid])],
  exports: [TypeOrmModule, AuctionsService],
  providers: [AuctionsService],
  controllers: [AuctionsController],
})
export class AuctionsModule {}
