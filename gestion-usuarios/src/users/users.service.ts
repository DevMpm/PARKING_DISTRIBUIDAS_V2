import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { Persona } from 'src/personas/entities/persona.entity';
import { RoleusersService } from 'src/roleusers/roleusers.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserDeactivatedEvent } from './user.events';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private eventEmitter : EventEmitter2
  ) {}

  /**
   * Genera un username único basado en: primera letra del nombre,
   * primera letra del segundo nombre (si existe), y el apellido completo.
   * Si el username ya existe, agrega un número incremental al final.
   * Ejemplo: "mateo sebastian llumigusin" -> "msllumigusin"
   */
  async generateUsername(
    firstName: string,
    lastName: string,
    middleName?: string,
  ): Promise<string> {
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // quitar tildes
        .replace(/[^a-z0-9]/g, '');     // solo letras y números

    const firstInitial = normalize(firstName).charAt(0);
    const middleInitial = middleName ? normalize(middleName).charAt(0) : '';
    const lastNormalized = normalize(lastName);

    const baseUsername = `${firstInitial}${middleInitial}${lastNormalized}`;

    // Verificar si el username base ya existe
    const existing = await this.userRepository.findOne({
      where: { username: baseUsername },
    });

    if (!existing) {
      return baseUsername;
    }

    // Si existe, buscar el mayor número sufijo y agregar el siguiente
    let counter = 1;
    while (true) {
      const candidate = `${baseUsername}${counter}`;
      const found = await this.userRepository.findOne({
        where: { username: candidate },
      });
      if (!found) return candidate;
      counter++;
    }
  }

   async createUserFromPersona(datosPersona: Persona){
      const username = await this.generateUsername(datosPersona.first_name, datosPersona.last_name, datosPersona.middle_name);
      
   

      const dto = new CreateUserDto();
      dto.id_person = datosPersona.id;
      dto.password = datosPersona.dni;// Contraseña inicial = DNI hasheado
      dto.username = username;

      return await this.create(dto);
    }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { username: createUserDto.username },
    });
    if (existing) {
      throw new ConflictException(
        `El username "${createUserDto.username}" ya está en uso`,
      );
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      saltRounds,
    );

    const user = new User();
    user.id_person = createUserDto.id_person;
    user.username = createUserDto.username;
    user.active = true;
    user.created_at = new Date();
    user.password_hash = hashedPassword;

    return this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { persona: true },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con id "${id}" no encontrado`);
    }
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    const user =  this.userRepository.findOne({
      where: { username },
      relations: { persona: true },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con username "${username}" no encontrado`);
    }
    return user;
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username },
      relations: { userRoles: { role: { rolePermissions: { permission: true } } } },
    });
  }

async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
  const user = await this.findOne(id);

  if (updateUserDto.username && updateUserDto.username !== user.username) {
    const exists = await this.userRepository.findOne({
      where: { username: updateUserDto.username },
    });
    if (exists) {
      throw new ConflictException(
        `El username "${updateUserDto.username}" ya está en uso`,
      );
    }
  }

  let hashedPassword: string | undefined;
  if (updateUserDto.password) {
    const saltRounds = 10;
    hashedPassword = await bcrypt.hash(updateUserDto.password, saltRounds);
  }

  const { password, ...rest } = updateUserDto;
  Object.assign(user, rest);
  if (hashedPassword) user.password_hash = hashedPassword;

  user.updated_at = new Date();
  return this.userRepository.save(user);
}

   async activate(id : string){
    const user = await this.findOne(id);
    user.active = true;
    return this.userRepository.save(user);
  }

  async deactivate(id : string){
    const user = await this.findOne(id);
    user.active = false;
    this.eventEmitter.emit(UserDeactivatedEvent.name, new UserDeactivatedEvent( user.id));
    return this.userRepository.save(user);
  }


  async remove(id: string): Promise<{ message: string }> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
    return { message: `Usuario con id "${id}" eliminado correctamente` };
  }
}
