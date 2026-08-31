import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { Bid } from './entities/bid.entity.js';
import { Auction } from '../auctions/entities/auction.entity.js';
import { CreateBidDto } from './dto/create-bid.dto.js';
import { BidResponseDto } from './dto/bid-response.dto.js';
import { BidStatus } from './enums/bid-status.enum.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { IdempotencyService } from '../utils/idempotency/idempotency.service.js';
import { REDIS_CLIENT } from '../config/cache-config/cache-config.module.js';

// Atomic Redis Lua script with 750ms buffer & anti-sniping
const BID_LUA_SCRIPT = `
local auctionKey = KEYS[1]
local amount = tonumber(ARGV[1])
local userId = ARGV[2]
local graceBufferMs = 750

local timeRes = redis.call('TIME')
local nowMs = (tonumber(timeRes[1]) * 1000) + math.floor(tonumber(timeRes[2]) / 1000)

local auctionExists = redis.call('EXISTS', auctionKey)
if auctionExists == 0 then
  return { -1, "CACHE_MISS" }
end

local status = redis.call('HGET', auctionKey, 'status')
if status ~= 'ACTIVE' then
  return { 0, "AUCTION_INACTIVE" }
end

local endMs = tonumber(redis.call('HGET', auctionKey, 'end_time_ms'))
if nowMs > (endMs + graceBufferMs) then
  return { 0, "AUCTION_ENDED" }
end

local currentTopBid = tonumber(redis.call('HGET', auctionKey, 'current_top_bid'))
if amount <= currentTopBid then
  return { 0, "AMOUNT_TOO_LOW", tostring(currentTopBid) }
end

local extended = 0
if (endMs - nowMs) <= 60000 then
  endMs = endMs + 60000
  redis.call('HSET', auctionKey, 'end_time_ms', tostring(endMs))
  extended = 1
end

redis.call('HSET', auctionKey, 'current_top_bid', tostring(amount), 'top_bidder_id', userId)

return { 1, "ACCEPTED", tostring(amount), tostring(endMs), tostring(extended) }
`;

