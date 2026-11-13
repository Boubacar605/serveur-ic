import { RoleEnum } from '@prisma/client';

export interface CurrentUserPayload {
  id: string;
  email: string;
  role: RoleEnum;
}
