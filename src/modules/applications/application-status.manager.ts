import { BadRequestException, Injectable } from '@nestjs/common';
import { StatutCandidatureEnum } from '@prisma/client';

const ALLOWED_TRANSITIONS: Partial<Record<StatutCandidatureEnum, StatutCandidatureEnum[]>> = {
  [StatutCandidatureEnum.INTERESSE]: [
    StatutCandidatureEnum.SELECTIONNEE,
    StatutCandidatureEnum.REFUSEE,
    StatutCandidatureEnum.RETIREE,
  ],
  [StatutCandidatureEnum.SELECTIONNEE]: [StatutCandidatureEnum.CONFIRMEE],
};

@Injectable()
export class ApplicationStatusManager {
  validateTransition(current: StatutCandidatureEnum, next: StatutCandidatureEnum): void {
    if (!ALLOWED_TRANSITIONS[current]?.includes(next)) {
      throw new BadRequestException(`Invalid application status transition: ${current} to ${next}`);
    }
  }
}
