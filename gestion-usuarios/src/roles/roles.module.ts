import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';

import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { RolePermissionsService } from './role-permissions.service';
import { RolePermissionsController } from './role-permissions.controller';
import { InternalRolePermissionsController } from './internal-role-permissions.controller';
import { AuthzEventsPublisher } from './authz-events.publisher';
import { InternalKeyGuard } from 'src/auth/guards/internal-key.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, RolePermission])],
  controllers: [
    RolesController,
    PermissionsController,
    RolePermissionsController,
    InternalRolePermissionsController,
  ],
  providers: [
    RolesService,
    PermissionsService,
    RolePermissionsService,
    AuthzEventsPublisher,
    InternalKeyGuard,
  ],
  exports: [RolesService, PermissionsService, RolePermissionsService, TypeOrmModule],
})
export class RolesModule {}
