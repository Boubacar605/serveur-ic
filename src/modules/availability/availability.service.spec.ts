import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PeriodeDispoEnum, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { AvailabilityService } from './availability.service';

describe('AvailabilityService', () => {
  const transaction = {
    disponibilites: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    travailleurs: { findFirst: jest.fn() },
    disponibilites: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  };
  let service: AvailabilityService;

  const futureDate = () => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 2);
    return date.toISOString().slice(0, 10);
  };

  const recordFor = (date: string, period = PeriodeDispoEnum.MATIN) => ({
    id: 'availability-id',
    dateDisponibilite: new Date(`${date}T00:00:00.000Z`),
    periode: period,
    heureDebut: null,
    heureFin: null,
    createdAt: new Date('2026-11-11T09:00:00.000Z'),
    updatedAt: new Date('2026-11-11T09:00:00.000Z'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AvailabilityService(prisma as unknown as PrismaService);
    prisma.travailleurs.findFirst.mockResolvedValue({ userId: 'worker-id' });
    transaction.disponibilites.findFirst.mockResolvedValue(null);
    transaction.disponibilites.create.mockImplementation(({ data }) => Promise.resolve({
      ...recordFor(data.dateDisponibilite.toISOString().slice(0, 10), data.periode),
      ...data,
      createdAt: new Date('2026-11-11T09:00:00.000Z'),
      updatedAt: new Date('2026-11-11T09:00:00.000Z'),
    }));
    transaction.disponibilites.update.mockImplementation(({ data }) => Promise.resolve({
      ...recordFor(futureDate()),
      ...data,
      id: 'availability-id',
      createdAt: new Date('2026-11-11T09:00:00.000Z'),
      updatedAt: new Date('2026-11-11T09:00:00.000Z'),
    }));
    prisma.disponibilites.findFirst.mockResolvedValue(recordFor(futureDate()));
    prisma.disponibilites.findMany.mockResolvedValue([]);
    prisma.disponibilites.update.mockResolvedValue({});
  });

  it('creates a future availability for the authenticated worker', async () => {
    const dto: CreateAvailabilityDto = {
      dateDisponibilite: futureDate(),
      periode: PeriodeDispoEnum.MATIN,
      heureDebut: null,
      heureFin: null,
    };

    const result = await service.create('worker-id', dto);
    expect(result).toMatchObject({
      dateDisponibilite: dto.dateDisponibilite,
      periode: PeriodeDispoEnum.MATIN,
      heureDebut: null,
      heureFin: null,
    });
    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(transaction.disponibilites.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ travailleurId: 'worker-id', periode: PeriodeDispoEnum.MATIN }),
    }));
  });

  it('rejects a past date', async () => {
    await expect(service.create('worker-id', {
      dateDisponibilite: '2000-01-01',
      periode: PeriodeDispoEnum.MATIN,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a duplicate date, period, and worker combination', async () => {
    transaction.disponibilites.findFirst.mockResolvedValue({ id: 'existing-id' });

    await expect(service.create('worker-id', {
      dateDisponibilite: futureDate(),
      periode: PeriodeDispoEnum.MATIN,
    })).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.disponibilites.create).not.toHaveBeenCalled();
  });

  it('requires an increasing time range for CRENEAU', async () => {
    await expect(service.create('worker-id', {
      dateDisponibilite: futureDate(),
      periode: PeriodeDispoEnum.CRENEAU,
      heureDebut: '14:00',
      heureFin: '13:00',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates an owned availability and rechecks duplicates', async () => {
    const dto: UpdateAvailabilityDto = { periode: PeriodeDispoEnum.APRES_MIDI };

    const result = await service.update('worker-id', 'availability-id', dto);
    expect(result.periode).toBe(PeriodeDispoEnum.APRES_MIDI);
    expect(prisma.disponibilites.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'availability-id', travailleurId: 'worker-id', deletedAt: null },
    }));
    expect(transaction.disponibilites.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'availability-id' },
      data: expect.objectContaining({ periode: PeriodeDispoEnum.APRES_MIDI, heureDebut: null, heureFin: null }),
    }));
  });

  it('hides another worker availability as not found', async () => {
    prisma.disponibilites.findFirst.mockResolvedValue(null);
    await expect(service.getById('another-worker', 'availability-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.disponibilites.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'availability-id', travailleurId: 'another-worker', deletedAt: null },
    }));
  });

  it('soft-deletes the owned availability', async () => {
    await expect(service.remove('worker-id', 'availability-id')).resolves.toBeUndefined();
    expect(prisma.disponibilites.update).toHaveBeenCalledWith({
      where: { id: 'availability-id' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
