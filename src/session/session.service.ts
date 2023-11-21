import { Injectable } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Session } from '@/session/entities/session.entity';
import { RefreshDto } from '@/auth/dto/refresh.dto';
import { UnauthorizedException } from '@/utils/exception/unauthorizedException';
import { getRandomUuid } from '@/utils/uuid';
import {
  compareStringWithHashByBcrypt,
  hashStringByBcrypt,
  hashStringBySha256,
} from '@/utils/hash';
import { SALT_FOR_TOKEN } from '@/session/constants';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async createSession(user: User) {
    const tokens = await this.generateTokens(user);
    const hashedTokens = await this.hashTokens(tokens);

    await this.saveTokens({
      accessToken: tokens.access_token,
      refreshToken: hashedTokens.refresh_token,
      user: user,
      revoked: false,
    });

    return tokens;
  }

  async saveTokens(createSessionDto: CreateSessionDto) {
    const session = await this.sessionRepository.create(createSessionDto);
    await this.sessionRepository.save(session);
    return session;
  }

  async hashTokens(tokens) {
    const hashRefreshToken = await hashStringByBcrypt(
      hashStringBySha256(tokens.refresh_token),
      SALT_FOR_TOKEN,
    );

    return {
      access_token: tokens.access_token,
      refresh_token: hashRefreshToken,
    };
  }

  async findByAccessToken(accessToken: string) {
    return await this.sessionRepository.findOneBy({ accessToken });
  }

  async deleteByAccessToken(token: string) {
    return await this.sessionRepository.delete(token);
  }

  async verifyToken(token, secretKey) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: secretKey,
      });
      return { ...payload, expired: false };
    } catch (e) {
      return { expired: true };
    }
  }

  async refreshToken(req, refreshDto: RefreshDto) {
    const accessToken = req.accessToken;
    const refreshTokenIsVerify = await this.verifyToken(
      refreshDto.refresh_token,
      this.configService.get('REFRESH_TOKEN_SECRET_KEY'),
    );

    const tokensFromDb = await this.findByAccessToken(accessToken);
    const refreshTokenIsValid = await compareStringWithHashByBcrypt(
      hashStringBySha256(refreshDto.refresh_token),
      tokensFromDb.refreshToken,
    );
    if (refreshTokenIsVerify.expired || !refreshTokenIsValid) {
      throw new UnauthorizedException();
    }

    await this.revokeToken(accessToken);

    return this.createSession(req.user);
  }

  async revokeToken(accessToken: string) {
    return await this.sessionRepository.update(
      { accessToken },
      { revoked: true },
    );
  }

  async generateTokens(user: User) {
    const payload = { id: user.id };
    const options = { jwtid: getRandomUuid() };
    const accessToken = await this.generateAccessToken(payload, options);
    const refreshToken = await this.generateRefreshToken(payload, options);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async generateAccessToken(payload, options) {
    return await this.jwtService.signAsync(payload, {
      secret: this.configService.get('ACCESS_TOKEN_SECRET_KEY'),
      expiresIn: `${this.configService.get('ACCESS_TOKEN_EXPIRATION')}s`,
      ...options,
    });
  }

  async generateRefreshToken(payload, options) {
    return await this.jwtService.signAsync(payload, {
      secret: this.configService.get('REFRESH_TOKEN_SECRET_KEY'),
      expiresIn: `${this.configService.get('REFRESH_TOKEN_EXPIRATION')}s`,
      ...options,
    });
  }
}
