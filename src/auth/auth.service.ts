import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { User } from '../users/entities/user.entity.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { SecurityQuestionResponseDto } from './dto/security-question-response.dto.js';
import { MessageResponseDto } from './dto/message-response.dto.js';
import { JwtPayload } from './strategies/jwt.strategy.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  // Register new user account
  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const existing = await this.userRepository.findOne({
      where: [{ username: dto.username }, { email: dto.email }],
    });

    if (existing) {
      throw new ConflictException('Username or email already in use');
    }

    const hashedPassword = await argon2.hash(dto.password);
    const hashedSecurityAnswer = await argon2.hash(
      dto.securityAnswer.trim().toLowerCase(),
    );

    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
      securityAnswer: hashedSecurityAnswer,
    });

    const saved = await this.userRepository.save(user);
    return saved.toPublicProfile() as UserResponseDto;
  }

  // Authenticate user with argon2
  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :id OR user.email = :id', { id: dto.identifier })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(user.password, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Login successful',
      accessToken,
      user: user.toPublicProfile() as UserResponseDto,
    };
  }

  // Fetch security question
  async getSecurityQuestion(
    identifier: string,
  ): Promise<SecurityQuestionResponseDto> {
    const user = await this.userRepository.findOne({
      where: [{ username: identifier }, { email: identifier }],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { securityQuestion: user.securityQuestion };
  }

  // Reset password using security answer
  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.securityAnswer')
      .where('user.username = :id OR user.email = :id', { id: dto.identifier })
      .getOne();

    if (!user) {
      throw new UnauthorizedException(
        'Invalid security answer. Please contact support@aution.example.com for password reset assistance.',
      );
    }

    const isAnswerValid = await argon2.verify(
      user.securityAnswer,
      dto.securityAnswer.trim().toLowerCase(),
    );

    if (!isAnswerValid) {
      throw new UnauthorizedException(
        'Invalid security answer. Please contact support@aution.example.com for password reset assistance.',
      );
    }

    user.password = await argon2.hash(dto.newPassword);
    await this.userRepository.save(user);

    return { message: 'Password reset successfully' };
  }
}
