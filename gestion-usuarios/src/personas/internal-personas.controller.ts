import { Controller, Get, HttpCode, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PersonasService } from './personas.service';
import { InternalKeyGuard } from 'src/auth/guards/internal-key.guard';

/**
 * Endpoint INTERNO (red docker) para resolver una cédula (DNI) a su personId.
 * Lo usan otros microservicios (p.ej. ticket-service para buscar tickets por cédula)
 * SIN requerir que el usuario final tenga USUARIOS_READ. Protegido por x-internal-key.
 */
@ApiExcludeController()
@UseGuards(InternalKeyGuard)
@Controller('internal/personas')
export class InternalPersonasController {
  constructor(private readonly personasService: PersonasService) {}

  @Get('resolve')
  @HttpCode(200)
  async resolve(@Query('dni') dni: string): Promise<{ personId: string | null }> {
    if (!dni) return { personId: null };
    try {
      const persona = await this.personasService.findByDni(dni);
      return { personId: persona.id };
    } catch {
      return { personId: null };
    }
  }
}
