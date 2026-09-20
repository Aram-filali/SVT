import { Injectable, ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto, LoginDto } from './dto/index.js';
import * as argon2 from 'argon2';
import crypto from 'crypto';
import { AccountStatus } from '../common/enums/account-status.enum.js';
import { Role } from '../common/enums/role.enum.js';
import type { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    
    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone || null,
        passwordHash,
        role: dto.role,
        status: AccountStatus.PENDING,
        ...(dto.role === Role.STUDENT ? { student: { create: {} } } : {}),
        ...(dto.role === Role.PARENT ? { parent: { create: {} } } : {}),
      },
    });

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async login(dto: LoginDto, response: Response) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === AccountStatus.PENDING) {
      throw new ForbiddenException('Account is pending activation');
    }
    if (user.status === AccountStatus.SUSPENDED) {
      throw new ForbiddenException('Account is suspended');
    }
    if (user.status === AccountStatus.ARCHIVED) {
      throw new ForbiddenException('Account is archived');
    }

    const accessToken = await this.jwtService.signAsync({ sub: user.id, role: user.role });
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt,
      },
    });

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { passwordHash: _, ...userInfo } = user;
    return { accessToken, user: userInfo };
  }

  async refresh(refreshToken: string, response: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      const revokedAgoMs = Date.now() - new Date(session.revokedAt).getTime();
      if (revokedAgoMs > 15000) {
        await this.prisma.session.updateMany({
          where: { userId: session.userId },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException('Compromised token detected');
      }
      throw new UnauthorizedException('Token already refreshed');
    }

    if (new Date() > session.expiresAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('User not active');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const newAccessToken = await this.jwtService.signAsync({ sub: user.id, role: user.role });
    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: newRefreshTokenHash,
        expiresAt,
      },
    });

    response.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { passwordHash: _, ...userInfo } = user;
    return { accessToken: newAccessToken, user: userInfo };
  }

  async logout(refreshToken: string, response: Response) {
    if (refreshToken) {
      const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const session = await this.prisma.session.findFirst({
        where: { refreshTokenHash, revokedAt: null },
      });

      if (session) {
        await this.prisma.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      }
    }

    response.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { success: true };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const { passwordHash: _, ...userInfo } = user;
    return userInfo;
  }
}
