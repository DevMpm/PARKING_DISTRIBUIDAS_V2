import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsCacheService } from '../permissions-cache.service';

/**
 * Autorización PULL: obtiene el rol único del JWT y resuelve sus permisos para
 * este servicio vía PermissionsCacheService (caché + gestion-usuarios), en lugar
 * de leerlos del header `x-user-permissions` inyectado por Kong.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsCache: PermissionsCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );
    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    // Rol único del token (compat: primer rol de tokens antiguos)
    const role: string | undefined =
      request.user?.role ?? request.user?.roles?.[0];
    if (!role) {
      throw new ForbiddenException('El token no contiene un rol');
    }

    const userPermissions = await this.permissionsCache.getPermissions(role);
    const hasPermission = requiredPermissions.some((p) =>
      userPermissions.includes(p),
    );
    if (!hasPermission) {
      throw new ForbiddenException(
        `Faltan permisos. Requeridos: ${requiredPermissions.join(', ')}`,
      );
    }
    return true;
  }
}
