import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RoleEnum } from '@prisma/client';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AdminUserQueryDto } from './dto/admin-query.dto';

describe('AdminController', () => {
  const adminService = {
    listUsers: jest.fn(),
    getUser: jest.fn(),
    updateUserStatus: jest.fn(),
    updatePremium: jest.fn(),
    listMissions: jest.fn(),
    getMission: jest.fn(),
    getMissionStats: jest.fn(),
    listCommissions: jest.fn(),
    getCommissionStats: jest.fn(),
    getRestrictedWorkers: jest.fn(),
    listJobs: jest.fn(),
    createJob: jest.fn(),
    updateJob: jest.fn(),
    deleteJob: jest.fn(),
    listZones: jest.fn(),
    createZone: jest.fn(),
    updateZone: jest.fn(),
    deleteZone: jest.fn(),
    getSettings: jest.fn(),
    patchSettings: jest.fn(),
    getPlatformStats: jest.fn(),
    updateMissionStatus: jest.fn(),
  };
  let controller: AdminController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AdminController(adminService as unknown as AdminService);
  });

  it('passes user filters to the service', () => {
    const query: AdminUserQueryDto = { page: 2, limit: 10, premium: true, nom: 'Awa' };
    controller.listUsers(query);
    expect(adminService.listUsers).toHaveBeenCalledWith(query);
  });

  it('delegates Premium activation and platform stats', () => {
    controller.updatePremium('user-id', { isPremium: true });
    controller.getPlatformStats();
    expect(adminService.updatePremium).toHaveBeenCalledWith('user-id', { isPremium: true });
    expect(adminService.getPlatformStats).toHaveBeenCalled();
  });

  it('requires JWT and AdminGuard at controller level', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController) as Function[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(AdminGuard);
  });
});
