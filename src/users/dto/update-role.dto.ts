import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '../enums/user-role.enum.js';

export class UpdateRoleDto {
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}
