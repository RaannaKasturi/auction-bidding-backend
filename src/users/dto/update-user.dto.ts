import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @IsString()
  @IsOptional()
  securityQuestion?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\S+$/, { message: 'Security answer must be a single word' })
  securityAnswer?: string;
}
