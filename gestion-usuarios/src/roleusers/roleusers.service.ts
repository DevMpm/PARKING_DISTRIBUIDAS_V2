import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from './entities/roleuser.entity';
import { CreateRoleuserDto } from './dto/create-roleuser.dto';
import { UpdateRoleuserDto } from './dto/update-roleuser.dto';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';


@Injectable()
export class RoleusersService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    private readonly userService : UsersService,
    private readonly roleService : RolesService
  ) {}

  async create(createRoleuserDto: CreateRoleuserDto): Promise<UserRole> {
    const userExists = await this.userService.findOne(createRoleuserDto.id_user);
    const roleExists = await this.roleService.findByName(createRoleuserDto.role_name);
    if (!userExists.active) throw new ForbiddenException("El usuario está inactivo. No se le puede asignar ningún rol.");
    if(!roleExists?.active) throw new ForbiddenException("El rol ha sido desactivado, no se puede asignar.");
    const existing = await this.userRoleRepository.findOne({
      where: {
        id_user: createRoleuserDto.id_user,
        id_role: roleExists.id,
      },
    });
    if (existing) {
      throw new ConflictException(
        `El usuario "${userExists.username}" ya tiene asignado el rol "${roleExists.name}"`,
      );
    }

    const userRole = new UserRole();
    userRole.id_user = createRoleuserDto.id_user;
    userRole.id_role = roleExists.id;
    userRole.active = true;

    return this.userRoleRepository.save(userRole);
  }

  async findAll(): Promise<UserRole[]> {
    return this.userRoleRepository.find({
      relations: { role: true },
    });
  }

  async findOne(id_user: string, id_role: string): Promise<UserRole> {
    const userRole = await this.userRoleRepository.findOne({
      where: { id_user, id_role },
      relations: { user: true, role: true },
    });
    if (!userRole) {
      throw new NotFoundException(
        `Asignación de usuario "${id_user}" con rol "${id_role}" no encontrada`,
      );
    }
    return userRole;
  }

  async findByUser(id_user: string): Promise<UserRole[]> {
    return this.userRoleRepository.find({
      where: { id_user : id_user },
      relations: { role: true },
    });
  }

  async findByRole(roleId: string){
    return this.userRoleRepository.find({
      where: {id_role : roleId},
      relations: {user : true}
    });
  }

  async findByRoleName(roleName: string): Promise<UserRole[]> {
    const role = await this.roleService.findByName(roleName);
    if (!role) throw new NotFoundException(`Rol "${roleName}" no encontrado`);
    return this.findByRole(role.id);
  }

   async activate(id_user : string, id_role : string){
    const userRole = await this.findOne(id_user, id_role);
    const userExists = await this.userService.findOne(id_user);
    const roleExists = await this.roleService.findOne(id_role);
    if(!userExists.active) throw new ForbiddenException("El usuario está inactivo. No se puede reactivar la asignación.");
    if(!roleExists.active) throw new ForbiddenException("El rol ha sido desactivado, no se puede reactivar la asignación.");
    userRole.active = true;
    return this.userRoleRepository.save(userRole);
  }

  async deactivate(id_user : string, id_role : string){
    const assignation = await this.findOne(id_user, id_role);
    assignation.active = false;
    return this.userRoleRepository.save(assignation);
  }


  async deactivateByUser(user_id : string){
    const assignations = await this.findByUser(user_id);
    for (const a of assignations) {
      a.active = false;
      await this.userRoleRepository.save(a);
    }
  }

  async deactivateByRole(role_id : string){
    const assignations = await this.findByRole(role_id);
    for (const a of assignations) {
      a.active = false;
      await this.userRoleRepository.save(a);
    }
  }

  async remove(id_user: string, id_role: string): Promise<{ message: string }> {
    const userRole = await this.findOne(id_user, id_role);
    await this.userRoleRepository.remove(userRole);
    return {
      message: `Asignación del usuario "${id_user}" con rol "${id_role}" eliminada correctamente`,
    };
  }
}
