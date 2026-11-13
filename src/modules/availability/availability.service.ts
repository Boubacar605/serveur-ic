import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PeriodeDispoEnum, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityResponseDto } from './dto/availability-response.dto';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

const availabilitySelect = {
  id: true,
  dateDisponibilite: true,
  periode: true,
  heureDebut: true,
  heureFin: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DisponibilitesSelect;

type AvailabilityRecord = Prisma.DisponibilitesGetPayload<{ select: typeof availabilitySelect }>;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workerId: string): Promise<AvailabilityResponseDto[]> {
    await this.ensureWorker(workerId);
    const records = await this.prisma.disponibilites.findMany({
      where: { travailleurId: workerId, deletedAt: null },
      orderBy: [{ dateDisponibilite: 'asc' }, { periode: 'asc' }],
      select: availabilitySelect,
    });
    return records.map((record) => this.toResponse(record));
  }

  async getById(workerId: string, id: string): Promise<AvailabilityResponseDto> {
    const record = await this.findOwnedAvailability(workerId, id);
    return this.toResponse(record);
  }

  async create(workerId: string, dto: CreateAvailabilityDto): Promise<AvailabilityResponseDto> {
    const values = this.normalizeCreate(dto);
    await this.ensureWorker(workerId);

    try {
      const record = await this.prisma.$transaction(async (transaction) => {
        await this.assertNoDuplicate(transaction, workerId, values.dateDisponibilite, values.periode);
        return transaction.disponibilites.create({
          data: {
            id: randomUUID(),
            travailleurId: workerId,
            ...values,
          },
          select: availabilitySelect,
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return this.toResponse(record);
    } catch (error) {
      this.throwIfSerializationConflict(error);
      throw error;
    }
  }

  async update(workerId: string, id: string, dto: UpdateAvailabilityDto): Promise<AvailabilityResponseDto> {
    const current = await this.findOwnedAvailability(workerId, id);
    const values = this.normalizeUpdate(current, dto);

    try {
      const record = await this.prisma.$transaction(async (transaction) => {
        await this.assertNoDuplicate(transaction, workerId, values.dateDisponibilite, values.periode, id);
        return transaction.disponibilites.update({
          where: { id },
          data: values,
          select: availabilitySelect,
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return this.toResponse(record);
    } catch (error) {
      this.throwIfSerializationConflict(error);
      throw error;
    }
  }

  async remove(workerId: string, id: string): Promise<void> {
    await this.findOwnedAvailability(workerId, id);
    await this.prisma.disponibilites.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async ensureWorker(workerId: string): Promise<void> {
    const worker = await this.prisma.travailleurs.findFirst({
      where: { userId: workerId, deletedAt: null },
      select: { userId: true },
    });
    if (!worker) throw new NotFoundException('Worker profile not found');
  }

  private async findOwnedAvailability(
    workerId: string,
    id: string,
  ): Promise<AvailabilityRecord> {
    const record = await this.prisma.disponibilites.findFirst({
      where: {
        id,
        travailleurId: workerId,
        deletedAt: null,
      },
      select: availabilitySelect,
    });
    if (!record) throw new NotFoundException('Availability not found');
    return record;
  }

  private async assertNoDuplicate(
    transaction: Prisma.TransactionClient,
    workerId: string,
    dateDisponibilite: Date,
    periode: PeriodeDispoEnum,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await transaction.disponibilites.findFirst({
      where: {
        travailleurId: workerId,
        dateDisponibilite,
        periode,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined,
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Availability already exists for this date and period');
  }

  private normalizeCreate(dto: CreateAvailabilityDto) {
    const dateDisponibilite = this.parseDate(dto.dateDisponibilite);
    this.assertNotPast(dateDisponibilite);
    const heureDebut = dto.heureDebut ?? null;
    const heureFin = dto.heureFin ?? null;
    this.validateTimeSlot(dto.periode, heureDebut, heureFin);

    return {
      dateDisponibilite,
      periode: dto.periode,
      heureDebut: heureDebut === null ? null : this.toTimeDate(heureDebut),
      heureFin: heureFin === null ? null : this.toTimeDate(heureFin),
    };
  }

  private normalizeUpdate(current: AvailabilityRecord, dto: UpdateAvailabilityDto) {
    const dateDisponibilite = dto.dateDisponibilite === undefined
      ? current.dateDisponibilite
      : this.parseDate(dto.dateDisponibilite);
    const periode = dto.periode ?? current.periode;
    this.assertNotPast(dateDisponibilite);

    let heureDebut = dto.heureDebut === undefined ? this.timeToString(current.heureDebut) : dto.heureDebut;
    let heureFin = dto.heureFin === undefined ? this.timeToString(current.heureFin) : dto.heureFin;
    if (periode !== PeriodeDispoEnum.CRENEAU) {
      if (dto.heureDebut != null || dto.heureFin != null) {
        throw new BadRequestException('heureDebut and heureFin must be null unless periode is CRENEAU');
      }
      heureDebut = null;
      heureFin = null;
    }
    this.validateTimeSlot(periode, heureDebut, heureFin);

    return {
      dateDisponibilite,
      periode,
      heureDebut: heureDebut == null ? null : this.toTimeDate(heureDebut),
      heureFin: heureFin == null ? null : this.toTimeDate(heureFin),
    };
  }

  private validateTimeSlot(
    periode: PeriodeDispoEnum,
    heureDebut: string | null,
    heureFin: string | null,
  ): void {
    if (periode !== PeriodeDispoEnum.CRENEAU) {
      if (heureDebut !== null || heureFin !== null) {
        throw new BadRequestException('heureDebut and heureFin must be null unless periode is CRENEAU');
      }
      return;
    }
    if (!heureDebut || !heureFin) {
      throw new BadRequestException('heureDebut and heureFin are required for CRENEAU');
    }
    if (this.timeValue(heureFin) <= this.timeValue(heureDebut)) {
      throw new BadRequestException('heureFin must be later than heureDebut');
    }
  }

  private parseDate(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('dateDisponibilite must be a valid ISO date');
    }
    return date;
  }

  private assertNotPast(date: Date): void {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (date < today) throw new BadRequestException('dateDisponibilite cannot be in the past');
  }

  private timeValue(value: string): number {
    const milliseconds = Date.parse(`1970-01-01T${value.length === 5 ? `${value}:00` : value}Z`);
    if (Number.isNaN(milliseconds)) throw new BadRequestException('Invalid time value');
    return milliseconds;
  }

  private toTimeDate(value: string): Date {
    const normalized = value.length === 5 ? `${value}:00` : value;
    const time = new Date(`1970-01-01T${normalized}Z`);
    if (Number.isNaN(time.getTime())) throw new BadRequestException('Invalid time value');
    return time;
  }

  private timeToString(value: Date | null): string | null {
    return value ? value.toISOString().slice(11, 19) : null;
  }

  private toResponse(record: AvailabilityRecord): AvailabilityResponseDto {
    return {
      id: record.id,
      dateDisponibilite: record.dateDisponibilite.toISOString().slice(0, 10),
      periode: record.periode,
      heureDebut: this.timeToString(record.heureDebut),
      heureFin: this.timeToString(record.heureFin),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private throwIfSerializationConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new ConflictException('Availability already exists for this date and period');
    }
  }
}
