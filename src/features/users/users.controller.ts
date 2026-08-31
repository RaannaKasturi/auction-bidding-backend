import {
  Controller,
  Get,
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
  ApiOkResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { BidsService } from '../bids/bids.service.js';
import { AuctionsService } from '../auctions/auctions.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdatePasswordDto } from './dto/update-password.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { DeleteAccountResponseDto } from './dto/delete-account-response.dto.js';
import { UserResponseDto } from '../auth/dto/user-response.dto.js';
import { MessageResponseDto } from '../auth/dto/message-response.dto.js';
import { Bid } from '../bids/entities/bid.entity.js';
import { AuctionResponseDto } from '../auctions/dto/auction-response.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from './enums/user-role.enum.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly bidsService: BidsService,
    private readonly auctionsService: AuctionsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  getProfile(@CurrentUser('id') userId: string): Promise<UserResponseDto> {
    return this.usersService.getProfile(userId);
  }

  @Get('me/bids')
  @ApiOperation({ summary: 'Get bids placed by the authenticated user' })
  @ApiOkResponse({ type: [Bid] })
  findMyBids(
    @CurrentUser('id') userId: string,
    @Query() pagination?: PaginationDto,
  ): Promise<Bid[]> {
    return this.bidsService.findUserBids(userId, pagination);
  }

  @Get('me/auctions')
  @ApiOperation({ summary: 'Get auctions in which user participated' })
  @ApiOkResponse({ type: [AuctionResponseDto] })
  findMyAuctions(
    @CurrentUser('id') userId: string,
    @Query() pagination?: PaginationDto,
  ): Promise<AuctionResponseDto[]> {
    return this.auctionsService.findUserParticipatedAuctions(
      userId,
      pagination,
    );
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile details or privacy setting' })
  @ApiOkResponse({ type: UserResponseDto })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(userId, updateUserDto);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Update password with old password verification' })
  @ApiOkResponse({ type: MessageResponseDto })
  updatePassword(
    @CurrentUser('id') userId: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ): Promise<MessageResponseDto> {
    return this.usersService.updatePassword(userId, updatePasswordDto);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  @ApiOkResponse({ type: UserResponseDto })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateRole(id, updateRoleDto.role);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Soft delete current user account' })
  @ApiOkResponse({ type: DeleteAccountResponseDto })
  deleteAccount(
    @CurrentUser('id') userId: string,
  ): Promise<DeleteAccountResponseDto> {
    return this.usersService.deleteAccount(userId);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Lookup user by username (respects privacy)' })
  @ApiOkResponse({ type: UserResponseDto })
  findByUsername(
    @Param('username') username: string,
  ): Promise<UserResponseDto> {
    return this.usersService.findByUsername(username);
  }
}
