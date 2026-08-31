import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Exclude, Transform } from 'class-transformer';
import { UserRole } from '../enums/user-role.enum.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, unique: true })
  username: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'varchar', length: 255 })
  @Transform(({ value, obj }) => (obj?.isPrivate ? undefined : value))
  name: string;

  @Column({ name: 'is_private', type: 'boolean', default: false })
  isPrivate: boolean;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.BIDDER,
  })
  role: UserRole;

  @Column({ name: 'security_question', type: 'varchar', length: 255 })
  securityQuestion: string;

  @Exclude()
  @Column({
    name: 'security_answer',
    type: 'varchar',
    length: 255,
    select: false,
  })
  securityAnswer: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  toPublicProfile(): Partial<User> {
    return {
      id: this.id,
      username: this.username,
      role: this.role,
      isPrivate: this.isPrivate,
      ...(this.isPrivate ? {} : { name: this.name }),
      createdAt: this.createdAt,
    };
  }
}
