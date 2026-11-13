import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CurrentUserPayload } from './interfaces/current-user-payload.interface';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { LoginDto } from './dto/login.dto';
import { RoleEnum } from '@prisma/client';

describe('AuthController', () => {
  const authService = {
    registerWorker: jest.fn(),
    registerRecruiter: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    me: jest.fn(),
  };
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(authService as unknown as AuthService);
  });

  it('delegates worker registration to AuthService', () => {
    const dto = { email: 'worker@example.com' } as RegisterWorkerDto;
    authService.registerWorker.mockReturnValue({ message: 'created' });

    expect(controller.registerWorker(dto)).toEqual({ message: 'created' });
    expect(authService.registerWorker).toHaveBeenCalledWith(dto);
  });

  it('delegates login to AuthService', () => {
    const dto = { email: 'worker@example.com', password: 'StrongPass123!' } as LoginDto;
    authService.login.mockReturnValue({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 3600 });

    expect(controller.login(dto)).toEqual({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 3600 });
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('passes the current Supabase bearer token to logout', () => {
    authService.logout.mockReturnValue({ message: 'Logged out successfully' });

    expect(controller.logout('Bearer access-token')).toEqual({ message: 'Logged out successfully' });
    expect(authService.logout).toHaveBeenCalledWith('access-token');
  });

  it('passes the guard-hydrated user to AuthService.me', () => {
    const user: CurrentUserPayload = {
      id: 'auth-user-id',
      email: 'worker@example.com',
      role: RoleEnum.TRAVAILLEUR,
    };
    authService.me.mockReturnValue({ id: user.id, role: user.role });

    expect(controller.me(user)).toEqual({ id: user.id, role: user.role });
    expect(authService.me).toHaveBeenCalledWith(user);
  });
});
