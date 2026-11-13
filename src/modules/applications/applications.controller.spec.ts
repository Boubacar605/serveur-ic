import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RoleEnum } from '@prisma/client';
import { ROLES_METADATA_KEY } from '../../common/constants/roles.constant';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApplicationQueryDto } from './dto/application-query.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

describe('ApplicationsController', () => {
  const applicationsService = {
    create: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    select: jest.fn(),
    reject: jest.fn(),
    confirm: jest.fn(),
    withdraw: jest.fn(),
  };
  const worker: CurrentUserPayload = { id: 'worker-id', email: 'worker@example.com', role: RoleEnum.TRAVAILLEUR };
  const recruiter: CurrentUserPayload = { id: 'recruiter-id', email: 'recruiter@example.com', role: RoleEnum.RECRUTEUR };
  let controller: ApplicationsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ApplicationsController(applicationsService as unknown as ApplicationsService);
  });

  it('passes the current user to create and paginated listing', () => {
    const createDto: CreateApplicationDto = { missionId: 'mission-id' };
    const query: ApplicationQueryDto = { page: 1, limit: 20 };
    applicationsService.create.mockReturnValue({ id: 'application-id' });
    applicationsService.list.mockReturnValue({ data: [], page: 1, limit: 20, total: 0, totalPages: 0 });

    controller.create(worker, createDto);
    controller.list(recruiter, query);
    expect(applicationsService.create).toHaveBeenCalledWith(worker, createDto);
    expect(applicationsService.list).toHaveBeenCalledWith(recruiter, query);
  });

  it('delegates read and status actions with caller identity', () => {
    applicationsService.getById.mockReturnValue({ id: 'application-id' });
    applicationsService.select.mockReturnValue({ id: 'application-id' });
    applicationsService.reject.mockReturnValue({ id: 'application-id' });
    applicationsService.confirm.mockReturnValue({ id: 'application-id' });
    applicationsService.withdraw.mockReturnValue({ id: 'application-id' });

    controller.getById(worker, 'application-id');
    controller.select(recruiter, 'application-id');
    controller.reject(recruiter, 'application-id');
    controller.confirm(worker, 'application-id');
    controller.withdraw(worker, 'application-id');

    expect(applicationsService.getById).toHaveBeenCalledWith(worker, 'application-id');
    expect(applicationsService.select).toHaveBeenCalledWith(recruiter, 'application-id');
    expect(applicationsService.reject).toHaveBeenCalledWith(recruiter, 'application-id');
    expect(applicationsService.confirm).toHaveBeenCalledWith(worker, 'application-id');
    expect(applicationsService.withdraw).toHaveBeenCalledWith(worker, 'application-id');
  });

  it('declares JWT authentication and the required route roles', () => {
    const controllerGuards = Reflect.getMetadata(GUARDS_METADATA, ApplicationsController) as Function[];
    expect(controllerGuards).toContain(JwtAuthGuard);

    for (const [handler, role] of [
      [controller.create, RoleEnum.TRAVAILLEUR],
      [controller.select, RoleEnum.RECRUTEUR],
      [controller.reject, RoleEnum.RECRUTEUR],
      [controller.confirm, RoleEnum.TRAVAILLEUR],
      [controller.withdraw, RoleEnum.TRAVAILLEUR],
    ] as const) {
      const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as Function[];
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(ROLES_METADATA_KEY, handler)).toEqual([role]);
    }
  });
});
