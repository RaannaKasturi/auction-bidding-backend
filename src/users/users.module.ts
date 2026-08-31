import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { BidsModule } from '../bids/bids.module.js';
import { AuctionsModule } from '../auctions/auctions.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([User]), BidsModule, AuctionsModule],
  providers: [UsersService],
  exports: [TypeOrmModule, UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
