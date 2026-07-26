import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Persona } from './entities/persona.entity';
import { User } from '../users/entities/user.entity';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { RoleusersService } from '../roleusers/roleusers.service';

@Injectable()
export class PersonasService {
  constructor(
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly usersService: UsersService,
    private readonly roleusersService: RoleusersService,

    private readonly dataSource: DataSource,
  ) {}

  /**
   * Crea una persona y simultáneamente genera su usuario.
   * El username se genera con: inicial del nombre + inicial del segundo nombre + apellido.
   * Si el username existe, se agrega un número incremental.
   * La contraseña inicial por defecto es el DNI de la persona (hasheado con bcrypt).
   */
  async create(createPersonaDto: CreatePersonaDto): Promise<{ persona: Persona; user: User }> {
    // Verificar unicidad de DNI, email y phone antes de iniciar la transacción
    const [dniExists, emailExists, phoneExists] = await Promise.all([
      this.personaRepository.findOne({ where: { dni: createPersonaDto.dni } }),
      this.personaRepository.findOne({ where: { email: createPersonaDto.email } }),
      this.personaRepository.findOne({ where: { phone: createPersonaDto.phone } }),
    ]);

    if (dniExists) throw new ConflictException(`El DNI "${createPersonaDto.dni}" ya está registrado`);
    if (emailExists) throw new ConflictException(`El email "${createPersonaDto.email}" ya está registrado`);
    if (phoneExists) throw new ConflictException(`El teléfono "${createPersonaDto.phone}" ya está registrado`);

    // Generar username único
    const username = await this.usersService.generateUsername(
      createPersonaDto.firstName,
      createPersonaDto.lastName,
      createPersonaDto.middleName,
    );

    // Contraseña inicial = DNI hasheado
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(createPersonaDto.dni, saltRounds);

    // Transacción: crear persona y usuario de forma atómica
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Crear la persona
      const persona = queryRunner.manager.create(Persona, {
        activo: true,
        address: createPersonaDto.address,
        dni: createPersonaDto.dni,
        email: createPersonaDto.email,
        first_name: createPersonaDto.firstName,
        last_name: createPersonaDto.lastName,
        middle_name: createPersonaDto.middleName,
        nationality: createPersonaDto.nationality,
        phone: createPersonaDto.phone,
      });
      persona.created_at = new Date();

      //Crear y guardar la persona
      const savedPersona = await queryRunner.manager.save(Persona, persona);
      await queryRunner.commitTransaction();

      // 2. Crear el usuario vinculado a la persona
      const createdUser = await this.usersService.createUserFromPersona(savedPersona);

      // 3. Asignar rol CLIENTE automáticamente
      try {
        await this.roleusersService.create({
          id_user: createdUser.id,
          role_name: 'CLIENTE',
        });
      } catch (e) {
        console.error("Error asignando rol CLIENTE automáticamente", e);
      }

      return { persona: savedPersona, user: createdUser };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Persona[]> {
    return this.personaRepository.find({ relations: { user: true } });
  }

  async findOne(id: string): Promise<Persona> {
    const persona = await this.personaRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!persona) {
      throw new NotFoundException(`Persona con id "${id}" no encontrada`);
    }
    return persona;
  }

  async findByDni(dni: string): Promise<Persona> {
    const persona = await this.personaRepository.findOne({
      where: { dni },
      relations: { user: true },
    });
    if (!persona) {
      throw new NotFoundException(`Persona con DNI "${dni}" no encontrada`);
    }
    return persona;
  }

  async update(id: string, updatePersonaDto: UpdatePersonaDto): Promise<Persona> {
    const persona = await this.findOne(id);

    // Verificar unicidad si se actualizan campos únicos
    //El dni por ahora no se actualiza
    // if (updatePersonaDto.dni && updatePersonaDto.dni !== persona.dni) {
    //   const exists = await this.personaRepository.findOne({ where: { dni: updatePersonaDto.dni } });
    //   if (exists) throw new ConflictException(`El DNI "${updatePersonaDto.dni}" ya está registrado`);
    // }
    if (updatePersonaDto.email && updatePersonaDto.email !== persona.email) {
      const exists = await this.personaRepository.findOne({ where: { email: updatePersonaDto.email } });
      if (exists) throw new ConflictException(`El email "${updatePersonaDto.email}" ya está registrado`);
    }
    if (updatePersonaDto.phone && updatePersonaDto.phone !== persona.phone) {
      const exists = await this.personaRepository.findOne({ where: { phone: updatePersonaDto.phone } });
      if (exists) throw new ConflictException(`El teléfono "${updatePersonaDto.phone}" ya está registrado`);
    }

    // Mapear campos del DTO a la entidad
    const updateData: Partial<Persona> = {
      ...(updatePersonaDto.address !== undefined && { address: updatePersonaDto.address }),
      ...(updatePersonaDto.email && { email: updatePersonaDto.email }),
      ...(updatePersonaDto.firstName && { first_name: updatePersonaDto.firstName }),
      ...(updatePersonaDto.lastName && { last_name: updatePersonaDto.lastName }),
      ...(updatePersonaDto.middleName !== undefined && { middle_name: updatePersonaDto.middleName }),
      ...(updatePersonaDto.nationality && { nationality: updatePersonaDto.nationality }),
      ...(updatePersonaDto.phone && { phone: updatePersonaDto.phone }),
    };

    Object.assign(persona, updateData);
    persona.updated_at = new Date();
    return this.personaRepository.save(persona);
  }

  async activate(id : string){
    const persona = await this.findOne(id);
    persona.activo = true;
    return this.personaRepository.save(persona);
  }

  async deactivate(id : string){
    const persona = await this.findOne(id);
    persona.activo = false;
    return this.personaRepository.save(persona);
  }

  

  async remove(id: string): Promise<{ message: string }> {
    const persona = await this.findOne(id);
    await this.personaRepository.remove(persona);
    return { message: `Persona con id "${id}" eliminada correctamente` };
  }
}
