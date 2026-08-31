import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { BidsService } from './bids.service.js';
import { CreateBidDto } from './dto/create-bid.dto.js';
import { BidResponseDto } from './dto/bid-response.dto.js';
import { Bid } from './entities/bid.entity.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';

@ApiTags('Bids')
@Controller('bid')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Place an atomic concurrent bid on an auction' })
  @ApiCreatedResponse({ type: BidResponseDto })
  placeBid(
    @Body() createBidDto: CreateBidDto,
    @CurrentUser('id') authUserId: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<BidResponseDto> {
    const effectiveUserId = createBidDto.user_id || authUserId;
    return this.bidsService.placeBid(
      createBidDto,
      effectiveUserId,
      idempotencyKey,
    );
  }

  @Public()
  @Get('auction/:id')
  @ApiOperation({ summary: 'Get public bid feed for an auction' })
  @ApiOkResponse({ type: [Bid] })
  findAuctionBids(
    @Param('id', ParseUUIDPipe) auctionId: string,
    @Query() pagination?: PaginationDto,
  ): Promise<Bid[]> {
    return this.bidsService.findAuctionBids(auctionId, pagination);
  }
}
