import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EventoAuditoria } from './entities/evento-auditoria.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';

@ApiTags('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a new audit event' })
  @ApiResponse({ status: 201, description: 'Audit event created successfully', type: EventoAuditoria   })
  @RequirePermissions('AUDITORIA_CREATE')
  create(@Body() createAuditEventDto: CreateAuditEventDto) {
    return this.auditService.create(createAuditEventDto);
  }

  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Retrieve all audit events' })
  @ApiResponse({ status: 200, description: 'Audit events retrieved successfully', type: [EventoAuditoria] })
  @RequirePermissions('AUDITORIA_READ')
  findAll() {
    return this.auditService.findAll();
  }

  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a specific audit event' })
  @ApiResponse({ status: 200, description: 'Audit event retrieved successfully', type: EventoAuditoria })
  @RequirePermissions('AUDITORIA_READ')
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateAuditDto: UpdateAuditDto) {
  //   return this.auditService.update(+id, updateAuditDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.auditService.remove(+id);
  // }
}
