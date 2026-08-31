import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from './entities/user.entity.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdatePasswordDto } from './dto/update-password.dto.js';
import { DeleteAccountResponseDto } from './dto/delete-account-response.dto.js';
import { UserRole } from './enums/user-role.enum.js';
import { UserResponseDto } from '../auth/dto/user-response.dto.js';
import { MessageResponseDto } from '../auth/dto/message-response.dto.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // Get own full user profile
  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      isPrivate: user.isPrivate,
      createdAt: user.createdAt,
    };
  }

  // Update profile details and privacy
  async updateProfile(
    userId: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.isPrivate !== undefined) user.isPrivate = dto.isPrivate;
    if (dto.securityQuestion !== undefined)
      user.securityQuestion = dto.securityQuestion;
    if (dto.securityAnswer !== undefined) {
      user.securityAnswer = await argon2.hash(
        dto.securityAnswer.trim().toLowerCase(),
      );
    }

    const saved = await this.userRepository.save(user);
    return {
      id: saved.id,
      username: saved.username,
      name: saved.name,
      role: saved.role,
      isPrivate: saved.isPrivate,
      createdAt: saved.createdAt,
    };
  }

  // Verify old password and hash new password
  async updatePassword(
    userId: string,
    dto: UpdatePasswordDto,
  ): Promise<MessageResponseDto> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await argon2.verify(user.password, dto.oldPassword);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.password = await argon2.hash(dto.newPassword);
    await this.userRepository.save(user);

    return { message: 'Password updated successfully' };
  }

  // Promote or demote user role (Admin only)
  async updateRole(userId: string, role: UserRole): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.role = role;
    const saved = await this.userRepository.save(user);
    return {
      id: saved.id,
      username: saved.username,
      name: saved.name,
      role: saved.role,
      isPrivate: saved.isPrivate,
      createdAt: saved.createdAt,
    };
  }

  // Soft delete user account
  async deleteAccount(userId: string): Promise<DeleteAccountResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.softDelete(user.id);
    return { deleted: true };
  }

  // Public user lookup with privacy filter
  async findByUsername(username: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) {
      throw new NotFoundException(`User @${username} not found`);
    }
    return user.toPublicProfile() as UserResponseDto;
  }
}
