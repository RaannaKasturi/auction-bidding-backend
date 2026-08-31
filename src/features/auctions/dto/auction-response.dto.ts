import { AuctionStatus } from '../enums/auction-status.enum.js';

export class AuctionResponseDto {
  id: string;
  title: string;
  description: string | null;
  startingPrice: number;
  currentTopBid: number;
  topBidderId: string | null;
  startTime: Date;
  endTime: Date;
  status: AuctionStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
