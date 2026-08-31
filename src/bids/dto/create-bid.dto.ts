import { IsUUID, IsNumber, IsPositive, IsOptional } from 'class-validator';

export class CreateBidDto {
  @IsUUID()
  auction_id: string;

  @IsUUID()
  @IsOptional()
  user_id?: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsUUID()
  @IsOptional()
  bid_id?: string;
}
