import { RoleEnum } from '@prisma/client';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

describe('WorkersController', () => {
  const workersService = {
    getMyProfile: jest.fn(),
    updateMyProfile: jest.fn(),
    getMyEarnings: jest.fn(),
    getMyStats: jest.fn(),
    getMyApplications: jest.fn(),
    getMyMissions: jest.fn(),
    getWorker: jest.fn(),
  };
  const user: CurrentUserPayload = {
    id: 'worker-id',
    role: RoleEnum.TRAVAILLEUR,
    email: 'worker@example.com',
  };
  let controller: WorkersController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new WorkersController(workersService as unknown as WorkersService);
  });

  it('passes the authenticated identity to profile lookup', () => {
    workersService.getMyProfile.mockReturnValue({ id: user.id });
    expect(controller.getMyProfile(user)).toEqual({ id: user.id });
    expect(workersService.getMyProfile).toHaveBeenCalledWith(user.id);
  });

  it('passes the authenticated identity and DTO to profile update', () => {
    const dto: UpdateWorkerProfileDto = {
      langue: 'fr',
      possedeSonMateriel: true,
      metierIds: ['job-id'],
      zoneIds: ['zone-id'],
    };
    workersService.updateMyProfile.mockReturnValue({ id: user.id });
    expect(controller.updateMyProfile(user, dto)).toEqual({ id: user.id });
    expect(workersService.updateMyProfile).toHaveBeenCalledWith(user.id, dto);
  });

  it('passes the authenticated identity to earnings and stats queries', () => {
    workersService.getMyEarnings.mockReturnValue({ grossRevenue: 10 });
    workersService.getMyStats.mockReturnValue({ totalApplications: 1 });
    expect(controller.getMyEarnings(user)).toEqual({ grossRevenue: 10 });
    expect(controller.getMyStats(user)).toEqual({ totalApplications: 1 });
    expect(workersService.getMyEarnings).toHaveBeenCalledWith(user.id);
    expect(workersService.getMyStats).toHaveBeenCalledWith(user.id);
  });

  it('passes the requested ID and requester to the public worker profile lookup', () => {
    workersService.getWorker.mockReturnValue({ id: 'worker-id' });
    expect(controller.getWorker(user, 'worker-id')).toEqual({ id: 'worker-id' });
    expect(workersService.getWorker).toHaveBeenCalledWith('worker-id', user);
  });
});
