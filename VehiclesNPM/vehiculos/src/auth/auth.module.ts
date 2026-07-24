import { Module } from '@nestjs/common';
import { JwtStrategy } from './strategies/jwt.strategy';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { PermissionsCacheService } from './permissions-cache.service';


@Module({
    providers: [JwtStrategy, JwtAuthGuard, PermissionsGuard, PermissionsCacheService],
    exports: [JwtStrategy, JwtAuthGuard, PermissionsGuard, PermissionsCacheService, JwtModule, PassportModule],
    imports: [HttpModule, JwtModule, PassportModule],
})
export class AuthModule {}

