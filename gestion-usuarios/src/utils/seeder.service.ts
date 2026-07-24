import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatePersonaDto } from 'src/personas/dto/create-persona.dto';
import { RolesService } from 'src/roles/roles.service';
import { PersonasService } from 'src/personas/personas.service';
import { RoleusersService } from 'src/roleusers/roleusers.service';
import { UsersService } from 'src/users/users.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Permission } from 'src/roles/entities/permission.entity';
import { RolePermission } from 'src/roles/entities/role-permission.entity';
import { CreateRoleuserDto } from 'src/roleusers/dto/create-roleuser.dto';
import { resolveServiceForPermission } from 'src/roles/service-catalog';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);
  constructor(
    private configService: ConfigService,
    private readonly roleService : RolesService,
    private readonly personasService : PersonasService,
    private readonly roleusersService : RoleusersService,
    private readonly usersService : UsersService,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>
  ) {}

  async onApplicationBootstrap() {
    await this.seedPermissionsAndRoles();
    await this.seedRootUser();
  }

  async seedPermissionsAndRoles() {
    const defaultPermissions = [
      'ZONAS_CREATE', 'ZONAS_READ', 'ZONAS_UPDATE', 'ZONAS_DELETE',
      'VEHICULOS_CREATE', 'VEHICULOS_READ', 'VEHICULOS_UPDATE', 'VEHICULOS_DELETE',
      'TICKETS_CREATE', 'TICKETS_READ', 'TICKETS_UPDATE', 'TICKETS_DELETE',
      'ASIGNACIONES_CREATE', 'ASIGNACIONES_READ', 'ASIGNACIONES_UPDATE', 'ASIGNACIONES_DELETE',
      'USUARIOS_CREATE', 'USUARIOS_READ', 'USUARIOS_UPDATE', 'USUARIOS_DELETE',
      'ROLES_CREATE', 'ROLES_READ', 'ROLES_UPDATE', 'ROLES_DELETE',
      'ROLEUSERS_CREATE', 'ROLEUSERS_READ', 'ROLEUSERS_UPDATE', 'ROLEUSERS_DELETE',
      'AUDITORIA_READ'
    ];

    const savedPermissions: Record<string, Permission> = {};
    for (const permName of defaultPermissions) {
      const service = resolveServiceForPermission(permName);
      let perm = await this.permissionRepository.findOne({ where: { name: permName } });
      if (!perm) {
        perm = this.permissionRepository.create({
          name: permName,
          description: `Permiso para ${permName}`,
          service,
        });
        await this.permissionRepository.save(perm);
      } else if (perm.service !== service) {
        // Backfill de permisos ya existentes (columna `service` nueva o desactualizada)
        perm.service = service;
        await this.permissionRepository.save(perm);
        this.logger.log(`Backfill service de ${permName} -> ${service}`);
      }
      savedPermissions[permName] = perm;
    }

    const rolesConfig = [
      {
        name: 'ROOT',
        description: 'Rol ROOT con acceso total',
        permissions: defaultPermissions
      },
      {
        name: 'ADMIN',
        description: 'Rol Administrador',
        permissions: [
          'ZONAS_CREATE', 'ZONAS_READ', 'ZONAS_UPDATE', 'ZONAS_DELETE',
          'VEHICULOS_CREATE', 'VEHICULOS_READ', 'VEHICULOS_UPDATE', 'VEHICULOS_DELETE',
          'USUARIOS_CREATE', 'USUARIOS_READ', 'USUARIOS_UPDATE', 'USUARIOS_DELETE',
          'ROLES_CREATE', 'ROLES_READ', 'ROLES_UPDATE', 'ROLES_DELETE',
          'ASIGNACIONES_CREATE', 'ASIGNACIONES_READ', 'ASIGNACIONES_UPDATE', 'ASIGNACIONES_DELETE',
          'ROLEUSERS_CREATE', 'ROLEUSERS_READ', 'ROLEUSERS_UPDATE', 'ROLEUSERS_DELETE',
          'AUDITORIA_READ'
        ]
      },
      {
        name: 'RECAUDADOR',
        description: 'Rol Recaudador',
        permissions: ['TICKETS_CREATE', 'TICKETS_READ', 'TICKETS_UPDATE', 'VEHICULOS_READ', 'ASIGNACIONES_READ', 'ZONAS_READ', 'ZONAS_UPDATE']
      },
      {
        name: 'CLIENTE',
        description: 'Rol Cliente',
        permissions: [
          'ZONAS_READ', 'VEHICULOS_CREATE', 'VEHICULOS_READ', 'VEHICULOS_UPDATE', 'VEHICULOS_DELETE',
          'USUARIOS_READ', 'USUARIOS_UPDATE'
        ]
      }
    ];

    for (const roleConfig of rolesConfig) {
      let role;
      try {
        role = await this.roleService.findByName(roleConfig.name);
      } catch (error) {
        this.logger.log(`Sembrando rol ${roleConfig.name}...`);
        role = await this.roleService.create({
          name: roleConfig.name,
          description: roleConfig.description,
        });
        this.logger.log(`Rol ${roleConfig.name} creado`);
      }

      for (const permName of roleConfig.permissions) {
        const perm = savedPermissions[permName];
        if (perm) {
          const exists = await this.rolePermissionRepository.findOne({
            where: { id_role: role.id, id_permission: perm.id }
          });
          if (!exists) {
            const rp = this.rolePermissionRepository.create({
              id_role: role.id,
              id_permission: perm.id
            });
            await this.rolePermissionRepository.save(rp);
          }
        }
      }
    }
  }

  async seedRootUser() {
    const rootRole = await this.roleService.findByName('ROOT');
    const existingRootUser = await this.roleusersService.findByRole(rootRole!.id);

    if (existingRootUser.length === 0) {
      this.logger.log('Sembrando usuario root...');

      const personaData: CreatePersonaDto = {
        firstName : this.configService.get('ROOT_USER_NAME')!,
        lastName: this.configService.get('ROOT_USER_LASTNAME')!,
        email: 'root@rootmail.com',
        dni: this.configService.get('ROOT_USER_DNI')!,
        phone: '0987654321',
        nationality: 'Ecuatoriano',
      };

      const persona = await this.personasService.create(personaData);
      const adminUser = await this.usersService.findOne(persona.user.id);

      const roleAssignation: CreateRoleuserDto = {
        id_user: adminUser.id,
        role_name: 'ROOT',
      };
      await this.roleusersService.create(roleAssignation);
    }
  }
}