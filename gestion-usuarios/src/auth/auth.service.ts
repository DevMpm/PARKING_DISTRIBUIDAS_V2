import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

import { importSPKI, exportJWK } from 'jose';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByUsername(username);

    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciales inválidas o usuario inactivo');
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas o usuario inactivo');
    }

    const { password_hash, ...result } = user;
    return result;
  }

  /**
   * Punto de entrada tras validar credenciales.
   * - 1 rol activo  -> emite access (15m) + refresh (30d) directamente.
   * - >1 roles      -> emite un token 'pre-auth' (5m) y el cliente debe elegir rol
   *                    en /auth/select-role antes de recibir el access.
   */
  async login(user: any, ip?: string) {
    const activeRoles: string[] = user.userRoles
      .filter((ur: any) => ur.active === true)
      .map((ur: any) => ur.role.name);

    if (activeRoles.length === 0) {
      throw new ForbiddenException('El usuario no tiene roles activos');
    }

    if (activeRoles.length > 1) {
      const pre_auth_token = this.jwtService.sign(
        {
          sub: user.id,
          username: user.username,
          roles: activeRoles,
          type: 'pre-auth',
        },
        { keyid: 'main-key-2026', expiresIn: '5m' },
      );

      return {
        requiresRoleSelection: true,
        pre_auth_token,
        roles: activeRoles,
      };
    }

    return this.issueAccessTokens(user, activeRoles[0], ip);
  }

  /**
   * Emite access (15m) + refresh (30d) para UN único rol.
   * Los permisos incluidos se filtran al rol seleccionado.
   */
  private issueAccessTokens(user: any, role: string, ip?: string) {
    // Permisos activos del rol seleccionado (se mantienen en el token en la Fase 1;
    // se eliminarán cuando la autorización pase a modelo pull en los consumidores).
    const permissionsSet = new Set<string>();
    user.userRoles
      .filter((ur: any) => ur.active === true && ur.role.name === role)
      .forEach((ur: any) => {
        (ur.role.rolePermissions ?? [])
          .filter((rp: any) => rp.active === true && rp.permission.active === true)
          .forEach((rp: any) => permissionsSet.add(rp.permission.name));
      });
    const permissions = Array.from(permissionsSet);

    const basePayload = {
      sub: user.id,
      personId: user.id_person,
      username: user.username,
      audience: ['zonas-service', 'usuarios-service', 'vehiculos-service', 'tickets-service'],
      role, // rol ÚNICO seleccionado
      permissions,
      ip: ip ?? 'desconocida',
    };

    const access_token = this.jwtService.sign(
      { ...basePayload, type: 'access' },
      { keyid: 'main-key-2026' },
    );
    const refresh_token = this.jwtService.sign(
      { ...basePayload, type: 'refresh' },
      { keyid: 'main-key-2026', expiresIn: '30d' },
    );

    return { access_token, refresh_token };
  }

  /**
   * Intercambia un token 'pre-auth' por access + refresh con el rol elegido.
   * `preAuthUser` proviene de la estrategia JWT (ya con firma verificada).
   */
  async selectRole(preAuthUser: any, role: string, ip?: string) {
    if (preAuthUser?.type !== 'pre-auth') {
      throw new UnauthorizedException('El token no es de tipo pre-auth');
    }
    if (!Array.isArray(preAuthUser.roles) || !preAuthUser.roles.includes(role)) {
      throw new ForbiddenException('El usuario no posee el rol solicitado');
    }

    const user = await this.usersService.findOneByUsername(preAuthUser.username);
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuario inactivo o no encontrado');
    }

    // Revalida contra la BD que el rol siga activo para el usuario.
    const stillHasRole = user.userRoles.some(
      (ur: any) => ur.active === true && ur.role.name === role,
    );
    if (!stillHasRole) {
      throw new ForbiddenException('El rol ya no está activo para el usuario');
    }

    return this.issueAccessTokens(user, role, ip);
  }

  async refreshTokens(refreshToken: string, ip?: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('El token no es un refresh token válido');
      }

      const user = await this.usersService.findOneByUsername(decoded.username);
      if (!user || !user.active) {
        throw new UnauthorizedException('Usuario inactivo o no encontrado');
      }

      // Conserva el rol del refresh: no se reabre la selección de rol.
      const stillHasRole = user.userRoles.some(
        (ur: any) => ur.active === true && ur.role.name === decoded.role,
      );
      if (!stillHasRole) {
        throw new ForbiddenException('El rol asociado a la sesión ya no está activo');
      }

      return this.issueAccessTokens(user, decoded.role, ip);
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }



  async returnPublicKey() {
    const publicKeyBase64 = this.configService.get('JWT_PUBLIC_KEY');
  const pem = Buffer.from(publicKeyBase64, 'base64').toString('utf-8');

  const keyObject = await importSPKI(pem, 'RS256');
  const jwk = await exportJWK(keyObject);

  return {
    keys: [
      {
        ...jwk,
        use: 'sig',
        alg: 'RS256',
        kid: 'main-key-2026', // identificador único de esta clave
      },
    ],
  };
  }
}