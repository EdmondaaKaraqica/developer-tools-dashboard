import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string;
  role: 'admin';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    const expectedUser = this.config.getOrThrow<string>('ADMIN_USERNAME').trim();
    if (dto.username !== expectedUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const hash = this.config.get<string>('ADMIN_PASSWORD_HASH')?.trim();

    if (!hash) {
      this.logger.error(
        'Missing ADMIN_PASSWORD_HASH. Check backend/.env or the quoted hash in .env.example.',
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!hash.startsWith('$2')) {
      this.logger.error(
        'ADMIN_PASSWORD_HASH looks truncated. Wrap the full bcrypt value in double quotes in .env (Windows).',
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, hash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = { sub: expectedUser, role: 'admin' };
    const access_token = await this.jwt.signAsync(payload);
    return { access_token };
  }
}
