import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePermission } from './entities/role-permission.entity';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import { AuthzEventsPublisher } from './authz-events.publisher';

@Injectable()
export class RolePermissionsService {
  constructor(
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
    private rolesService: RolesService,
    private permissionsService: PermissionsService,
    private authzEvents: AuthzEventsPublisher,
  ) {}

  /**
   * Resuelve los nombres de permisos ACTIVOS de un rol filtrados por servicio.
   * Base de la autorización pull (Fase 4): el consumidor envía { role, serviceId }.
   * Si el rol no existe, devuelve [] (deny-by-default en el consumidor).
   */
  async getPermissionsByRoleAndService(
    roleName: string,
    serviceId: string,
  ): Promise<string[]> {
    // Se une el rol por nombre en la misma query: si el rol no existe o está
    // inactivo, el resultado es [] (deny-by-default en el consumidor).
    const rows = await this.rolePermissionRepository
      .createQueryBuilder('rp')
      .innerJoin('rp.role', 'r')
      .innerJoin('rp.permission', 'p')
      .where('r.name = :roleName', { roleName })
      .andWhere('r.active = true')
      .andWhere('rp.active = true')
      .andWhere('p.active = true')
      .andWhere('p.service = :serviceId', { serviceId })
      .select('p.name', 'name')
      .getRawMany();

    return rows.map((r) => r.name);
  }

  async assignPermission(roleId: string, permissionId: string): Promise<RolePermission> {
    const role = await this.rolesService.findOne(roleId);
    if (!role.active) throw new ConflictException(`El rol "${role.name}" está inactivo`);
    
    const permission = await this.permissionsService.findOne(permissionId);
    if (!permission.active) throw new ConflictException(`El permiso "${permission.name}" está inactivo`);

    const existing = await this.rolePermissionRepository.findOne({
      where: { id_role: roleId, id_permission: permissionId },
    });

    if (existing) {
      if (existing.active) {
        throw new ConflictException('El rol ya tiene asignado este permiso');
      }
      existing.active = true;
      const saved = await this.rolePermissionRepository.save(existing);
      await this.authzEvents.publishRolePermissionsChanged(role.name, permission.service);
      return saved;
    }

    const rp = this.rolePermissionRepository.create({
      id_role: roleId,
      id_permission: permissionId,
    });
    const saved = await this.rolePermissionRepository.save(rp);
    await this.authzEvents.publishRolePermissionsChanged(role.name, permission.service);
    return saved;
  }

  async removePermission(roleId: string, permissionId: string): Promise<{ message: string }> {
    const existing = await this.rolePermissionRepository.findOne({
      where: { id_role: roleId, id_permission: permissionId },
    });
    if (!existing) {
      throw new NotFoundException('El rol no tiene asignado este permiso');
    }
    await this.rolePermissionRepository.remove(existing);

    // Evento de invalidación de caché (best-effort)
    const role = await this.rolesService.findOne(roleId);
    const permission = await this.permissionsService.findOne(permissionId);
    await this.authzEvents.publishRolePermissionsChanged(role.name, permission.service);

    return { message: 'Permiso removido del rol exitosamente' };
  }

  async findByRole(roleId: string): Promise<RolePermission[]> {
    const role = await this.rolesService.findOne(roleId);
    return this.rolePermissionRepository.find({
      where: { id_role: roleId, active: true },
      relations: { permission: true },
    });
  }
}
