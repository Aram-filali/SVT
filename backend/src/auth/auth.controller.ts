import { Controller, Post, Body, Res, Req, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { RegisterDto, LoginDto } from './dto/index.js';
import type { Response, Request } from 'express';
import { Public, CurrentUser } from '../common/decorators/index.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === 'production' ? 5 : 1000,
      ttl: process.env.NODE_ENV === 'production' ? 900000 : 1000,
    },
  })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto, res);
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    return this.authService.refresh(refreshToken, res);
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    return this.authService.logout(refreshToken, res);
  }

  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.id);
  }
}