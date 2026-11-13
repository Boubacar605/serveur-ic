import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  RoleEnum,
  StatutMissionEnum,
  TypeHoraireEnum,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CreateMissionDto } from './dto/create-mission.dto';
import { MissionDetailsDto } from './dto/mission-details.dto';
import { MissionListDto } from './dto/mission-list.dto';
import { MissionQueryDto } from './dto/mission-query.dto';
import { MissionResponseDto } from './dto/mission-response.dto';
import { RecommendedMissionDto } from './dto/recommended-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import {
  MissionRecommendationScorer,
  WorkerMatchingContext,
} from './mission-recommendation-scorer.service';
import { CommissionsService } from '../commissions/commissions.service';

const OPEN_MISSION_STATUSES: StatutMissionEnum[] = [
  StatutMissionEnum.PUBLIEE,
  StatutMissionEnum.PARTIELLEMENT_POURVUE,
];

const MISSION_TRANSITIONS: Partial<Record<StatutMissionEnum, StatutMissionEnum[]>> = {
  [StatutMissionEnum.PUBLIEE]: [StatutMissionEnum.BROUILLON],
  [StatutMissionEnum.EN_COURS]: [
    StatutMissionEnum.POURVUE,
    StatutMissionEnum.PARTIELLEMENT_POURVUE,
  ],
  [StatutMissionEnum.CLOTUREE]: [
    StatutMissionEnum.PUBLIEE,
    StatutMissionEnum.PARTIELLEMENT_POURVUE,
    StatutMissionEnum.POURVUE,
  ],
  [StatutMissionEnum.ANNULEE]: [
    StatutMissionEnum.BROUILLON,
    StatutMissionEnum.PUBLIEE,
    StatutMissionEnum.PARTIELLEMENT_POURVUE,
    StatutMissionEnum.POURVUE,
  ],
};

const missionInclude = {
  metier: { select: { id: true, code: true, libelle: true, categorie: true } },
  zone: { select: { id: true, nom: true, niveau: true } },
  recruteur: {
    select: {
      typeRecruteur: true,
      raisonSociale: true,
      user: { select: { id: true, nom: true } },
    },
  },
  _count: { select: { candidatures: true } },
} satisfies Prisma.MissionsInclude;

