import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SelectRoleDto } from './dto/select-role.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PreAuthGuard } from './guards/pre-auth.guard';
import { ClientIp } from './decorators/client-ip.decorator';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener token JWT' })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso. Retorna el access_token JWT.',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas o usuario inactivo.',
  })
  async login(@Body() loginDto: LoginDto, @ClientIp() ip: string) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );
    return this.authService.login(user, ip);
  }

  @UseGuards(PreAuthGuard)
  @Post('select-role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Seleccionar rol (requiere token pre-auth) y obtener access_token',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna access_token y refresh_token para el rol seleccionado.',
  })
  @ApiResponse({
    status: 403,
    description: 'El usuario no posee el rol solicitado.',
  })
  async selectRole(
    @Body() dto: SelectRoleDto,
    @Req() req,
    @ClientIp() ip: string,
  ) {
    return this.authService.selectRole(req.user, dto.role, ip);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refrescar access_token usando el refresh_token' })
  @ApiResponse({
    status: 200,
    description: 'Retorna nuevo access_token y refresh_token.',
  })
  async refresh(
    @Body('refresh_token') refreshToken: string,
    @ClientIp() ip: string,
  ) {
    if (!refreshToken) {
      throw new ForbiddenException('Se requiere un refresh_token');
    }
    return this.authService.refreshTokens(refreshToken, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Get('validate')
  @HttpCode(200)
  async validate(@Req() req) {
    return {
      userId: req.user.userId,
      username: req.user.username,
      role: req.user.role,
      roles: req.user.role ? [req.user.role] : req.user.roles,
      permissions: req.user.permissions,
    };
  }

  @ApiOperation({ summary: 'Obtener la clave pública para la verificación de JWT' })
  @ApiResponse({
    status: 200,
    description: 'Retorna la clave pública en formato PEM para la verificación de JWT.',
    example: {
      alg: 'RS256',
      kty: 'RSA',
      use: 'sig',
      pem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7V1Z5...IDAQAB\n-----END PUBLIC KEY-----'
    }
  })
  @Get('jwks')
  async getJwks() {
    return this.authService.returnPublicKey();
  }
}