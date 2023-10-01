import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  ClassSerializerInterceptor,
  HttpException,
  HttpStatus,
  Get,
  Req,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LoginDto } from '@/auth/dto/login.dto';
import { UsersService } from '@/users/users.service';
import PostgresErrorCodeEnum from '@/database/types/postgresErrorCode.enum';
import { UpdateUserDto } from '@/users/dto/update-user.dto';
import { hashPassword } from '@/utils/password';
import { errorMessage } from '@/utils/errorMessage';
import { AuthGuard } from '@/auth/auth.guard';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UsersService,
  ) {}

  @UseInterceptors(ClassSerializerInterceptor)
  @Post('/registration')
  async registration(@Body() registerDto: RegisterDto) {
    try {
      const user = await this.userService.create(registerDto);
      return this.authService.registration(user);
    } catch (error) {
      if (error?.code === PostgresErrorCodeEnum.UniqueViolation) {
        throw new HttpException(
          { error: errorMessage.UserWithEmailExist },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        { error: errorMessage.ServerError },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('/login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(AuthGuard)
  @Get('/profile')
  getProfile(@Req() req) {
    delete req.user.accessToken;
    delete req.user.createdAt;
    delete req.user.updatedAt;
    return req.user;
  }

  @UseGuards(AuthGuard)
  @Patch('/profile')
  async update(@Req() req, @Body() updateUserDto: UpdateUserDto) {
    if (updateUserDto.password) {
      updateUserDto.password = await hashPassword(updateUserDto.password);
    }
    return this.userService.update(req.user.id, updateUserDto);
  }

  @UseGuards(AuthGuard)
  @Post('/logout')
  async logout(@Req() req) {
    return this.authService.logout(req.user);
  }
}
