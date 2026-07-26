import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { Repository } from 'typeorm';
import { EventoAuditoria } from './entities/evento-auditoria.entity';
import { ApiExtraModels } from '@nestjs/swagger';

@ApiExtraModels(EventoAuditoria)
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(EventoAuditoria)
    private auditRepo: Repository<EventoAuditoria>,
  ) {}

  async create(dto: CreateAuditEventDto): Promise<EventoAuditoria> {
    const newEvent = this.auditRepo.create({
      ...dto,
      mac: dto.mac || '00:00:00:00:00:00',
      timestamp: new Date(),
    });

    return this.auditRepo.save(newEvent);
  }

  async findAll(): Promise<EventoAuditoria[]> {
    return this.auditRepo.find({ order: { timestamp: 'DESC' } });
  }

  async findOne(id: string): Promise<EventoAuditoria | null> {
    return this.auditRepo.findOne({ where: { id } });
  }
}