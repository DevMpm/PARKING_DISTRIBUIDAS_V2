import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { RolePermissionsService } from './role-permissions.service';
import { ResolvePermissionsDto } from './dto/resolve-permissions.dto';
import { InternalKeyGuard } from 'src/auth/guards/internal-key.guard';

/**
 * Endpoint INTERNO (red docker/k8s) para la autorización pull.
 * Los microservicios consumidores piden los permisos de un rol para su servicio.
 * Protegido por InternalKeyGuard (header x-internal-key) y NO expuesto por Kong.
 */
@ApiExcludeController()
@UseGuards(InternalKeyGuard)
@Controller('internal/role-permissions')
export class InternalRolePermissionsController {
  constructor(private readonly rolePermissionsService: RolePermissionsService) {}

  @Post('resolve')
  @HttpCode(200)
  async resolve(@Body() dto: ResolvePermissionsDto): Promise<{ permissions: string[] }> {
    const permissions =
      await this.rolePermissionsService.getPermissionsByRoleAndService(
        dto.role,
        dto.serviceId,
      );
    return { permissions };
  }
}
