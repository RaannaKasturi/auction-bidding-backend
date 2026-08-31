import { BidStatus } from '../enums/bid-status.enum.js';

export class BidResponseDto {
  message: string;
  current_bid: number;
  bid_id: string;
  auction_id: string;
  status: BidStatus;
}
