import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { AuctionStatus } from '../enums/auction-status.enum.js';

export class UpdateAuctionDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  startingPrice?: number;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsEnum(AuctionStatus)
  @IsOptional()
  status?: AuctionStatus;
}
