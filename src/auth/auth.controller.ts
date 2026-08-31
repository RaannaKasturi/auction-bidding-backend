import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { SecurityQuestionResponseDto } from './dto/security-question-response.dto.js';
import { MessageResponseDto } from './dto/message-response.dto.js';
import { Public } from './decorators/public.decorator.js';

@ApiTags('Auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user with security question' })
  @ApiCreatedResponse({ type: UserResponseDto })
  register(@Body() registerDto: RegisterDto): Promise<UserResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate user and return JWT bearer token' })
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Get('security-question')
  @ApiOperation({ summary: 'Retrieve security question for password reset' })
  @ApiOkResponse({ type: SecurityQuestionResponseDto })
  getSecurityQuestion(
    @Query('identifier') identifier: string,
  ): Promise<SecurityQuestionResponseDto> {
    return this.authService.getSecurityQuestion(identifier);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using security answer' })
  @ApiOkResponse({ type: MessageResponseDto })
  resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<MessageResponseDto> {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
