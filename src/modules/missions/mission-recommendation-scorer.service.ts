import { Injectable } from '@nestjs/common';
import { PeriodeDispoEnum, TypeHoraireEnum } from '@prisma/client';

export interface MissionMatchingCandidate {
  metierId: string;
  zoneId: string;
  dateMission: Date;
  typeHoraire: TypeHoraireEnum | null;
  heureDebut: Date | null;
  heureFin: Date | null;
}

export interface WorkerMatchingContext {
  metierIds: string[];
  zoneIds: string[];
  disponibilites: Array<{
    dateDisponibilite: Date;
    periode: PeriodeDispoEnum;
    heureDebut: Date | null;
    heureFin: Date | null;
  }>;
}

@Injectable()
export class MissionRecommendationScorer {
  score(mission: MissionMatchingCandidate, worker: WorkerMatchingContext): number {
    let score = 0;
    if (worker.metierIds.includes(mission.metierId)) score += 100;
    if (worker.zoneIds.includes(mission.zoneId)) score += 50;
    if (worker.disponibilites.some((availability) => this.matchesAvailability(mission, availability))) {
      score += 25;
    }
    return score;
  }

  private matchesAvailability(
    mission: MissionMatchingCandidate,
    availability: WorkerMatchingContext['disponibilites'][number],
  ): boolean {
    if (availability.dateDisponibilite.toISOString().slice(0, 10) !== mission.dateMission.toISOString().slice(0, 10)) {
      return false;
    }
    if (availability.periode === PeriodeDispoEnum.JOURNEE) return true;

    if (mission.typeHoraire === TypeHoraireEnum.TRAVAIL_JOURNALIER) return false;
    if (mission.typeHoraire === TypeHoraireEnum.DEMI_JOURNEE) {
      if (!mission.heureDebut) return true;
      const period = mission.heureDebut.getUTCHours() < 12
        ? PeriodeDispoEnum.MATIN
        : PeriodeDispoEnum.APRES_MIDI;
      return availability.periode === period;
    }

    if (availability.periode !== PeriodeDispoEnum.CRENEAU || !availability.heureDebut || !availability.heureFin) {
      return false;
    }
    if (!mission.heureDebut || !mission.heureFin) return false;
    return availability.heureDebut <= mission.heureDebut && availability.heureFin >= mission.heureFin;
  }
}
