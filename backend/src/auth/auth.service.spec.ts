import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const config = {
    getOrThrow: jest.fn(),
    get: jest.fn(),
  } as unknown as ConfigService;

  const jwt = {
    signAsync: jest.fn(),
  } as unknown as JwtService;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns access_token for valid credentials', async () => {
    (config.getOrThrow as jest.Mock).mockImplementation((k: string) => {
      if (k === 'ADMIN_USERNAME') return 'admin';
      throw new Error(`unexpected ${k}`);
    });
    (config.get as jest.Mock).mockImplementation((k: string) => {
      if (k === 'ADMIN_PASSWORD_HASH') return '$2b$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      return undefined;
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as unknown as never);
    (jwt.signAsync as jest.Mock).mockResolvedValue('jwt-token');

    const svc = new AuthService(config, jwt);
    await expect(
      svc.login({ username: 'admin', password: 'password' }),
    ).resolves.toEqual({ access_token: 'jwt-token' });
  });

  it('rejects invalid username', async () => {
    (config.getOrThrow as jest.Mock).mockReturnValue('admin');
    const svc = new AuthService(config, jwt);
    await expect(
      svc.login({ username: 'nope', password: 'password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid password', async () => {
    (config.getOrThrow as jest.Mock).mockReturnValue('admin');
    (config.get as jest.Mock).mockReturnValue(
      '$2b$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as unknown as never);

    const svc = new AuthService(config, jwt);
    await expect(
      svc.login({ username: 'admin', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

