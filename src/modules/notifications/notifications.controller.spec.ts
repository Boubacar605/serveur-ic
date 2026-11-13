import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RoleEnum } from '@prisma/client';
import { ROLES_METADATA_KEY } from '../../common/constants/roles.constant';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MissionBroadcastDto } from './dto/mission-broadcast.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  const notificationsService = {
    list: jest.fn(),
    getById: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    unreadCount: jest.fn(),
    broadcastMission: jest.fn(),
  };
  const worker: CurrentUserPayload = {
    id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61',
    email: 'worker@example.com',
    role: RoleEnum.TRAVAILLEUR,
  };
  const recruiter: CurrentUserPayload = {
    id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad62',
    email: 'recruiter@example.com',
    role: RoleEnum.RECRUTEUR,
  };
  let controller: NotificationsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new NotificationsController(notificationsService as unknown as NotificationsService);
  });

  it('scopes paginated listing, detail, and read operations to the authenticated user', async () => {
    const query: NotificationQueryDto = { page: 2, limit: 10, lu: false };
    notificationsService.list.mockResolvedValue({ data: [], page: 2, limit: 10, total: 0, totalPages: 0 });
    notificationsService.getById.mockResolvedValue({ id: 'notification-id' });
    notificationsService.markRead.mockResolvedValue({ id: 'notification-id', lu: true });
    notificationsService.markAllRead.mockResolvedValue({ count: 2 });
    notificationsService.unreadCount.mockResolvedValue(8);

    await controller.list(worker, query);
    await controller.getById(worker, 'notification-id');
    await controller.markRead(worker, 'notification-id');
    await controller.markAllRead(worker);
    await controller.unreadCount(worker);

    expect(notificationsService.list).toHaveBeenCalledWith(worker.id, query);
    expect(notificationsService.getById).toHaveBeenCalledWith(worker.id, 'notification-id');
    expect(notificationsService.markRead).toHaveBeenCalledWith(worker.id, 'notification-id');
    expect(notificationsService.markAllRead).toHaveBeenCalledWith(worker.id);
    expect(notificationsService.unreadCount).toHaveBeenCalledWith(worker.id);
  });

  it('passes the recruiter identity and selected recipients to mission broadcast', () => {
    const dto: MissionBroadcastDto = {
      missionId: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad63',
      workerIds: ['c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad64'],
    };
    notificationsService.broadcastMission.mockReturnValue({ workersNotified: 1 });

    expect(controller.broadcastMission(recruiter, dto)).toEqual({ workersNotified: 1 });
    expect(notificationsService.broadcastMission).toHaveBeenCalledWith(recruiter.id, dto);
  });

  it('requires JWT on every route and the recruiter role on broadcast', () => {
    const controllerGuards = Reflect.getMetadata(GUARDS_METADATA, NotificationsController) as Function[];
    const broadcastGuards = Reflect.getMetadata(GUARDS_METADATA, controller.broadcastMission) as Function[];

    expect(controllerGuards).toContain(JwtAuthGuard);
    expect(broadcastGuards).toContain(RolesGuard);
    expect(Reflect.getMetadata(ROLES_METADATA_KEY, controller.broadcastMission)).toEqual([RoleEnum.RECRUTEUR]);
  });
});
