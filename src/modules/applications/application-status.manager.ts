import { BadRequestException, Injectable } from '@nestjs/common';
import { StatutCandidatureEnum } from '@prisma/client';

const ALLOWED_TRANSITIONS: Partial<Record<StatutCandidatureEnum, StatutCandidatureEnum[]>> = {
  // Une candidature proposée par un agent doit pouvoir être traitée par le
  // recruteur (retenue ou refusée) et retirée par le travailleur.
  [StatutCandidatureEnum.PROPOSEE]: [
    StatutCandidatureEnum.INTERESSE,
    StatutCandidatureEnum.SELECTIONNEE,
    StatutCandidatureEnum.REFUSEE,
    StatutCandidatureEnum.RETIREE,
  ],
  [StatutCandidatureEnum.INTERESSE]: [
    StatutCandidatureEnum.SELECTIONNEE,
    StatutCandidatureEnum.REFUSEE,
    StatutCandidatureEnum.RETIREE,
  ],
  [StatutCandidatureEnum.SELECTIONNEE]: [
    StatutCandidatureEnum.CONFIRMEE,
    StatutCandidatureEnum.RETIREE,
  ],
  // Un travailleur peut se retirer même après avoir confirmé : le poste est libéré.
  [StatutCandidatureEnum.CONFIRMEE]: [StatutCandidatureEnum.RETIREE],
};

@Injectable()
export class ApplicationStatusManager {
  validateTransition(current: StatutCandidatureEnum, next: StatutCandidatureEnum): void {
    if (!ALLOWED_TRANSITIONS[current]?.includes(next)) {
      throw new BadRequestException(`Invalid application status transition: ${current} to ${next}`);
    }
  }
}