type MissionRecord = Prisma.MissionsGetPayload<{ include: typeof missionInclude }>;

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendationScorer: MissionRecommendationScorer,
    private readonly commissions: CommissionsService,
  ) {}

  async listPublic(query: MissionQueryDto): Promise<MissionListDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.publicMissionWhere(query);
    const [missions, total] = await this.prisma.$transaction([
      this.prisma.missions.findMany({
        where,
        include: missionInclude,
        orderBy: { dateMission: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.missions.count({ where }),
    ]);
    return this.toMissionList(missions, page, limit, total);
  }

  async listMine(recruiterId: string, query: MissionQueryDto): Promise<MissionListDto> {
    await this.ensureRecruiter(recruiterId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.MissionsWhereInput = {
      recruteurId: recruiterId,
      deletedAt: null,
      ...(query.metierId ? { metierId: query.metierId } : {}),
      ...(query.zoneId ? { zoneId: query.zoneId } : {}),
      ...(query.urgente !== undefined ? { urgente: query.urgente } : {}),
      ...(query.dateMission ? { dateMission: this.parseDate(query.dateMission) } : {}),
    };
    const [missions, total] = await this.prisma.$transaction([
      this.prisma.missions.findMany({
        where,
        include: missionInclude,
        orderBy: [{ createdAt: 'desc' }, { dateMission: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.missions.count({ where }),
    ]);
    return this.toMissionList(missions, page, limit, total);
  }

  async getById(id: string, requester?: CurrentUserPayload): Promise<MissionDetailsDto> {
    const mission = await this.prisma.missions.findFirst({
      where: { id, deletedAt: null },
      include: missionInclude,
    });
    if (!mission) {
      throw new NotFoundException('Mission not found');
    }
    const canSeeAll = requester?.role === RoleEnum.ADMINISTRATEUR || requester?.id === mission.recruteurId;
    if (!canSeeAll && (!OPEN_MISSION_STATUSES.includes(mission.statut) || this.isMissionExpired(mission.dateMission))) {
      throw new NotFoundException('Mission not found');
    }

    const nombreConfirmations = await this.prisma.confirmations.count({
      where: { candidature: { is: { missionId: id } } },
    });
    return {
      ...this.toMissionResponse(mission),
      nombreConfirmations,
      placesRestantes: this.calculateRemainingSeats(mission.nombrePostes, nombreConfirmations),
    };
  }

  async listRecommended(worker: CurrentUserPayload): Promise<RecommendedMissionDto[]> {
    const today = this.startOfToday();
    const profile = await this.prisma.travailleurs.findFirst({
      where: { userId: worker.id, deletedAt: null },
      include: {
        profilMetiers: { where: { deletedAt: null }, select: { metierId: true } },
        travailleurZones: { select: { zoneId: true } },
        disponibilites: {
          where: { deletedAt: null, dateDisponibilite: { gte: today } },
          select: { dateDisponibilite: true, periode: true, heureDebut: true, heureFin: true },
        },
      },
    });
    if (!profile) throw new NotFoundException('Worker profile not found');

    const context: WorkerMatchingContext = {
      metierIds: profile.profilMetiers.map((item) => item.metierId),
      zoneIds: profile.travailleurZones.map((item) => item.zoneId),
      disponibilites: profile.disponibilites.map((item) => ({
        dateDisponibilite: item.dateDisponibilite,
        periode: item.periode,
        heureDebut: item.heureDebut,
        heureFin: item.heureFin,
      })),
    };
    const missions = await this.prisma.missions.findMany({
      where: {
        statut: { in: OPEN_MISSION_STATUSES },
        deletedAt: null,
        dateMission: { gte: today },
      },
      include: missionInclude,
      orderBy: { dateMission: 'asc' },
    });

    return missions
      .map((mission) => ({
        ...this.toMissionResponse(mission),
        matchingScore: this.recommendationScorer.score(mission, context),
      }))
      .filter((mission) => mission.matchingScore > 0)
      .sort((left, right) => right.matchingScore - left.matchingScore || left.dateMission.localeCompare(right.dateMission));
  }

  async create(recruiterId: string, dto: CreateMissionDto): Promise<MissionResponseDto> {
    await this.ensureRecruiter(recruiterId);
    const [metier, zone] = await Promise.all([
      this.prisma.metiers.findFirst({
        where: { id: dto.metierId, actif: true, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.zones.findFirst({ where: { id: dto.zoneId, deletedAt: null }, select: { id: true } }),
    ]);
    if (!metier) throw new NotFoundException('Active job reference not found');
    if (!zone) throw new NotFoundException('Zone not found');

    this.validateTimeRange(dto.typeHoraire ?? null, dto.heureDebut ?? null, dto.heureFin ?? null);
    const mission = await this.prisma.missions.create({
      data: {
        id: randomUUID(),
        recruteurId: recruiterId,
        metierId: dto.metierId,
        zoneId: dto.zoneId,
        lieu: dto.lieu ?? null,
        description: dto.description,
        nombrePostes: dto.nombrePostes,
        remunerationFcfa: BigInt(dto.remunerationFcfa),
        dateMission: this.parseDate(dto.dateMission),
        typeHoraire: dto.typeHoraire ?? null,
        heureDebut: this.parseTime(dto.heureDebut ?? null),
        heureFin: this.parseTime(dto.heureFin ?? null),
        urgente: dto.urgente ?? false,
        modeAttribution: dto.modeAttribution,
        statut: StatutMissionEnum.BROUILLON,
      },
      include: missionInclude,
    });
    return this.toMissionResponse(mission);
  }

  async update(recruiterId: string, id: string, dto: UpdateMissionDto): Promise<MissionResponseDto> {
    const current = await this.findOwnedMission(recruiterId, id);
    if ([StatutMissionEnum.TERMINEE, StatutMissionEnum.CLOTUREE, StatutMissionEnum.ANNULEE]
      .some((status) => status === current.statut)) {
      throw new BadRequestException(`A mission with status ${current.statut} cannot be modified`);
    }

    const typeHoraire = dto.typeHoraire === undefined ? current.typeHoraire : dto.typeHoraire;
    const heureDebut = dto.heureDebut === undefined ? this.timeToString(current.heureDebut) : dto.heureDebut;
    const heureFin = dto.heureFin === undefined ? this.timeToString(current.heureFin) : dto.heureFin;
    this.validateTimeRange(typeHoraire, heureDebut ?? null, heureFin ?? null);

    const data: Prisma.MissionsUncheckedUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.lieu !== undefined) data.lieu = dto.lieu;
    if (dto.nombrePostes !== undefined) {
      const confirmed = await this.prisma.confirmations.count({
        where: { candidature: { is: { missionId: id } } },
      });
      if (dto.nombrePostes < confirmed) {
        throw new BadRequestException('nombrePostes cannot be lower than the number of confirmed candidates');
      }
      data.nombrePostes = dto.nombrePostes;
    }
    if (dto.remunerationFcfa !== undefined) data.remunerationFcfa = BigInt(dto.remunerationFcfa);
    if (dto.dateMission !== undefined) {
      const nextDate = this.parseDate(dto.dateMission);
      if (current.statut !== StatutMissionEnum.BROUILLON && nextDate < this.startOfToday()) {
        throw new BadRequestException('A published mission cannot be moved to a past date');
      }
      data.dateMission = nextDate;
    }
    if (dto.typeHoraire !== undefined) data.typeHoraire = dto.typeHoraire;
    if (dto.heureDebut !== undefined) data.heureDebut = this.parseTime(dto.heureDebut);
    if (dto.heureFin !== undefined) data.heureFin = this.parseTime(dto.heureFin);
    if (dto.urgente !== undefined) data.urgente = dto.urgente;
    if (dto.modeAttribution !== undefined) data.modeAttribution = dto.modeAttribution;

    const mission = await this.prisma.missions.update({ where: { id }, data, include: missionInclude });
    return this.toMissionResponse(mission);
  }

  async remove(recruiterId: string, id: string): Promise<void> {
    await this.findOwnedMission(recruiterId, id);
    const confirmed = await this.prisma.confirmations.count({
      where: { candidature: { is: { missionId: id } } },
    });
    if (confirmed > 0) {
      throw new BadRequestException('A mission with confirmed candidates cannot be deleted');
    }
    await this.prisma.missions.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  publish(recruiterId: string, id: string, user: CurrentUserPayload): Promise<MissionResponseDto> {
    return this.changeMissionStatus(recruiterId, id, user.id, StatutMissionEnum.PUBLIEE);
  }

  close(recruiterId: string, id: string, user: CurrentUserPayload): Promise<MissionResponseDto> {
    return this.changeMissionStatus(recruiterId, id, user.id, StatutMissionEnum.CLOTUREE);
  }

  cancel(recruiterId: string, id: string, user: CurrentUserPayload): Promise<MissionResponseDto> {
    return this.changeMissionStatus(recruiterId, id, user.id, StatutMissionEnum.ANNULEE);
  }

  start(recruiterId: string, id: string, user: CurrentUserPayload): Promise<MissionResponseDto> {
    return this.changeMissionStatus(recruiterId, id, user.id, StatutMissionEnum.EN_COURS);
  }

  async complete(recruiterId: string, id: string): Promise<MissionResponseDto> {
    await this.commissions.completeMission(recruiterId, id);
    const mission = await this.prisma.missions.findFirst({
      where: { id, recruteurId: recruiterId, deletedAt: null },
      include: missionInclude,
    });
    if (!mission) throw new NotFoundException('Mission not found');
    return this.toMissionResponse(mission);
  }

  private async changeMissionStatus(
    recruiterId: string,
    missionId: string,
    changedBy: string,
    nextStatus: StatutMissionEnum,
  ): Promise<MissionResponseDto> {
    const mission = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.missions.findFirst({
        where: { id: missionId, deletedAt: null },
        select: { id: true, recruteurId: true, statut: true, dateMission: true },
      });
      if (!current) throw new NotFoundException('Mission not found');
      if (current.recruteurId !== recruiterId) throw new ForbiddenException('You do not own this mission');

      const allowedFrom = MISSION_TRANSITIONS[nextStatus] ?? [];
      if (!allowedFrom.includes(current.statut)) {
        throw new BadRequestException(`Invalid mission status transition: ${current.statut} to ${nextStatus}`);
      }
      if (nextStatus === StatutMissionEnum.PUBLIEE && this.isMissionExpired(current.dateMission)) {
        throw new BadRequestException('An expired mission cannot be published');
      }

      const changed = await transaction.missions.update({
        where: { id: missionId },
        data: {
          statut: nextStatus,
          ...(nextStatus === StatutMissionEnum.PUBLIEE ? { datePublication: this.startOfToday() } : {}),
          ...([StatutMissionEnum.CLOTUREE, StatutMissionEnum.ANNULEE].some((status) => status === nextStatus)
            ? { dateCloture: this.startOfToday() }
            : {}),
        },
        include: missionInclude,
      });
      await this.recordMissionHistory(transaction, missionId, current.statut, nextStatus, changedBy);
      return changed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.toMissionResponse(mission);
  }

  private async recordMissionHistory(
    transaction: Prisma.TransactionClient,
    missionId: string,
    ancienStatut: StatutMissionEnum,
    nouveauStatut: StatutMissionEnum,
    changedBy: string,
  ): Promise<void> {
    await transaction.missionStatusHistory.create({
      data: { missionId, ancienStatut, nouveauStatut, changedBy },
    });
  }

  private async findOwnedMission(recruiterId: string, id: string) {
    const mission = await this.prisma.missions.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, recruteurId: true, statut: true, dateMission: true, heureDebut: true, heureFin: true, typeHoraire: true },
    });
    if (!mission) throw new NotFoundException('Mission not found');
    if (mission.recruteurId !== recruiterId) throw new ForbiddenException('You do not own this mission');
    return mission;
  }

  private async ensureRecruiter(recruiterId: string): Promise<void> {
    const recruiter = await this.prisma.recruteurs.findFirst({
      where: { userId: recruiterId, deletedAt: null },
      select: { userId: true },
    });
    if (!recruiter) throw new NotFoundException('Recruiter profile not found');
  }

  private publicMissionWhere(query: MissionQueryDto): Prisma.MissionsWhereInput {
    const dateMission: Prisma.DateTimeFilter<'Missions'> = { gte: this.startOfToday() };
    if (query.dateMission) dateMission.equals = this.parseDate(query.dateMission);
    return {
      statut: { in: OPEN_MISSION_STATUSES },
      deletedAt: null,
      dateMission,
      ...(query.metierId ? { metierId: query.metierId } : {}),
      ...(query.zoneId ? { zoneId: query.zoneId } : {}),
      ...(query.urgente !== undefined ? { urgente: query.urgente } : {}),
    };
  }

  private toMissionList(missions: MissionRecord[], page: number, limit: number, total: number): MissionListDto {
    return {
      data: missions.map((mission) => this.toMissionResponse(mission)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  private toMissionResponse(mission: MissionRecord): MissionResponseDto {
    return {
      id: mission.id,
      recruteurId: mission.recruteurId,
      metierId: mission.metierId,
      zoneId: mission.zoneId,
      lieu: mission.lieu,
      description: mission.description,
      nombrePostes: mission.nombrePostes,
      remunerationFcfa: Number(mission.remunerationFcfa),
      dateMission: this.formatDate(mission.dateMission),
      datePublication: mission.datePublication ? this.formatDate(mission.datePublication) : null,
      dateCloture: mission.dateCloture ? this.formatDate(mission.dateCloture) : null,
      typeHoraire: mission.typeHoraire,
      heureDebut: this.timeToString(mission.heureDebut),
      heureFin: this.timeToString(mission.heureFin),
      urgente: mission.urgente,
      modeAttribution: mission.modeAttribution,
      statut: mission.statut,
      metier: mission.metier,
      zone: mission.zone,
      recruteur: {
        id: mission.recruteur.user.id,
        nom: mission.recruteur.user.nom,
        typeRecruteur: mission.recruteur.typeRecruteur,
        raisonSociale: mission.recruteur.raisonSociale,
      },
      nombreCandidatures: mission._count.candidatures,
      createdAt: mission.createdAt.toISOString(),
      updatedAt: mission.updatedAt.toISOString(),
    };
  }

  private calculateRemainingSeats(nombrePostes: number, nombreConfirmations: number): number {
    return Math.max(0, nombrePostes - nombreConfirmations);
  }

  private isMissionExpired(dateMission: Date): boolean {
    return dateMission < this.startOfToday();
  }

  private startOfToday(): Date {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  private parseDate(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('dateMission must be a valid ISO date');
    }
    return date;
  }

  private parseTime(value: string | null): Date | null {
    if (value == null) return null;
    const normalized = value.length === 5 ? `${value}:00` : value;
    const time = new Date(`1970-01-01T${normalized}Z`);
    if (Number.isNaN(time.getTime())) throw new BadRequestException('Mission time is invalid');
    return time;
  }

  private timeToString(value: Date | null): string | null {
    return value ? value.toISOString().slice(11, 19) : null;
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private validateTimeRange(
    typeHoraire: TypeHoraireEnum | null,
    heureDebut: string | null,
    heureFin: string | null,
  ): void {
    if (typeHoraire === TypeHoraireEnum.CRENEAU_PRECIS && (!heureDebut || !heureFin)) {
      throw new BadRequestException('heureDebut and heureFin are required for CRENEAU_PRECIS missions');
    }
    if (heureDebut && heureFin && this.parseTime(heureFin)!.getTime() <= this.parseTime(heureDebut)!.getTime()) {
      throw new BadRequestException('heureFin must be later than heureDebut');
    }
  }
}
