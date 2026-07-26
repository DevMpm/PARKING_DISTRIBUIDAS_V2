import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionsCacheService } from '../permissions-cache.service';

/**
 * Autorización PULL: obtiene el rol único del JWT y resuelve sus permisos para
 * este servicio vía PermissionsCacheService (caché + gestion-usuarios).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsCache: PermissionsCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const role: string | undefined =
      request.user?.role ?? request.user?.roles?.[0];
    if (!role) {
      throw new ForbiddenException('El token no contiene un rol');
    }

    const userPermissions = await this.permissionsCache.getPermissions(role);
    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission),
    );
    if (!hasPermission) {
      throw new ForbiddenException(
        `Faltan permisos. Requeridos: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
