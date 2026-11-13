import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CanalEnum,
  Prisma,
  RoleEnum,
  StatutCompteEnum,
  StatutMessageEnum,
  StatutMissionEnum,
} from '@prisma/client';
import { randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../auth/services/supabase.service';
import { CommissionsService } from '../commissions/commissions.service';
import { CommissionPolicyService } from '../commissions/commission-policy.service';
import { CommissionPaymentListDto, CommissionPaymentResultDto } from '../commissions/dto/commission-payment.dto';
import { RecordCommissionPaymentDto } from '../commissions/dto/record-commission-payment.dto';
import { WorkerRestrictionService } from '../commissions/worker-restriction.service';
import { AdminCommissionStatsDto } from './dto/admin-commission-stats.dto';
import { AdminCommissionQueryDto, AdminMissionQueryDto, AdminUserQueryDto } from './dto/admin-query.dto';
import { AdminCreatedUserDto } from './dto/admin-created-user.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { AdminMissionDto } from './dto/admin-mission.dto';
import { AdminMissionStatsDto } from './dto/admin-mission-stats.dto';
import { AdminUserDto } from './dto/admin-user.dto';
import { AdminCommissionListDto, AdminMissionListDto, AdminUserListDto } from './dto/admin-paginated.dto';
import { CreateMetierDto } from './dto/create-metier.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { PatchSettingsDto } from './dto/patch-settings.dto';
import { UpdateMissionStatusDto } from './dto/update-mission-status.dto';
import { UpdatePremiumDto } from './dto/update-premium.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateMetierDto } from './dto/update-metier.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';

const ADMIN_MISSION_TRANSITIONS: Partial<Record<StatutMissionEnum, StatutMissionEnum[]>> = {
  [StatutMissionEnum.PUBLIEE]: [StatutMissionEnum.BROUILLON],
  [StatutMissionEnum.EN_COURS]: [
    StatutMissionEnum.POURVUE,
    StatutMissionEnum.PARTIELLEMENT_POURVUE,
  ],
  [StatutMissionEnum.TERMINEE]: [StatutMissionEnum.EN_COURS],
  [StatutMissionEnum.CLOTUREE]: [
    StatutMissionEnum.PUBLIEE,
    StatutMissionEnum.PARTIELLEMENT_POURVUE,
    StatutMissionEnum.POURVUE,
    StatutMissionEnum.EN_COURS,
  ],
  [StatutMissionEnum.ANNULEE]: [
    StatutMissionEnum.BROUILLON,
    StatutMissionEnum.PUBLIEE,
    StatutMissionEnum.PARTIELLEMENT_POURVUE,
    StatutMissionEnum.POURVUE,
    StatutMissionEnum.EN_COURS,
  ],
  [StatutMissionEnum.SUSPENDUE]: [
    StatutMissionEnum.PUBLIEE,
    StatutMissionEnum.PARTIELLEMENT_POURVUE,
    StatutMissionEnum.POURVUE,
  ],
  [StatutMissionEnum.EXPIREE]: [
    StatutMissionEnum.PUBLIEE,
    StatutMissionEnum.PARTIELLEMENT_POURVUE,
    StatutMissionEnum.POURVUE,
  ],
};

const CLOSING_MISSION_STATUSES: StatutMissionEnum[] = [
  StatutMissionEnum.CLOTUREE,
  StatutMissionEnum.ANNULEE,
  StatutMissionEnum.TERMINEE,
];

interface AdminUserRow {
  id: string;
  nom: string;
  telephone: string | null;
  role: RoleEnum;
  statut: StatutCompteEnum;
  isPremium: boolean;
  createdAt: Date;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly commissions: CommissionsService,
    private readonly commissionPolicy: CommissionPolicyService,
    private readonly restrictions: WorkerRestrictionService,
    private readonly supabase: SupabaseService,
  ) {}

  async createUser(dto: CreateAdminUserDto): Promise<AdminCreatedUserDto> {
    const user = await this.supabase.createConfirmedUser(dto.email, dto.password);
    try {
      const codeParrainage = dto.role === RoleEnum.AGENT ? await this.generateAgentCode() : null;
      const profile = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.profiles.create({
          data: {
            id: user.id,
            nom: dto.nom,
            telephone: dto.telephone,
            langue: dto.langue ?? 'fr',
            role: dto.role,
            statut: StatutCompteEnum.ACTIF,
          },
          select: {
            id: true,
            nom: true,
            telephone: true,
            role: true,
            statut: true,
            isPremium: true,
            createdAt: true,
          },
        });
        if (dto.role === RoleEnum.AGENT) {
          await transaction.agents.create({
            data: {
              userId: user.id,
              perimetre: dto.perimetre ?? null,
              codeParrainage,
            },
          });
        }
        return created;
      });

      return {
        id: profile.id,
        nom: profile.nom,
        telephone: profile.telephone,
        role: profile.role,
        statut: profile.statut,
        isPremium: profile.isPremium,
        createdAt: profile.createdAt.toISOString(),
        email: user.email ?? dto.email,
        codeParrainage,
      };
    } catch (error) {
      await this.supabase.deleteUser(user.id).catch(() => undefined);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account already exists with this email or phone number');
      }
      throw error;
    }
  }

  private async generateAgentCode(): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
      const code = `AG-${suffix}`;
      const exists = await this.prisma.agents.findUnique({
        where: { codeParrainage: code },
        select: { userId: true },
      });
      if (!exists) return code;
    }
    throw new ConflictException('Unable to generate a unique referral code');
  }

  async listUsers(query: AdminUserQueryDto): Promise<AdminUserListDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const predicates: Prisma.Sql[] = [Prisma.sql`p.deleted_at IS NULL`];
    if (query.role) predicates.push(Prisma.sql`p.role::text = ${query.role}`);
    if (query.statut) predicates.push(Prisma.sql`p.statut::text = ${query.statut}`);
    if (query.premium !== undefined) {
      predicates.push(Prisma.sql`p.is_premium = ${query.premium}`);
    }
    if (query.nom) predicates.push(Prisma.sql`p.nom ILIKE ${`%${query.nom}%`}`);
    if (query.telephone) predicates.push(Prisma.sql`p.telephone ILIKE ${`%${query.telephone}%`}`);
    const where = Prisma.join(predicates, ' AND ');
    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminUserRow[]>(Prisma.sql`
        SELECT p.id, p.nom, p.telephone, p.role, p.statut,
          p.is_premium AS "isPremium",
          p.created_at AS "createdAt"
        FROM public.profiles p
        WHERE ${where}
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `),
      this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*) AS total FROM public.profiles p WHERE ${where}
      `),
    ]);
    const total = Number(countRows[0]?.total ?? 0n);
    return {
      data: rows.map((row) => this.toUserDto(row)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUser(id: string): Promise<AdminUserDto> {
    const rows = await this.prisma.$queryRaw<AdminUserRow[]>(Prisma.sql`
      SELECT p.id, p.nom, p.telephone, p.role, p.statut,
        p.is_premium AS "isPremium",
        p.created_at AS "createdAt"
      FROM public.profiles p
      WHERE p.id = ${id}::uuid AND p.deleted_at IS NULL
      LIMIT 1
    `);
    if (!rows.length) throw new NotFoundException('User not found');
    return this.toUserDto(rows[0]);
  }

  async updateUserStatus(id: string, dto: UpdateUserStatusDto): Promise<AdminUserDto> {
    await this.prisma.$transaction(async (transaction) => {
      const profile = await transaction.profiles.findUnique({ where: { id }, select: { id: true, statut: true } });
      if (!profile) throw new NotFoundException('User not found');
      await transaction.profiles.update({ where: { id }, data: { statut: dto.statut } });
      await this.createAdminNotification(transaction, id, 'ACCOUNT_STATUS_UPDATED', {
        userId: id,
        previousStatus: profile.statut,
        status: dto.statut,
      });
    });
    return this.getUser(id);
  }

  async updatePremium(id: string, dto: UpdatePremiumDto): Promise<AdminUserDto> {
    const existing = await this.prisma.profiles.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!existing || existing.deletedAt) throw new NotFoundException('User not found');
    const row = await this.prisma.profiles.update({
      where: { id },
      data: { isPremium: dto.isPremium },
      select: {
        id: true,
        nom: true,
        telephone: true,
        role: true,
        statut: true,
        isPremium: true,
        createdAt: true,
      },
    });
    return this.toUserDto(row);
  }

  async listMissions(query: AdminMissionQueryDto): Promise<AdminMissionListDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.MissionsWhereInput = {
      deletedAt: null,
      ...(query.statut ? { statut: query.statut as StatutMissionEnum } : {}),
      ...(query.date ? { dateMission: new Date(`${query.date}T00:00:00.000Z`) } : {}),
      ...(query.zoneId ? { zoneId: query.zoneId } : {}),
    };
    const [missions, total] = await this.prisma.$transaction([
      this.prisma.missions.findMany({
        where,
        select: {
          id: true,
          recruteurId: true,
          description: true,
          statut: true,
          dateMission: true,
          nombrePostes: true,
          remunerationFcfa: true,
          metier: { select: { libelle: true } },
          zone: { select: { nom: true } },
          recruteur: { select: { raisonSociale: true } },
          _count: { select: { candidatures: true } },
        },
        orderBy: [{ dateMission: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.missions.count({ where }),
    ]);
    return {
      data: missions.map((mission) => this.toMissionDto(mission)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMission(id: string): Promise<AdminMissionDto> {
    const mission = await this.prisma.missions.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        recruteurId: true,
        description: true,
        statut: true,
        dateMission: true,
        nombrePostes: true,
        remunerationFcfa: true,
        metier: { select: { libelle: true } },
        zone: { select: { nom: true } },
        recruteur: { select: { raisonSociale: true } },
        _count: { select: { candidatures: true } },
      },
    });
    if (!mission) throw new NotFoundException('Mission not found');
    return this.toMissionDto(mission);
  }

  async getMissionStats(): Promise<AdminMissionStatsDto> {
    const where = { deletedAt: null };
    const [total, published, completed, groups] = await Promise.all([
      this.prisma.missions.count({ where }),
      this.prisma.missions.count({ where: { ...where, statut: StatutMissionEnum.PUBLIEE } }),
      this.prisma.missions.count({ where: { ...where, statut: StatutMissionEnum.TERMINEE } }),
      this.prisma.missions.groupBy({ by: ['statut'], where, _count: { _all: true } }),
    ]);
    return {
      total,
      published,
      completed,
      byStatus: groups.map((group) => ({ statut: group.statut, count: group._count._all })),
    };
  }

  async listCommissions(query: AdminCommissionQueryDto): Promise<AdminCommissionListDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CommissionsWhereInput = {
      mission: { is: { statut: StatutMissionEnum.TERMINEE } },
      ...(query.workerId ? { travailleurId: query.workerId } : {}),
      ...(query.missionId ? { missionId: query.missionId } : {}),
    };
    const [commissions, total] = await this.prisma.$transaction([
      this.prisma.commissions.findMany({
        where,
        select: {
          id: true,
          travailleurId: true,
          missionId: true,
          montantBrut: true,
          montantCommission: true,
          montantNet: true,
          createdAt: true,
          travailleur: { select: { user: { select: { nom: true } } } },
          payments: { select: { montant: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.commissions.count({ where }),
    ]);
    return {
      data: commissions.map((commission) => {
        const paidAmount = commission.payments.reduce((sum, payment) => sum + payment.montant, 0n);
        return {
          id: commission.id,
          workerId: commission.travailleurId,
          workerName: commission.travailleur.user.nom,
          missionId: commission.missionId,
          grossAmount: Number(commission.montantBrut),
          commissionAmount: Number(commission.montantCommission),
          netAmount: Number(commission.montantNet),
          paidAmount: Number(paidAmount),
          remainingCommission: Number(commission.montantCommission > paidAmount ? commission.montantCommission - paidAmount : 0n),
          status: this.commissionPolicy.getStatus(commission.montantCommission, paidAmount),
          createdAt: commission.createdAt.toISOString(),
        };
      }),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCommissionStats(): Promise<AdminCommissionStatsDto> {
    const [summary, entries] = await Promise.all([
      this.commissions.getPlatformSummary(),
      this.prisma.commissions.count({ where: { mission: { is: { statut: StatutMissionEnum.TERMINEE } } } }),
    ]);
    return {
      generated: Number(summary.totalCommissionsGenerated),
      paid: Number(summary.totalCommissionsPaid),
      outstanding: Number(summary.totalCommissionsOutstanding),
      entries,
    };
  }

  recordCommissionPayment(commissionId: string, dto: RecordCommissionPaymentDto, adminId: string): Promise<CommissionPaymentResultDto> {
    return this.commissions.recordPayment(commissionId, dto, adminId);
  }

  listCommissionPayments(commissionId: string): Promise<CommissionPaymentListDto> {
    return this.commissions.listPayments(commissionId);
  }

  async sendCommissionReminder(commissionId: string): Promise<{ commissionId: string; sent: boolean }> {
    const commission = await this.prisma.commissions.findUnique({
      where: { id: commissionId },
      select: { id: true, travailleurId: true, missionId: true },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    await this.commissions.sendCommissionReminder(commission.travailleurId, commission.id, commission.missionId);
    return { commissionId: commission.id, sent: true };
  }

  async getRestrictedWorkers(page = 1, limit = 20) {
    const [balances, threshold] = await Promise.all([
      this.restrictions.getOutstandingBalances(),
      this.commissionPolicy.getMaxCommissionDebt(),
    ]);
    const restricted = [...balances.entries()]
      .filter(([, outstanding]) => outstanding > threshold)
      .sort((left, right) => (right[1] > left[1] ? 1 : right[1] < left[1] ? -1 : 0));
    const total = restricted.length;
    const slice = restricted.slice((page - 1) * limit, page * limit);
    const workerIds = slice.map(([workerId]) => workerId);
    const workers = workerIds.length ? await this.prisma.travailleurs.findMany({
      where: { userId: { in: workerIds }, deletedAt: null },
      select: { userId: true, user: { select: { nom: true, telephone: true } } },
    }) : [];
    const workerMap = new Map(workers.map((worker) => [worker.userId, worker]));
    return {
      data: slice.map(([workerId, outstanding]) => {
        const worker = workerMap.get(workerId);
        return {
          workerId,
          nom: worker?.user.nom ?? 'Utilisateur supprimé',
          telephone: worker?.user.telephone ?? null,
          remainingCommission: Number(outstanding),
          threshold: Number(threshold),
          accountRestricted: true,
        };
      }),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listJobs() {
    return this.prisma.metiers.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, libelle: true, categorie: true, actif: true, createdAt: true, updatedAt: true },
      orderBy: { libelle: 'asc' },
    });
  }

  async createJob(dto: CreateMetierDto) {
    return this.prisma.metiers.create({ data: { id: randomUUID(), ...dto } });
  }

  async updateJob(id: string, dto: UpdateMetierDto) {
    const exists = await this.prisma.metiers.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!exists) throw new NotFoundException('Job not found');
    return this.prisma.metiers.update({ where: { id }, data: dto });
  }

  async deleteJob(id: string): Promise<void> {
    const exists = await this.prisma.metiers.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!exists) throw new NotFoundException('Job not found');
    await this.prisma.metiers.update({ where: { id }, data: { deletedAt: new Date(), actif: false } });
  }

  async listZones() {
    return this.prisma.zones.findMany({
      where: { deletedAt: null },
      select: { id: true, nom: true, niveau: true, parentId: true, createdAt: true, updatedAt: true },
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
    });
  }

  async createZone(dto: CreateZoneDto) {
    if (dto.parentId) {
      const parent = await this.prisma.zones.findFirst({ where: { id: dto.parentId, deletedAt: null }, select: { id: true } });
      if (!parent) throw new NotFoundException('Parent zone not found');
    }
    return this.prisma.zones.create({ data: { id: randomUUID(), ...dto } });
  }

  async updateZone(id: string, dto: UpdateZoneDto) {
    const exists = await this.prisma.zones.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!exists) throw new NotFoundException('Zone not found');
    if (dto.parentId) {
      const parent = await this.prisma.zones.findFirst({ where: { id: dto.parentId, deletedAt: null }, select: { id: true } });
      if (!parent) throw new NotFoundException('Parent zone not found');
    }
    return this.prisma.zones.update({ where: { id }, data: dto });
  }

  async deleteZone(id: string): Promise<void> {
    const exists = await this.prisma.zones.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!exists) throw new NotFoundException('Zone not found');
    await this.prisma.zones.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async getSettings() {
    const entries = await this.prisma.platformSettings.findMany({ orderBy: { settingKey: 'asc' } });
    const stored = new Map(entries.map(({ settingKey, settingValue }) => [settingKey, settingValue]));
    return {
      commissionPercent: Number(stored.get('COMMISSION_PERCENT') ?? this.configService.get<number>('commission.percent', 0) ?? 0),
      maxCommissionDebt: Number(stored.get('MAX_COMMISSION_DEBT') ?? this.configService.get<number>('commission.maxDebt', 5000) ?? 5000),
      settings: entries,
    };
  }

  async patchSettings(dto: PatchSettingsDto) {
    const changes: Array<[string, string, string]> = [];
    if (dto.commissionPercent !== undefined) changes.push(['COMMISSION_PERCENT', String(dto.commissionPercent), 'Platform commission percentage']);
    if (dto.maxCommissionDebt !== undefined) changes.push(['MAX_COMMISSION_DEBT', String(dto.maxCommissionDebt), 'Maximum commission debt before restriction']);
    if (!changes.length) throw new BadRequestException('At least one platform setting is required');
    await this.prisma.$transaction(changes.map(([settingKey, settingValue, description]) => {
      return this.prisma.platformSettings.upsert({
        where: { settingKey },
        create: { id: randomUUID(), settingKey, settingValue, description },
        update: { settingValue, description },
      });
    }));
    return this.getSettings();
  }

  async getPlatformStats() {
    const [usersTotal, workersTotal, recruitersTotal, agentsTotal, premiumRows, missionsPublished, missionsCompleted,
      applicationsTotal, commissionSummary, notificationsSent, whatsappMessagesSent] = await Promise.all([
      this.prisma.profiles.count({ where: { deletedAt: null } }),
      this.prisma.travailleurs.count({ where: { deletedAt: null } }),
      this.prisma.recruteurs.count({ where: { deletedAt: null } }),
      this.prisma.agents.count({ where: { deletedAt: null } }),
      this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*) AS total FROM public.profiles p
        WHERE p.deleted_at IS NULL
          AND p.is_premium = true
      `),
      this.prisma.missions.count({ where: { deletedAt: null, statut: StatutMissionEnum.PUBLIEE } }),
      this.prisma.missions.count({ where: { deletedAt: null, statut: StatutMissionEnum.TERMINEE } }),
      this.prisma.candidatures.count(),
      this.commissions.getPlatformSummary(),
      this.prisma.notifications.count(),
      this.prisma.notifications.count({
        where: {
          canal: CanalEnum.WHATSAPP,
          statut: { in: [StatutMessageEnum.ENVOYE, StatutMessageEnum.LIVRE, StatutMessageEnum.LU] },
        },
      }),
    ]);
    return {
      usersTotal,
      workersTotal,
      recruitersTotal,
      agentsTotal,
      premiumUsers: Number(premiumRows[0]?.total ?? 0n),
      missionsPublished,
      missionsCompleted,
      applicationsTotal,
      commissionsGenerated: Number(commissionSummary.totalCommissionsGenerated),
      commissionsOutstanding: Number(commissionSummary.totalCommissionsOutstanding),
      notificationsSent,
      whatsappMessagesSent,
    };
  }

  async updateMissionStatus(id: string, dto: UpdateMissionStatusDto, changedBy?: string) {
    const mission = await this.prisma.missions.findFirst({
      where: { id, deletedAt: null },
      select: { statut: true },
    });
    if (!mission) throw new NotFoundException('Mission not found');

    const allowedFrom = ADMIN_MISSION_TRANSITIONS[dto.statut];
    if (!allowedFrom) {
      throw new BadRequestException(`Unsupported mission status: ${dto.statut}`);
    }
    if (!allowedFrom.includes(mission.statut)) {
      throw new BadRequestException(`Invalid mission status transition: ${mission.statut} to ${dto.statut}`);
    }

    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.missions.update({
        where: { id },
        data: {
          statut: dto.statut,
          ...(dto.statut === StatutMissionEnum.PUBLIEE ? { datePublication: new Date() } : {}),
          ...(CLOSING_MISSION_STATUSES.includes(dto.statut) ? { dateCloture: new Date() } : {}),
        },
      });
      await transaction.missionStatusHistory.create({
        data: {
          missionId: id,
          ancienStatut: mission.statut,
          nouveauStatut: dto.statut,
          changedBy: changedBy ?? null,
        },
      });
      if (dto.statut === StatutMissionEnum.TERMINEE) {
        await this.commissions.generateMissionCommissions(id, transaction);
      }
      return result;
    });
  }

  private async createAdminNotification(
    transaction: Prisma.TransactionClient,
    recipientId: string,
    type: string,
    payload: Prisma.InputJsonObject,
  ): Promise<void> {
    const notificationId = randomUUID();
    await transaction.notifications.create({
      data: {
        id: notificationId,
        utilisateurId: recipientId,
        type,
        canal: CanalEnum.APPLICATION,
        statut: StatutMessageEnum.ENVOYE,
        dateEnvoi: new Date(),
      },
    });
    await transaction.notificationEvents.create({
      data: { id: randomUUID(), notificationId, status: StatutMessageEnum.ENVOYE, payload },
    });
  }

  private toUserDto(row: AdminUserRow): AdminUserDto {
    return { ...row, createdAt: row.createdAt.toISOString() };
  }

  private toMissionDto(mission: {
    id: string;
    recruteurId: string;
    description: string | null;
    statut: StatutMissionEnum;
    dateMission: Date;
    nombrePostes: number;
    remunerationFcfa: bigint;
    metier: { libelle: string };
    zone: { nom: string };
    recruteur: { raisonSociale: string };
    _count: { candidatures: number };
  }): AdminMissionDto {
    return {
      id: mission.id,
      recruteurId: mission.recruteurId,
      description: mission.description,
      statut: mission.statut,
      dateMission: mission.dateMission.toISOString().slice(0, 10),
      metier: mission.metier.libelle,
      zone: mission.zone.nom,
      recruteur: mission.recruteur.raisonSociale,
      nombrePostes: mission.nombrePostes,
      remunerationFcfa: Number(mission.remunerationFcfa),
      candidaturesCount: mission._count.candidatures,
    };
  }
}
