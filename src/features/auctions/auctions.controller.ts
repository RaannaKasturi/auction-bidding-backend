import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
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
import { AuctionsService } from './auctions.service.js';
import { CreateAuctionDto } from './dto/create-auction.dto.js';
import { UpdateAuctionDto } from './dto/update-auction.dto.js';
import { AuctionStatus } from './enums/auction-status.enum.js';
import { AuctionResponseDto } from './dto/auction-response.dto.js';
import { DeleteAuctionResponseDto } from './dto/delete-auction-response.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/enums/user-role.enum.js';

@ApiTags('Auctions')
@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Create a new active or draft auction' })
  @ApiCreatedResponse({ type: AuctionResponseDto })
  create(
    @Body() createAuctionDto: CreateAuctionDto,
  ): Promise<AuctionResponseDto> {
    return this.auctionsService.create(createAuctionDto);
  }

  @Post('draft')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Create an auction with DRAFT status' })
  @ApiCreatedResponse({ type: AuctionResponseDto })
  createDraft(
    @Body() createAuctionDto: CreateAuctionDto,
  ): Promise<AuctionResponseDto> {
    return this.auctionsService.createDraft(createAuctionDto);
  }

  @Patch(':id/draft')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Mark an existing auction as DRAFT' })
  @ApiOkResponse({ type: AuctionResponseDto })
  markAsDraft(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AuctionResponseDto> {
    return this.auctionsService.markAsDraft(id);
  }

  @Patch(':id/cancel')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Cancel an auction (Admin/Moderator)' })
  @ApiOkResponse({ type: AuctionResponseDto })
  cancel(@Param('id', ParseUUIDPipe) id: string): Promise<AuctionResponseDto> {
    return this.auctionsService.cancel(id);
  }

  @Patch(':id/end')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Prematurely end an auction (Admin/Moderator)' })
  @ApiOkResponse({ type: AuctionResponseDto })
  end(@Param('id', ParseUUIDPipe) id: string): Promise<AuctionResponseDto> {
    return this.auctionsService.end(id);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List all auctions with optional status & pagination',
  })
  @ApiOkResponse({ type: [AuctionResponseDto] })
  findAll(
    @Query('status') status?: AuctionStatus,
    @Query() pagination?: PaginationDto,
  ): Promise<AuctionResponseDto[]> {
    return this.auctionsService.findAll(status, pagination);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get single auction details with top bid info' })
  @ApiOkResponse({ type: AuctionResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AuctionResponseDto> {
    return this.auctionsService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Update auction details' })
  @ApiOkResponse({ type: AuctionResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAuctionDto: UpdateAuctionDto,
  ): Promise<AuctionResponseDto> {
    return this.auctionsService.update(id, updateAuctionDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete an auction (Admin only)' })
  @ApiOkResponse({ type: DeleteAuctionResponseDto })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeleteAuctionResponseDto> {
    return this.auctionsService.softDelete(id);
  }
}
