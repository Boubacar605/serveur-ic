import { PartialType } from '@nestjs/swagger';
import { CreateMetierDto } from './create-metier.dto';

export class UpdateMetierDto extends PartialType(CreateMetierDto) {}
