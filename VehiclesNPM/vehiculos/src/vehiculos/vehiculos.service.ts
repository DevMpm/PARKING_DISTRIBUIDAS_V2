import { BadRequestException, Body, ConflictException, ForbiddenException, Injectable, NotFoundException, Param } from '@nestjs/common';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { EstadoVehiculo, Vehiculo } from './entities/vehiculo.entity';
import { Repository } from 'typeorm';
import { FactoryVehiculos } from 'src/factory.vehiculo';
import { UUID } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { map } from 'rxjs';
import { notContains, validate } from 'class-validator';
import { PersonasClientService } from './personas-client.service';
import { ApiExtraModels } from '@nestjs/swagger';
import { AuditEvent, EventPublisher } from './event-publisher';

@ApiExtraModels(Vehiculo)
@Injectable()
export class VehiculosService {
  constructor(@InjectRepository(Vehiculo)
    private repositoryVehiculo: Repository<Vehiculo>,
    private personasClientService: PersonasClientService,
    private eventPublisher: EventPublisher
    ){
    }

    // Método auxiliar para publicar eventos
  // private async emitEvent(
  //   accion: string,
  //   vehiculo: Vehiculo,
  //   datosExtra?: any,
  // ) {
  //   const event: AuditEvent = {
  //     servicio: 'vehiculos',
  //     accion,
  //     entidad: 'Vehiculo',
  //     datos: { ...vehiculo, ...datosExtra },
  //     // usuario e ip se podrían obtener del contexto (request) si se inyecta
  //   };
  //   await this.eventPublisher.publish(event);
  // }

  async create(createVehiculoDto: CreateVehiculoDto) {
    const existe = await this.repositoryVehiculo.findOne({
      where : {
        placa: createVehiculoDto.datos.placa
      }
    });

    // CONFLICTO DETECTADO: remove() hace baja lógica (activo=false), pero
    // la placa sigue siendo unique en la BD. Sin este chequeo, una placa
    // dada de baja quedaría bloqueada para siempre y nunca podría
    // volver a registrarse, ni con el mismo dueño ni con uno nuevo.
    if (existe && !existe.activo) {
      throw new ConflictException(
        'Existe un vehículo dado de baja con esa placa. Reactívelo en vez de crear uno nuevo.',
      );
    }
    if (existe) {
      throw new ConflictException("Ya existe un vehículo con esa placa");
   }
    if (createVehiculoDto.idPropietario) {
      const personaExiste = await this.personasClientService.existePersona(createVehiculoDto.idPropietario);
      if (!personaExiste) {
        throw new NotFoundException('El propietario indicado no existe en gestion-usuarios');
      }
    }

    const vehiculo = FactoryVehiculos.crear(createVehiculoDto);

    const saved = await this.repositoryVehiculo.save(vehiculo);

    //await this.emitEvent('CREATE', saved);

    return saved;

  }

  //Reactiva un vehículo dado de baja lógicamente, conservando su historial
  //(mismo id, mismos tickets pasados). Opcionalmente reasigna propietario.
  async reactivar(id: string, idPropietario?: string) {
    const vehiculo = await this.findOne(id);

    if (vehiculo.activo) {
      throw new ConflictException('El vehículo ya está activo');
    }

    if (idPropietario) {
      const personaExiste = await this.personasClientService.existePersona(idPropietario);
      if (!personaExiste) {
        throw new NotFoundException('El propietario indicado no existe en gestion-usuarios');
      }
      vehiculo.idPropietario = idPropietario;
    }

    vehiculo.activo = true;
    const saved = await this.repositoryVehiculo.save(vehiculo);
    //await this.emitEvent('REACTIVATE', saved);
    return saved;
  }

  async findAll() {
    
    return await this.repositoryVehiculo.find();
  }

