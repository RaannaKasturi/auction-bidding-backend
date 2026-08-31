import { UserResponseDto } from './user-response.dto.js';

export class LoginResponseDto {
  message: string;
  accessToken: string;
  user: UserResponseDto;
}
