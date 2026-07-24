import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard que acepta ÚNICAMENTE tokens de tipo 'pre-auth'.
 * Se usa en el endpoint de selección de rol.
 */
@Injectable()
export class PreAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Token inválido o ausente');
    }
    if (user.type !== 'pre-auth') {
      throw new UnauthorizedException('Se requiere un token pre-auth');
    }
    return user;
  }
}
