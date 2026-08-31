import { UserRole } from '../../users/enums/user-role.enum.js';

export class UserResponseDto {
  id: string;
  username: string;
  name?: string;
  role: UserRole;
  isPrivate: boolean;
  createdAt: Date;
}
