import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

interface AdminRequest {
  user?: CurrentUserPayload;
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    if (request.user?.role !== RoleEnum.ADMINISTRATEUR) {
      throw new ForbiddenException('Administrator role required');
    }
    return true;
  }
}
