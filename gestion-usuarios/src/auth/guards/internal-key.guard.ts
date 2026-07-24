import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Protege endpoints internos (red docker/k8s) con un secreto compartido.
 * El consumidor debe enviar el header `x-internal-key` con el valor de INTERNAL_API_KEY.
 * Complementa (no sustituye) la restricción de la ruta en Kong para no exponerla afuera.
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('INTERNAL_API_KEY');
    if (!expected) {
      // Si no está configurado, se deniega por seguridad (fail-closed).
      throw new UnauthorizedException('Servicio interno no configurado');
    }

    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-internal-key'];

    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Clave interna inválida o ausente');
    }
    return true;
  }
}
