import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { BidStatus } from '../enums/bid-status.enum.js';

@Entity('bids')
@Index(['auctionId', 'timestamp'])
export class Bid {
  @PrimaryColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'auction_id', type: 'uuid' })
  auctionId: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @Column({
    type: 'enum',
    enum: BidStatus,
    default: BidStatus.PENDING,
  })
  status: BidStatus;

  @CreateDateColumn({ name: 'timestamp', type: 'timestamptz' })
  timestamp: Date;
}
