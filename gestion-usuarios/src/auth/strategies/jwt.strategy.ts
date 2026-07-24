import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtPublicKey = process.env.JWT_PUBLIC_KEY;
    const pemPublicKey = Buffer.from(jwtPublicKey!, 'base64').toString('utf-8');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKey: pemPublicKey || process.env.JWT_SECRET!, // Asegúrate de que esta variable de entorno esté configurada correctamente
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role, // rol único (tokens access/refresh)
      roles: payload.roles, // lista de roles (token pre-auth)
      permissions: payload.permissions,
      type: payload.type, // 'pre-auth' | 'access' | 'refresh'
    };
  }
}
