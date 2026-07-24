import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import * as jwksRsa from 'jwks-rsa';

// Cachea la clave pública para no saturar el microservicio de Auth
let cachedPublicKey: string | null = null;

/**
 * Estrategia JWT RS256 con JWKS — idéntica a la del servicio de vehículos.
 * Valida el token contra la clave pública publicada por moduloAuth.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        cacheMaxAge: 600000, // 10 minutos
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${configService.get('PUBLIC_KEY_URL')}`,
      }),
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role, // rol único (token access nuevo)
      roles: payload.roles, // compat con tokens antiguos
    };
  }
}