  async findOne(id: string) {
    const existe = await this.repositoryVehiculo.findOne(
      {
        where : {
          id : id
        }
      }
    );

    if(!existe){
      throw new NotFoundException("Vehiculo no encontrado");
    }
    //await this.emitEvent('READ', existe);
    return existe;
  }

  //Búsqueda por placa: es la forma en la que el sistema de tickets
  //identifica un vehículo (cámara LPR o digitado por el guardia),
  //nunca conoce el UUID interno.
  async findByPlaca(placa: string) {
    const existe = await this.repositoryVehiculo.findOne({
      where: { placa }
    });

    if (!existe) {
      throw new NotFoundException(`No existe un vehículo registrado con la placa ${placa}`);
    }
    //await this.emitEvent('READ', existe);
    return existe;
  }

  //Variante que no lanza excepción, útil cuando el gateway necesita
  //decidir entre "ya existe" vs "hay que registrarlo".
  async findByPlacaOpcional(placa: string) {
    //await this.emitEvent('READ', existe);
    return await this.repositoryVehiculo.findOne({ where: { placa } });;
  }

  //Reglas de negocio para autorizar el ingreso físico al parqueadero.
  //No emite el ticket (eso es responsabilidad del módulo de tickets),
  //solo garantiza que el estado del vehículo sea consistente.
  async marcarIngreso(vehiculo: Vehiculo) {
    if (!vehiculo.activo) {
      throw new ForbiddenException('El vehículo está bloqueado administrativamente y no puede ingresar');
    }
    if (vehiculo.estado === EstadoVehiculo.DENTRO) {
      throw new ConflictException('El vehículo ya tiene un ingreso activo registrado (no se registró su salida anterior)');
    }

    vehiculo.estado = EstadoVehiculo.DENTRO;
    vehiculo.fechaUltimoIngreso = new Date();
    const saved = await this.repositoryVehiculo.save(vehiculo);
    //await this.emitEvent('UPDATE', saved);
    return saved;
  }

  async marcarSalida(vehiculo: Vehiculo) {
    if (vehiculo.estado === EstadoVehiculo.FUERA) {
      throw new ConflictException('El vehículo no tiene un ingreso activo: no se puede registrar la salida');
    }

    vehiculo.estado = EstadoVehiculo.FUERA;
    vehiculo.fechaUltimaSalida = new Date();
    return this.repositoryVehiculo.save(vehiculo);
  }

  //Vehículos de una persona — útil para "mis vehículos" en una app,
  //o para que facturación sepa qué cobrarle a quién.
  async findByPropietario(idPropietario: string) {
    return this.repositoryVehiculo.find({ where: { idPropietario } });
  }

  async update(id: string, dto : UpdateVehiculoDto) {
    const objVehiculo = await this.findOne(id);
    const tipo = objVehiculo.obtenerTipo().toLowerCase();

    if (dto.idPropietario) {
      const personaExiste = await this.personasClientService.existePersona(dto.idPropietario);
      if (!personaExiste) {
        throw new NotFoundException('El propietario indicado no existe en gestion-usuarios');
      }
    }

    Object.assign(objVehiculo, dto);

    return this.repositoryVehiculo.save(objVehiculo);
    
    
  }

  //Baja lógica en vez de borrado físico: los tickets históricos
  //quedan referenciando este vehículo, así que nunca se elimina la fila.
  async remove(id: string) {
    const vehiculo = await this.findOne(id);

    if (vehiculo.estado === EstadoVehiculo.DENTRO) {
      throw new ConflictException('No se puede dar de baja un vehículo que está dentro del parqueadero');
    }

    vehiculo.activo = false;
    return this.repositoryVehiculo.save(vehiculo);
  }

  //Borrado físico real, de uso interno: solo lo usa el gateway para
  //compensar un registro walk-in que falló justo después de crearse
  //(antes de que exista cualquier ticket que lo referencie). NUNCA
  //exponer esto en un endpoint público.
  async eliminarFisico(id: string) {
    await this.repositoryVehiculo.delete(id);
  }
}
