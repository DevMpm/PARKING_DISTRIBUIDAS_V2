// jwt.strategy.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import * as jwksRsa from 'jwks-rsa'
import axios from 'axios';

// Variable global en el módulo para cachear la llave pública y no saturar el microservicio de Auth
let cachedPublicKey: string | null = null;


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(JwtStrategy.name);
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true, // cachea las claves para no golpear el endpoint en cada request
        cacheMaxAge: 600000, // 10 minutos
        rateLimit: true, // protege contra abuso si el cache expira
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