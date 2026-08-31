import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Redis } from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Auction } from './entities/auction.entity.js';
import { Bid } from '../bids/entities/bid.entity.js';
import { BidStatus } from '../bids/enums/bid-status.enum.js';
import { CreateAuctionDto } from './dto/create-auction.dto.js';
import { UpdateAuctionDto } from './dto/update-auction.dto.js';
import { AuctionStatus } from './enums/auction-status.enum.js';
import { DeleteAuctionResponseDto } from './dto/delete-auction-response.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { REDIS_CLIENT } from '../../config/cache-config/cache-config.module.js';

@Injectable()
export class AuctionsService {
  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepository: Repository<Auction>,
    @InjectRepository(Bid)
    private readonly bidRepository: Repository<Bid>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // Populate highest bid from Redis or bids table
  private async populateTopBid(auction: Auction): Promise<Auction> {
    const cachedTop = await this.redis.hmget(
      `auction:${auction.id}:state`,
      'current_top_bid',
      'top_bidder_id',
    );

    if (cachedTop[0]) {
      auction.currentTopBid = Number(cachedTop[0]);
      auction.topBidderId = cachedTop[1] || null;
      return auction;
    }

    const topBid = await this.bidRepository.findOne({
      where: { auctionId: auction.id, status: BidStatus.ACCEPTED },
      order: { amount: 'DESC', timestamp: 'ASC' },
    });

    auction.currentTopBid = topBid ? topBid.amount : auction.startingPrice;
    auction.topBidderId = topBid ? topBid.userId : null;
    return auction;
  }

  // Create new active auction
  async create(dto: CreateAuctionDto): Promise<Auction> {
    const auction = this.auctionRepository.create({
      ...dto,
      status: dto.status || AuctionStatus.ACTIVE,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
    });
    const saved = await this.auctionRepository.save(auction);
    saved.currentTopBid = saved.startingPrice;
    saved.topBidderId = null;
    return saved;
  }

  // Create draft auction
  async createDraft(dto: CreateAuctionDto): Promise<Auction> {
    const auction = this.auctionRepository.create({
      ...dto,
      status: AuctionStatus.DRAFT,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
    });
    const saved = await this.auctionRepository.save(auction);
    saved.currentTopBid = saved.startingPrice;
    saved.topBidderId = null;
    return saved;
  }

  // Mark auction as DRAFT
  async markAsDraft(id: string): Promise<Auction> {
    const auction = await this.findOne(id);
    auction.status = AuctionStatus.DRAFT;
    const saved = await this.auctionRepository.save(auction);
    await this.redis.del(`auction:${id}`, `auction:${id}:state`);
    return this.populateTopBid(saved);
  }

  // Batch fetch auctions with Redis pipeline
  async findAll(
    status?: AuctionStatus,
    pagination?: PaginationDto,
  ): Promise<Auction[]> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const auctions = await this.auctionRepository.find({
      where: status ? { status } : undefined,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    if (auctions.length === 0) return [];

    const pipeline = this.redis.pipeline();
    auctions.forEach((a) => {
      pipeline.hmget(
        `auction:${a.id}:state`,
        'current_top_bid',
        'top_bidder_id',
      );
    });

    const results = await pipeline.exec();

    const missingTopBidIndices: number[] = [];
    results?.forEach((res, index) => {
      const [err, data] = res as [Error | null, [string | null, string | null]];
      if (!err && data && data[0]) {
        auctions[index].currentTopBid = Number(data[0]);
        auctions[index].topBidderId = data[1] || null;
      } else {
        missingTopBidIndices.push(index);
      }
    });

    if (missingTopBidIndices.length > 0) {
      await Promise.all(
        missingTopBidIndices.map(async (idx) => {
          auctions[idx] = await this.populateTopBid(auctions[idx]);
        }),
      );
    }

    return auctions;
  }

  // Find auctions where user placed bids
  async findUserParticipatedAuctions(
    userId: string,
    pagination?: PaginationDto,
  ): Promise<Auction[]> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const userAuctionIds = await this.bidRepository
      .createQueryBuilder('bid')
      .select('DISTINCT bid.auctionId', 'auctionId')
      .where('bid.userId = :userId', { userId })
      .getRawMany();

    const ids = userAuctionIds.map((row) => row.auctionId);
    if (ids.length === 0) return [];

    const auctions = await this.auctionRepository
      .createQueryBuilder('auction')
      .where('auction.id IN (:...ids)', { ids })
      .orderBy('auction.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    return Promise.all(auctions.map((a) => this.populateTopBid(a)));
  }

  // Find single auction
  async findOne(id: string): Promise<Auction> {
    const auction = await this.auctionRepository.findOne({ where: { id } });
    if (!auction) {
      throw new NotFoundException(`Auction with ID ${id} not found`);
    }
    return this.populateTopBid(auction);
  }

  // Update auction metadata
  async update(id: string, dto: UpdateAuctionDto): Promise<Auction> {
    const auction = await this.findOne(id);

    if (dto.title !== undefined) auction.title = dto.title;
    if (dto.description !== undefined) auction.description = dto.description;
    if (dto.startingPrice !== undefined)
      auction.startingPrice = dto.startingPrice;
    if (dto.status !== undefined) auction.status = dto.status;
    if (dto.startTime !== undefined)
      auction.startTime = new Date(dto.startTime);
    if (dto.endTime !== undefined) auction.endTime = new Date(dto.endTime);

    const updated = await this.auctionRepository.save(auction);
    await this.redis.del(`auction:${id}`, `auction:${id}:state`);
    return this.populateTopBid(updated);
  }

  // Cancel auction
  async cancel(id: string): Promise<Auction> {
    const auction = await this.findOne(id);
    auction.status = AuctionStatus.CANCELLED;
    const saved = await this.auctionRepository.save(auction);
    await this.redis.del(`auction:${id}`, `auction:${id}:state`);
    return this.populateTopBid(saved);
  }

  // Conclude auction early
  async end(id: string): Promise<Auction> {
    const auction = await this.findOne(id);
    auction.status = AuctionStatus.ENDED;
    const saved = await this.auctionRepository.save(auction);
    await this.redis.del(`auction:${id}`, `auction:${id}:state`);
    return this.populateTopBid(saved);
  }

  // Soft delete auction
  async softDelete(id: string): Promise<DeleteAuctionResponseDto> {
    const auction = await this.findOne(id);
    await this.auctionRepository.softDelete(auction.id);
    await this.redis.del(`auction:${id}`, `auction:${id}:state`);
    return { deleted: true };
  }

  // Sweep and end expired auctions every 30s
  @Cron(CronExpression.EVERY_30_SECONDS)
  async settleExpiredAuctions(): Promise<void> {
    const now = new Date();
    const expired = await this.auctionRepository.find({
      where: {
        status: AuctionStatus.ACTIVE,
        endTime: LessThanOrEqual(now),
      },
    });

    for (const auction of expired) {
      auction.status = AuctionStatus.ENDED;
      await this.auctionRepository.save(auction);
      await this.redis.del(
        `auction:${auction.id}`,
        `auction:${auction.id}:state`,
      );
    }
  }
}
