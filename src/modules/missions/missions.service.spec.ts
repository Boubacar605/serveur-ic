import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ModeAttributionEnum,
  NiveauZoneEnum,
  PeriodeDispoEnum,
  Prisma,
  RoleEnum,
  StatutMissionEnum,
  TypeHoraireEnum,
  TypeRecruteurEnum,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CreateMissionDto } from './dto/create-mission.dto';
import { MissionRecommendationScorer } from './mission-recommendation-scorer.service';
import { MissionsService } from './missions.service';
import { CommissionsService } from '../commissions/commissions.service';

describe('MissionsService', () => {
  const transaction = {
    missions: { findFirst: jest.fn(), update: jest.fn() },
    missionStatusHistory: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((input: unknown) => Array.isArray(input)
      ? Promise.all(input as Promise<unknown>[])
      : (input as (tx: typeof transaction) => Promise<unknown>)(transaction)),
    missions: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    confirmations: { count: jest.fn() },
    recruteurs: { findFirst: jest.fn() },
    metiers: { findFirst: jest.fn() },
    zones: { findFirst: jest.fn() },
    travailleurs: { findFirst: jest.fn() },
  };
  const commissions = { completeMission: jest.fn() };
  const recruiter: CurrentUserPayload = {
    id: 'recruiter-id',
    email: 'recruiter@example.com',
    role: RoleEnum.RECRUTEUR,
  };
  const worker: CurrentUserPayload = {
    id: 'worker-id',
    email: 'worker@example.com',
    role: RoleEnum.TRAVAILLEUR,
  };
  let service: MissionsService;

  const futureDate = () => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 3);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  };

  const missionRecord = (statut = StatutMissionEnum.PUBLIEE) => ({
    id: 'mission-id',
    recruteurId: 'recruiter-id',
    metierId: 'job-id',
    zoneId: 'zone-id',
    description: 'Chantier de construction',
    nombrePostes: 3,
    remunerationFcfa: 15000n,
    dateMission: futureDate(),
    datePublication: null,
    dateCloture: null,
    typeHoraire: TypeHoraireEnum.TRAVAIL_JOURNALIER,
    heureDebut: null,
    heureFin: null,
    urgente: false,
    modeAttribution: ModeAttributionEnum.PREMIER_ARRIVE,
    statut,
    createdAt: new Date('2026-11-11T09:00:00.000Z'),
    updatedAt: new Date('2026-11-11T09:00:00.000Z'),
    deletedAt: null,
    metier: { id: 'job-id', code: 'MACON', libelle: 'Maçon', categorie: 'BTP' },
    zone: { id: 'zone-id', nom: 'Médina', niveau: NiveauZoneEnum.COMMUNE },
    recruteur: {
      typeRecruteur: TypeRecruteurEnum.ENTREPRISE,
      raisonSociale: 'XeuySil Services',
      user: { id: 'recruiter-id', nom: 'Aïssatou Ndiaye' },
    },
    _count: { candidatures: 2 },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MissionsService(
      prisma as unknown as PrismaService,
      new MissionRecommendationScorer(),
      commissions as unknown as CommissionsService,
    );
    prisma.missions.findMany.mockResolvedValue([missionRecord()]);
    prisma.missions.count.mockResolvedValue(1);
    prisma.missions.findFirst.mockResolvedValue(missionRecord(StatutMissionEnum.BROUILLON));
    prisma.missions.create.mockResolvedValue(missionRecord(StatutMissionEnum.BROUILLON));
    prisma.missions.update.mockResolvedValue(missionRecord(StatutMissionEnum.BROUILLON));
    prisma.confirmations.count.mockResolvedValue(2);
    prisma.recruteurs.findFirst.mockResolvedValue({ userId: recruiter.id });
    prisma.metiers.findFirst.mockResolvedValue({ id: 'job-id' });
    prisma.zones.findFirst.mockResolvedValue({ id: 'zone-id' });
    prisma.travailleurs.findFirst.mockResolvedValue({
      profilMetiers: [{ metierId: 'job-id' }],
      travailleurZones: [{ zoneId: 'zone-id' }],
      disponibilites: [{
        dateDisponibilite: futureDate(),
        periode: PeriodeDispoEnum.JOURNEE,
        heureDebut: null,
        heureFin: null,
      }],
    });
    commissions.completeMission.mockResolvedValue({ created: 3, missionId: 'mission-id' });
    transaction.missions.findFirst.mockResolvedValue({
      id: 'mission-id',
      recruteurId: recruiter.id,
      statut: StatutMissionEnum.BROUILLON,
      dateMission: futureDate(),
    });
    transaction.missions.update.mockImplementation(({ data }) => Promise.resolve({
      ...missionRecord(data.statut),
      ...data,
      dateMission: futureDate(),
      datePublication: data.datePublication ?? null,
      dateCloture: data.dateCloture ?? null,
    }));
    transaction.missionStatusHistory.create.mockResolvedValue({});
  });

  it('filters public missions and returns paginated results', async () => {
    const result = await service.listPublic({ page: 2, limit: 5, metierId: 'job-id', urgente: false });

    expect(result).toMatchObject({ page: 2, limit: 5, total: 1, totalPages: 1 });
    expect(result.data[0].remunerationFcfa).toBe(15000);
    expect(prisma.missions.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        statut: { in: [StatutMissionEnum.PUBLIEE, StatutMissionEnum.PARTIELLEMENT_POURVUE] },
        deletedAt: null,
        metierId: 'job-id',
        urgente: false,
      }),
      orderBy: { dateMission: 'asc' },
      skip: 5,
      take: 5,
    }));
  });

  it('hydrates published mission detail and calculates remaining seats', async () => {
    const result = await service.getById('mission-id');

    expect(result).toMatchObject({
      id: 'mission-id',
      nombreCandidatures: 2,
      nombreConfirmations: 2,
      placesRestantes: 1,
      metier: { code: 'MACON' },
      zone: { nom: 'Médina' },
      recruteur: { nom: 'Aïssatou Ndiaye' },
    });
    expect(prisma.confirmations.count).toHaveBeenCalledWith({
      where: { candidature: { is: { missionId: 'mission-id' } } },
    });
  });

  it('creates a draft mission owned by the authenticated recruiter', async () => {
    const dto: CreateMissionDto = {
      metierId: 'job-id',
      zoneId: 'zone-id',
      description: 'Chantier de construction',
      nombrePostes: 3,
      remunerationFcfa: 15000,
      dateMission: futureDate().toISOString().slice(0, 10),
      typeHoraire: TypeHoraireEnum.TRAVAIL_JOURNALIER,
      heureDebut: null,
      heureFin: null,
      urgente: false,
      modeAttribution: ModeAttributionEnum.PREMIER_ARRIVE,
    };

    await service.create(recruiter.id, dto);
    expect(prisma.missions.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        recruteurId: recruiter.id,
        metierId: dto.metierId,
        zoneId: dto.zoneId,
        remunerationFcfa: 15000n,
        statut: StatutMissionEnum.BROUILLON,
      }),
    }));
  });

  it('rejects updates to terminal missions and rejects non-owners', async () => {
    prisma.missions.findFirst.mockResolvedValueOnce({
      id: 'mission-id', recruteurId: recruiter.id, statut: StatutMissionEnum.TERMINEE,
      dateMission: futureDate(), heureDebut: null, heureFin: null, typeHoraire: TypeHoraireEnum.TRAVAIL_JOURNALIER,
    });
    await expect(service.update(recruiter.id, 'mission-id', { description: 'Updated' }))
      .rejects.toBeInstanceOf(BadRequestException);

    prisma.missions.findFirst.mockResolvedValueOnce({
      id: 'mission-id', recruteurId: 'another-recruiter', statut: StatutMissionEnum.BROUILLON,
      dateMission: futureDate(), heureDebut: null, heureFin: null, typeHoraire: TypeHoraireEnum.TRAVAIL_JOURNALIER,
    });
    await expect(service.update(recruiter.id, 'mission-id', { description: 'Updated' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft-deletes a recruiter-owned mission', async () => {
    prisma.confirmations.count.mockResolvedValueOnce(0);
    await service.remove(recruiter.id, 'mission-id');
    expect(prisma.missions.update).toHaveBeenCalledWith({
      where: { id: 'mission-id' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('changes status and records history in the same transaction', async () => {
    const result = await service.publish(recruiter.id, 'mission-id', recruiter);

    expect(result.statut).toBe(StatutMissionEnum.PUBLIEE);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(transaction.missionStatusHistory.create).toHaveBeenCalledWith({
      data: {
        missionId: 'mission-id',
        ancienStatut: StatutMissionEnum.BROUILLON,
        nouveauStatut: StatutMissionEnum.PUBLIEE,
        changedBy: recruiter.id,
      },
    });
  });

  it('starts only a POURVUE mission and records the EN_COURS transition', async () => {
    transaction.missions.findFirst.mockResolvedValueOnce({
      id: 'mission-id',
      recruteurId: recruiter.id,
      statut: StatutMissionEnum.POURVUE,
      dateMission: futureDate(),
    });

    const result = await service.start(recruiter.id, 'mission-id', recruiter);
    expect(result.statut).toBe(StatutMissionEnum.EN_COURS);
    expect(transaction.missionStatusHistory.create).toHaveBeenCalledWith({
      data: {
        missionId: 'mission-id',
        ancienStatut: StatutMissionEnum.POURVUE,
        nouveauStatut: StatutMissionEnum.EN_COURS,
        changedBy: recruiter.id,
      },
    });
  });

  it('delegates mission completion to CommissionsService', async () => {
    prisma.missions.findFirst.mockResolvedValueOnce(missionRecord(StatutMissionEnum.TERMINEE));

    const result = await service.complete(recruiter.id, 'mission-id');

    expect(result.statut).toBe(StatutMissionEnum.TERMINEE);
    expect(commissions.completeMission).toHaveBeenCalledWith(recruiter.id, 'mission-id');
  });

  it('ranks recommendations using the V1 job, zone, and availability weights', async () => {
    const [result] = await service.listRecommended(worker);
    expect(result.matchingScore).toBe(175);
    expect(prisma.travailleurs.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: worker.id, deletedAt: null },
    }));
  });
});
