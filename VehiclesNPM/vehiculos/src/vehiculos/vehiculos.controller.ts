import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateAutoDto, UpdateCamionetaDto, UpdateMotocicletaDto, UpdateVehiculoDto, UpdateVehiculoPipe } from './dto/update-vehiculo.dto';
import { UUID } from 'node:crypto';
import { ApiOperation, ApiResponse, ApiBadRequestResponse, ApiConflictResponse, ApiNotFoundResponse, ApiExtraModels, ApiParam, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Vehiculo } from './entities/vehiculo.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';

@ApiTags('vehiculos')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('vehiculos')
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) { }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un nuevo vehículo' })
  @ApiResponse({ status: 201, description: 'Vehículo creado exitosamente.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  @ApiConflictResponse({ description: 'La placa ya existe.' })
  @RequirePermissions('VEHICULOS_CREATE')
  @Post()
  create(@Body() createVehiculoDto: CreateVehiculoDto) {
    return this.vehiculosService.create(createVehiculoDto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna una lista de vehículos' })
  @ApiResponse({ status: 200, description: 'Lista de vehículos retornada exitosamente.', type: [Vehiculo] })
  @RequirePermissions('VEHICULOS_READ')
  @Get()
  findAll() {
    return this.vehiculosService.findAll();
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Busca un vehículo por Id' })
  @ApiResponse({ status: 200, description: 'Vehículo encontrado exitosamente.', type: Vehiculo })
  @ApiNotFoundResponse({ description: 'Vehículo no encontrado.' })
  @ApiParam({ name: 'id', description: 'UUID del vehículo a buscar', example: '123e4567-e89b-12d3-a456-426614174000' })
  @RequirePermissions('VEHICULOS_READ')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehiculosService.findOne(id);
  }

  //Endpoint clave para integraciones externas (sistema de tickets, LPR):
  //consulta por placa, no por UUID interno.
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Busca un vehículo por placa' })
  @ApiResponse({ status: 200, description: 'Vehículo encontrado exitosamente.', type: Vehiculo })
  @ApiNotFoundResponse({ description: 'Vehículo no encontrado.' })
  @ApiParam({ name: 'placa', description: 'Placa del vehículo a buscar', example: 'ABC-1234' })
  @RequirePermissions('VEHICULOS_READ')
  @Get('placa/:placa')
  findByPlaca(@Param('placa') placa: string) {
    return this.vehiculosService.findByPlaca(placa);
  }

  //Vehículos asociados a una persona (gestion-usuarios), ej. "mis vehículos".
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Busca vehículos por Id de propietario' })
  @ApiResponse({ status: 200, description: 'Vehículos encontrados exitosamente.', type: Vehiculo, isArray: true })
  @ApiNotFoundResponse({ description: 'No se encontraron vehículos para el propietario.' })
  @ApiParam({ name: 'idPropietario', description: 'ID del propietario', example: '123e4567-e89b-12d3-a456-426614174000' })
  @RequirePermissions('VEHICULOS_READ')
  @Get('propietario/:idPropietario')
  findByPropietario(@Param('idPropietario') idPropietario: string) {
    return this.vehiculosService.findByPropietario(idPropietario);
  }

  @ApiBearerAuth()
  @ApiOperation({summary: 'Actualiza un vehículo por Id'})
  @ApiNotFoundResponse({ description: 'Vehículo no encontrado.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 200, description: 'Vehículo actualizado exitosamente.', type: Vehiculo })
  @ApiExtraModels(UpdateAutoDto, UpdateMotocicletaDto, UpdateCamionetaDto)
  @ApiParam({ name: 'id', description: 'UUID del vehículo a actualizar', example: '123e4567-e89b-12d3-a456-426614174000' })
  @RequirePermissions('VEHICULOS_UPDATE')
  @Patch(':id')
  update(@Param('id') id: string, @Body(UpdateVehiculoPipe) updateVehiculoDto: any) {
    return this.vehiculosService.update(id, updateVehiculoDto);
  }

  //Revierte la baja lógica (DELETE). Opcionalmente reasigna propietario,
  //ej. el vehículo fue vendido y vuelve a operar con otro dueño.
  @ApiBearerAuth()
  @ApiOperation({summary: 'Reactivar un vehículo dado su Id'})
  @ApiNotFoundResponse({ description: 'Vehículo no encontrado.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 200, description: 'Vehículo reactivado exitosamente.', type: Vehiculo })
  @ApiParam({ name: 'id', description: 'UUID del vehículo a reactivar', example: '123e4567-e89b-12d3-a456-426614174000' })
  @RequirePermissions('VEHICULOS_UPDATE')
  @Patch(':id/reactivar')
  reactivar(@Param('id') id: string, @Body('idPropietario') idPropietario?: string) {
    return this.vehiculosService.reactivar(id, idPropietario);
  }

  @ApiBearerAuth()
  @ApiOperation({summary: 'Elimina un vehículo por Id'})
  @ApiNotFoundResponse({ description: 'Vehículo no encontrado.' })
  @ApiResponse({ status: 200, description: 'Vehículo eliminado exitosamente.'})
  @ApiParam({ name: 'id', description: 'UUID del vehículo a eliminar', example: '123e4567-e89b-12d3-a456-426614174000' })
  @RequirePermissions('VEHICULOS_DELETE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vehiculosService.remove(id);
  }
}