@Injectable()
export class BidsService implements OnModuleInit {
  constructor(
    @InjectRepository(Bid)
    private readonly bidRepository: Repository<Bid>,
    @InjectRepository(Auction)
    private readonly auctionRepository: Repository<Auction>,
    private readonly idempotencyService: IdempotencyService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // Precompile Lua script on startup
  onModuleInit() {
    this.redis.defineCommand('placeBidLua', {
      numberOfKeys: 1,
      lua: BID_LUA_SCRIPT,
    });
  }

  // Atomic in-memory bid placement
  async placeBid(
    dto: CreateBidDto,
    userId: string,
    idempotencyKey?: string,
  ): Promise<BidResponseDto> {
    const rawKey =
      idempotencyKey || (dto.bid_id ? `${userId}:${dto.bid_id}` : undefined);
    const { id: bidId } = this.idempotencyService.validateKey(rawKey, userId);

    const initialTtl = 86400;
    const lock = await this.idempotencyService.acquireLock(
      rawKey as string,
      initialTtl,
    );

    if (!lock.acquired && lock.cachedResult) {
      return lock.cachedResult;
    }

    const auctionKey = `auction:${dto.auction_id}:state`;

    let result = (await (this.redis as any).placeBidLua(
      auctionKey,
      dto.amount,
      userId,
    )) as [number, string, string?, string?, string?];

    if (result[0] === -1) {
      await this.warmAuctionCache(dto.auction_id);
      result = (await (this.redis as any).placeBidLua(
        auctionKey,
        dto.amount,
        userId,
      )) as [number, string, string?, string?, string?];
    }

    const [statusFlag, reason, _topBid, endMs, extended] = result;

    if (statusFlag === 0) {
      await this.idempotencyService.releaseLock(rawKey as string);
      if (reason === 'AUCTION_ENDED') {
        throw new BadRequestException('Bid rejected: Auction has ended');
      }
      if (reason === 'AUCTION_INACTIVE') {
        throw new BadRequestException('Bid rejected: Auction is not active');
      }
      if (reason === 'AMOUNT_TOO_LOW') {
        throw new BadRequestException(
          'Bid rejected: Amount must be strictly higher than current top bid',
        );
      }
      throw new BadRequestException(`Bid rejected: ${reason}`);
    }

    const updatedEndTime =
      extended === '1' && endMs ? new Date(Number(endMs)) : undefined;

    const bid = this.bidRepository.create({
      id: bidId,
      auctionId: dto.auction_id,
      userId,
      amount: dto.amount,
      status: BidStatus.ACCEPTED,
      timestamp: new Date(),
    });

    const persistOps: Promise<any>[] = [this.bidRepository.save(bid)];
    if (updatedEndTime) {
      persistOps.push(
        this.auctionRepository.update(dto.auction_id, {
          endTime: updatedEndTime,
        }),
      );
    }

    await Promise.all(persistOps);

    const response: BidResponseDto = {
      message: 'Bid accepted',
      current_bid: dto.amount,
      bid_id: bidId,
      auction_id: dto.auction_id,
      status: BidStatus.ACCEPTED,
    };

    const ttl = updatedEndTime
      ? this.idempotencyService.calculateTtl(updatedEndTime)
      : initialTtl;

    const recentBidsKey = `auction:${dto.auction_id}:recent_bids`;
    await Promise.all([
      this.idempotencyService.saveResponse(rawKey as string, response, ttl),
      this.redis.del(`auction:${dto.auction_id}`),
      this.redis.lpush(recentBidsKey, JSON.stringify(bid)),
      this.redis.ltrim(recentBidsKey, 0, 49),
      this.redis.publish(
        `auction:${dto.auction_id}:bids`,
        JSON.stringify(response),
      ),
    ]);

    return response;
  }

  // Warm Redis hash from database
  async warmAuctionCache(auctionId: string): Promise<void> {
    const auction = await this.auctionRepository.findOne({
      where: { id: auctionId },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    const topBid = await this.bidRepository.findOne({
      where: { auctionId, status: BidStatus.ACCEPTED },
      order: { amount: 'DESC', timestamp: 'ASC' },
    });

    const currentTopBid = topBid ? topBid.amount : auction.startingPrice;
    const topBidderId = topBid ? topBid.userId : '';

    const endMs = new Date(auction.endTime).getTime();
    const ttlSeconds = Math.max(
      Math.ceil((endMs - Date.now()) / 1000) + 3600,
      300,
    );

    const auctionKey = `auction:${auctionId}:state`;
    await this.redis
      .multi()
      .hset(auctionKey, {
        current_top_bid: String(currentTopBid),
        top_bidder_id: topBidderId,
        end_time_ms: String(endMs),
        status: auction.status,
      })
      .expire(auctionKey, ttlSeconds)
      .exec();
  }

  // Retrieve bid feed from RAM with DB fallback
  async findAuctionBids(
    auctionId: string,
    pagination?: PaginationDto,
  ): Promise<Bid[]> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    if (page === 1) {
      const cached = await this.redis.lrange(
        `auction:${auctionId}:recent_bids`,
        0,
        limit - 1,
      );
      if (cached.length > 0) {
        return cached.map((item) => JSON.parse(item));
      }
    }

    const bids = await this.bidRepository.find({
      where: { auctionId },
      order: { timestamp: 'DESC' },
      skip,
      take: limit,
    });

    if (page === 1 && bids.length > 0) {
      const recentBidsKey = `auction:${auctionId}:recent_bids`;
      const pipeline = this.redis.pipeline();
      pipeline.del(recentBidsKey);
      bids.forEach((b) => pipeline.rpush(recentBidsKey, JSON.stringify(b)));
      pipeline.expire(recentBidsKey, 3600);
      await pipeline.exec();
    }

    return bids;
  }

  // Query user bid history
  async findUserBids(
    userId: string,
    pagination?: PaginationDto,
  ): Promise<Bid[]> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    return this.bidRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      skip,
      take: limit,
    });
  }
}
