import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { AuctionStatus } from '../enums/auction-status.enum.js';

export class CreateAuctionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  startingPrice: number;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsEnum(AuctionStatus)
  @IsOptional()
  status?: AuctionStatus;
}
