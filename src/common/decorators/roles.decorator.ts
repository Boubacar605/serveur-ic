import { SetMetadata } from '@nestjs/common';
import { ROLES_METADATA_KEY } from '../constants/roles.constant';
import { RoleEnum } from '../enums/role.enum';

export const Roles = (...roles: RoleEnum[]) => SetMetadata(ROLES_METADATA_KEY, roles);
