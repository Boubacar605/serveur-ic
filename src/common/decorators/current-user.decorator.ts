import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RoleEnum } from '../enums/role.enum';

export interface CurrentUserPayload {
  id: string;
  role: RoleEnum;
  email?: string;
}

export const CurrentUser = createParamDecorator(
  (property: keyof CurrentUserPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: CurrentUserPayload }>();
    return property ? request.user?.[property] : request.user;
  },
);
