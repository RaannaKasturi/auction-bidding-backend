import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  IsOptional,
  IsBoolean,
  IsEnum,
  Matches,
} from 'class-validator';
import { UserRole } from '../../users/enums/user-role.enum.js';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one symbol',
    },
  )
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsString()
  @IsNotEmpty()
  securityQuestion: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\S+$/, { message: 'Security answer must be a single word' })
  securityAnswer: string;
}
