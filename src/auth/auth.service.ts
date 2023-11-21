import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UsersService } from '@/users/users.service';
import { compareStringWithHashByBcrypt } from '@/utils/hash';
import { SessionService } from '@/session/session.service';
import { LoginDto } from '@/auth/dto/login.dto';
import { errorMessage } from '@/utils/errorMessage';
import { RegisterDto } from '@/auth/dto/register.dto';
import { UpdateUserDto } from '@/users/dto/update-user.dto';
import { successMessage } from '@/utils/successMessage';
import { RefreshDto } from '@/auth/dto/refresh.dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UsersService,
    private sessionService: SessionService,
  ) {}

  async registration(registerDto: RegisterDto) {
    await this.userService.create(registerDto);
    return { message: successMessage.registration };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userService.findOneByEmail(loginDto.email);

    const equalsPass = await compareStringWithHashByBcrypt(
      loginDto.password || '',
      user?.password,
    );

    if (!equalsPass) {
      throw new HttpException(
        { error: errorMessage.LoginError },
        HttpStatus.BAD_REQUEST,
      );
    }
    return await this.sessionService.createSession(user);
  }

  async refreshToken(req, refreshDto: RefreshDto) {
    return await this.sessionService.refreshToken(req, refreshDto);
  }

  async update(userId: number, updateUserDto: UpdateUserDto) {
    return await this.userService.update(userId, updateUserDto);
  }

  async logout(accessToken: string) {
    await this.sessionService.revokeToken(accessToken);
    return { message: 'success' };
  }
}
