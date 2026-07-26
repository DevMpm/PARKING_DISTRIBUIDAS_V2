import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventoAuditoria } from './entities/evento-auditoria.entity';
import { AuditConsumer } from './audit.consumer';
import { AuthModule } from 'src/auth/auth.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditConsumer],
  imports: [TypeOrmModule.forFeature([EventoAuditoria]), AuthModule, HttpModule],
})
export class AuditModule {}
