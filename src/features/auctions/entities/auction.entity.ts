import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  VersionColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { AuctionStatus } from '../enums/auction-status.enum.js';

@Entity('auctions')
@Index(['status', 'endTime'])
export class Auction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    name: 'starting_price',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  startingPrice: number;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Index()
  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @Index()
  @Column({
    type: 'enum',
    enum: AuctionStatus,
    default: AuctionStatus.DRAFT,
  })
  status: AuctionStatus;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  currentTopBid: number;
  topBidderId: string | null;
}
