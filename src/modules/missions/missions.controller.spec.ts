import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RoleEnum } from '@prisma/client';
import { ROLES_METADATA_KEY } from '../../common/constants/roles.constant';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMissionDto } from './dto/create-mission.dto';
import { MissionQueryDto } from './dto/mission-query.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';

describe('MissionsController', () => {
  const missionsService = {
    listPublic: jest.fn(),
    listMine: jest.fn(),
    listRecommended: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    publish: jest.fn(),
    close: jest.fn(),
    cancel: jest.fn(),
    start: jest.fn(),
    complete: jest.fn(),
  };
  const recruiter: CurrentUserPayload = {
    id: 'recruiter-id',
    email: 'recruiter@example.com',
    role: RoleEnum.RECRUTEUR,
  };
  const worker: CurrentUserPayload = {
    id: 'worker-id',
    email: 'worker@example.com',
    role: RoleEnum.TRAVAILLEUR,
  };
  let controller: MissionsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MissionsController(missionsService as unknown as MissionsService);
  });

  it('delegates public filters and pagination', () => {
    const query: MissionQueryDto = { page: 2, limit: 10, urgente: true };
    missionsService.listPublic.mockReturnValue({ data: [], page: 2, limit: 10, total: 0, totalPages: 0 });
    expect(controller.listPublic(query)).toEqual({ data: [], page: 2, limit: 10, total: 0, totalPages: 0 });
    expect(missionsService.listPublic).toHaveBeenCalledWith(query);
  });

  it('scopes recruiter listing and creation to the authenticated recruiter', () => {
    const query: MissionQueryDto = { page: 1, limit: 20 };
    const dto = { metierId: 'job-id', zoneId: 'zone-id' } as CreateMissionDto;
    missionsService.listMine.mockReturnValue({ data: [] });
    missionsService.create.mockReturnValue({ id: 'mission-id' });

    controller.list(recruiter, query);
    controller.create(recruiter, dto);
    expect(missionsService.listMine).toHaveBeenCalledWith(recruiter.id, query);
    expect(missionsService.create).toHaveBeenCalledWith(recruiter.id, dto);
  });

  it('scopes recommendations to the authenticated worker', () => {
    missionsService.listRecommended.mockReturnValue([]);
    expect(controller.listRecommended(worker)).toEqual([]);
    expect(missionsService.listRecommended).toHaveBeenCalledWith(worker);
  });

  it('passes ownership context to update and status transitions', () => {
    const dto = { description: 'Updated mission' } as UpdateMissionDto;
    missionsService.update.mockReturnValue({ id: 'mission-id' });
    missionsService.publish.mockReturnValue({ id: 'mission-id' });
    controller.update(recruiter, 'mission-id', dto);
    controller.publish(recruiter, 'mission-id');

    expect(missionsService.update).toHaveBeenCalledWith(recruiter.id, 'mission-id', dto);
    expect(missionsService.publish).toHaveBeenCalledWith(recruiter.id, 'mission-id', recruiter);
  });

  it('passes the recruiter identity to start and complete actions', () => {
    missionsService.start.mockReturnValue({ id: 'mission-id', statut: RoleEnum.RECRUTEUR });
    missionsService.complete.mockReturnValue({ id: 'mission-id' });

    controller.start(recruiter, 'mission-id');
    controller.complete(recruiter, 'mission-id');

    expect(missionsService.start).toHaveBeenCalledWith(recruiter.id, 'mission-id', recruiter);
    expect(missionsService.complete).toHaveBeenCalledWith(recruiter.id, 'mission-id');
  });

  it('declares the required roles and JWT guards on protected handlers', () => {
    const recruiterGuards = Reflect.getMetadata(GUARDS_METADATA, controller.create) as Function[];
    const workerGuards = Reflect.getMetadata(GUARDS_METADATA, controller.listRecommended) as Function[];
    expect(recruiterGuards).toContain(JwtAuthGuard);
    expect(recruiterGuards).toContain(RolesGuard);
    expect(Reflect.getMetadata(ROLES_METADATA_KEY, controller.create)).toEqual([RoleEnum.RECRUTEUR]);
    expect(workerGuards).toContain(JwtAuthGuard);
    expect(workerGuards).toContain(RolesGuard);
    expect(Reflect.getMetadata(ROLES_METADATA_KEY, controller.listRecommended)).toEqual([RoleEnum.TRAVAILLEUR]);
  });
});
