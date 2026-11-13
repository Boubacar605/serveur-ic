import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RoleEnum } from '@prisma/client';
import { ROLES_METADATA_KEY } from '../../common/constants/roles.constant';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AvailabilityResponseDto } from './dto/availability-response.dto';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

describe('AvailabilityController', () => {
  const availabilityService = {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const user: CurrentUserPayload = {
    id: 'worker-id',
    email: 'worker@example.com',
    role: RoleEnum.TRAVAILLEUR,
  };
  let controller: AvailabilityController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AvailabilityController(availabilityService as unknown as AvailabilityService);
  });

  it('requires JWT authentication and the worker role for every route', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AvailabilityController) as Function[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(Reflect.getMetadata(ROLES_METADATA_KEY, AvailabilityController)).toEqual([RoleEnum.TRAVAILLEUR]);
  });

  it('scopes list and create calls to the current worker', () => {
    const dto: CreateAvailabilityDto = {
      dateDisponibilite: '2027-01-15',
      periode: 'MATIN' as CreateAvailabilityDto['periode'],
      heureDebut: null,
      heureFin: null,
    };
    const response = { id: 'availability-id' } as AvailabilityResponseDto;
    availabilityService.list.mockReturnValue([response]);
    availabilityService.create.mockReturnValue(response);

    expect(controller.list(user)).toEqual([response]);
    expect(controller.create(user, dto)).toBe(response);
    expect(availabilityService.list).toHaveBeenCalledWith(user.id);
    expect(availabilityService.create).toHaveBeenCalledWith(user.id, dto);
  });

  it('scopes get, patch, and delete calls to the current worker', () => {
    const dto: UpdateAvailabilityDto = { periode: 'APRES_MIDI' as UpdateAvailabilityDto['periode'] };
    const response = { id: 'availability-id' } as AvailabilityResponseDto;
    availabilityService.getById.mockReturnValue(response);
    availabilityService.update.mockReturnValue(response);
    availabilityService.remove.mockReturnValue(undefined);

    expect(controller.getById(user, 'availability-id')).toBe(response);
    expect(controller.update(user, 'availability-id', dto)).toBe(response);
    expect(controller.remove(user, 'availability-id')).toBeUndefined();
    expect(availabilityService.getById).toHaveBeenCalledWith(user.id, 'availability-id');
    expect(availabilityService.update).toHaveBeenCalledWith(user.id, 'availability-id', dto);
    expect(availabilityService.remove).toHaveBeenCalledWith(user.id, 'availability-id');
  });
});
