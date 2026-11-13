import { Injectable } from '@nestjs/common';
import { Prisma, StatutCandidatureEnum, StatutMissionEnum } from '@prisma/client';

@Injectable()
export class ApplicationHistoryService {
  recordApplicationStatus(
    transaction: Prisma.TransactionClient,
    candidatureId: string,
    ancienStatut: StatutCandidatureEnum | null,
    nouveauStatut: StatutCandidatureEnum,
    changedBy: string,
  ) {
    return transaction.candidatureStatusHistory.create({
      data: { candidatureId, ancienStatut, nouveauStatut, changedBy },
    });
  }

  recordMissionStatus(
    transaction: Prisma.TransactionClient,
    missionId: string,
    ancienStatut: StatutMissionEnum,
    nouveauStatut: StatutMissionEnum,
    changedBy: string,
  ) {
    return transaction.missionStatusHistory.create({
      data: { missionId, ancienStatut, nouveauStatut, changedBy },
    });
  }
}
