import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Vehiculo } from '../src/vehiculos/entities/vehiculo.entity';
import { ZonasClientService } from '../src/gateway/zonas-client.service';
import { PersonasClientService } from '../src/vehiculos/personas-client.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import { PermissionsCacheService } from '../src/auth/permissions-cache.service';
import { FactoryVehiculos } from '../src/factory.vehiculo';

describe('GatewayController (REST - Sociable Tests)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const mockZonasClientService = {
    consultarDisponibilidad: jest.fn().mockResolvedValue({ hayCupo: true, espaciosDisponibles: 10 }),
  };

  const mockPersonasClientService = {
    existePersona: jest.fn().mockResolvedValue(true),
  };

  const mockPermissionsCacheService = {
    getPermissions: jest.fn().mockResolvedValue(['GATEWAY_ACCESS', 'VEHICULOS_CREATE', 'VEHICULOS_READ']),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ZonasClientService)
      .useValue(mockZonasClientService)
      .overrideProvider(PersonasClientService)
      .useValue(mockPersonasClientService)
      .overrideProvider(PermissionsCacheService)
      .useValue(mockPermissionsCacheService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = { role: 'ADMIN', sub: '123e4567-e89b-12d3-a456-426614174000' };
          return true;
        },
      })
      .overrideGuard(PermissionsGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    );
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    if (dataSource) {
      const repository = dataSource.getRepository(Vehiculo);
      await repository.clear();
    }
  });

  async function seedVehiculo(placa = 'ABC-1234', estado = 'fuera', activo = true, tipo = 'Auto') {
    const dto = {
      tipo,
      idPropietario: '123e4567-e89b-12d3-a456-426614174000',
      datos: {
        placa,
        marca: 'Toyota',
        modelo: 'Corolla',
        color: 'Rojo',
        anio: 2022,
        clasificacion: 'Gasolina',
        numeroPuertas: 4,
        capacidadMaletero: 400,
      },
    };
    const vehiculo = FactoryVehiculos.crear(dto as any);
    vehiculo.estado = estado as any;
    vehiculo.activo = activo;
    const repository = dataSource.getRepository(Vehiculo);
    return await repository.save(vehiculo);
  }

  describe('CP1: Consultar Estado de Vehículo por Placa (GET /api/gateway/vehiculos/:placa)', () => {
    it('CP1.1 Consultar vehículo por placa existente ok', async () => {
      await seedVehiculo('ABC-1234', 'fuera', true, 'Auto');

      const res = await request(app.getHttpServer())
        .get('/api/gateway/vehiculos/ABC-1234')
        .expect(200);

      expect(res.body).toMatchObject({
        registrado: true,
        placa: 'ABC-1234',
        tipo: 'auto',
        clasificacion: 'Gasolina',
        estado: 'fuera',
        activo: true,
      });
      expect(res.body).toHaveProperty('id');
    });

    it('CP1.2 Consultar vehículo por placa no existente (sin resultados)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gateway/vehiculos/XYZ-9999')
        .expect(200);

      expect(res.body).toEqual({ registrado: false });
    });
  });

  describe('CP2: Autorizar Ingreso (POST /api/gateway/ingresos)', () => {
    it('CP2.1 Autorizar ingreso ok', async () => {
      await seedVehiculo('ABC-1234', 'fuera', true, 'Auto');
      mockZonasClientService.consultarDisponibilidad.mockResolvedValueOnce({ hayCupo: true, espaciosDisponibles: 5 });

      const res = await request(app.getHttpServer())
        .post('/api/gateway/ingresos')
        .send({ placa: 'ABC-1234' });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toMatchObject({
        autorizado: true,
        placa: 'ABC-1234',
        tipo: 'auto',
        clasificacion: 'Gasolina',
      });
      expect(res.body).toHaveProperty('vehiculoId');
      expect(res.body).toHaveProperty('fechaIngreso');

      const repo = dataSource.getRepository(Vehiculo);
      const updated = await repo.findOne({ where: { placa: 'ABC-1234' } });
      expect(updated?.estado).toBe('dentro');
    });

    it('CP2.2 Autorizar ingreso - Vehículo con ingreso activo (Conflicto / Duplicado)', async () => {
      await seedVehiculo('ABC-1234', 'dentro', true, 'Auto');

      await request(app.getHttpServer())
        .post('/api/gateway/ingresos')
        .send({ placa: 'ABC-1234' })
        .expect(409);
    });

    it('CP2.3 Autorizar ingreso - Vehículo no encontrado', async () => {
      await request(app.getHttpServer())
        .post('/api/gateway/ingresos')
        .send({ placa: 'ZZZ-9999' })
        .expect(404);
    });

    it('CP2.4 Autorizar ingreso - Vehículo bloqueado administrativamente', async () => {
      await seedVehiculo('ABC-1234', 'fuera', false, 'Auto');

      await request(app.getHttpServer())
        .post('/api/gateway/ingresos')
        .send({ placa: 'ABC-1234' })
        .expect(403);
    });

    it('CP2.5 Autorizar ingreso - Datos inválidos: Placa vacía o ausente', async () => {
      await request(app.getHttpServer())
        .post('/api/gateway/ingresos')
        .send({ placa: '' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/gateway/ingresos')
        .send({})
        .expect(400);
    });

    it('CP2.6 Autorizar ingreso - Datos inválidos: Placa con tipo de dato incorrecto (no string)', async () => {
      await request(app.getHttpServer())
        .post('/api/gateway/ingresos')
        .send({ placa: 1234 })
        .expect(400);
    });

    it('CP2.7 Autorizar ingreso - Datos inválidos: permitirSinValidarCupo con tipo incorrecto (no boolean)', async () => {
      await seedVehiculo('ABC-1234', 'fuera', true, 'Auto');

      await request(app.getHttpServer())
        .post('/api/gateway/ingresos')
        .send({ placa: 'ABC-1234', permitirSinValidarCupo: 'si' })
        .expect(400);
    });

    it('CP2.8 Autorizar ingreso - Sin cupo disponible (Modo estricto)', async () => {
      await seedVehiculo('ABC-1234', 'fuera', true, 'Auto');
      mockZonasClientService.consultarDisponibilidad.mockResolvedValueOnce({ hayCupo: false, espaciosDisponibles: 0 });

      await request(app.getHttpServer())
        .post('/api/gateway/ingresos')
        .send({ placa: 'ABC-1234', permitirSinValidarCupo: false })
        .expect(409);
    });
  });

  describe('CP3: Registrar Vehículo e Ingresar en un Solo Paso - Walk-in (POST /api/gateway/ingresos/walk-in)', () => {
    it('CP3.1 Registrar vehículo e ingresar ok', async () => {
      mockZonasClientService.consultarDisponibilidad.mockResolvedValueOnce({ hayCupo: true, espaciosDisponibles: 5 });

      const dto = {
        vehiculo: {
          tipo: 'Auto',
          idPropietario: '123e4567-e89b-12d3-a456-426614174000',
          datos: {
            placa: 'WAK-1234',
            marca: 'Chevrolet',
            modelo: 'Aveo',
            color: 'Azul',
            anio: 2020,
            clasificacion: 'Gasolina',
            numeroPuertas: 4,
            capacidadMaletero: 350
          },
        },
        permitirSinValidarCupo: false,
      };

      const res = await request(app.getHttpServer())
        .post('/api/gateway/ingresos/walk-in')
        .send(dto)
        .expect(201);

      expect(res.body).toMatchObject({
        autorizado: true,
        placa: 'WAK-1234',
      });
      expect(res.body).toHaveProperty('vehiculoId');
      expect(res.body).toHaveProperty('fechaIngreso');

      const repo = dataSource.getRepository(Vehiculo);
      const created = await repo.findOne({ where: { placa: 'WAK-1234' } });
      expect(created).toBeDefined();
      expect(created?.estado).toBe('dentro');
    });

    it('CP3.2 Registrar vehículo e ingresar - Placa duplicada', async () => {
      await seedVehiculo('WAK-1234', 'fuera', true, 'Auto');

      const dto = {
        vehiculo: {
          tipo: 'Auto',
          idPropietario: '123e4567-e89b-12d3-a456-426614174000',
          datos: {
            placa: 'WAK-1234',
            marca: 'Chevrolet',
            modelo: 'Aveo',
            color: 'Azul',
            anio: 2020,
            clasificacion: 'Gasolina',
            numeroPuertas: 4,
            capacidadMaletero: 350,
          },
        },
      };

      await request(app.getHttpServer())
        .post('/api/gateway/ingresos/walk-in')
        .send(dto)
        .expect(409);
    });

    it('CP3.3 Registrar vehículo e ingresar - Datos de vehículo inválidos', async () => {
      const dto = {
        vehiculo: {
          tipo: 'Auto',
          idPropietario: '123e4567-e89b-12d3-a456-426614174000',
          datos: {
            placa: '',
            marca: '',
            modelo: 'Aveo',
            color: 'Azul',
            anio: 2020,
            clasificacion: 'Gasolina',
            numeroPuertas: 4,
            capacidadMaletero: 350,
          },
        },
      };

      await request(app.getHttpServer())
        .post('/api/gateway/ingresos/walk-in')
        .send(dto)
        .expect(400);

      const repo = dataSource.getRepository(Vehiculo);
      const count = await repo.count();
      expect(count).toBe(0);
    });

    it('CP3.4 Registrar vehículo e ingresar - Datos inválidos: permitirSinValidarCupo con tipo incorrecto', async () => {
      const dto = {
        vehiculo: {
          tipo: 'Auto',
          idPropietario: '123e4567-e89b-12d3-a456-426614174000',
          datos: {
            placa: 'WAK-456',
            marca: 'Mazda',
            modelo: '3',
            color: 'Negro',
            anio: 2022,
            clasificacion: 'Gasolina',
            numeroPuertas: 4,
            capacidadMaletero: 400,
          },
        },
        permitirSinValidarCupo: 123,
      };

      await request(app.getHttpServer())
        .post('/api/gateway/ingresos/walk-in')
        .send(dto)
        .expect(400);
    });
  });

  describe('CP4: Autorizar Salida (POST /api/gateway/salidas)', () => {
    it('CP4.1 Autorizar salida ok', async () => {
      await seedVehiculo('ABC-1234', 'dentro', true, 'Auto');

      const res = await request(app.getHttpServer())
        .post('/api/gateway/salidas')
        .send({ placa: 'ABC-1234' });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toMatchObject({
        autorizado: true,
        placa: 'ABC-1234',
      });
      expect(res.body).toHaveProperty('vehiculoId');
      expect(res.body).toHaveProperty('fechaIngreso');
      expect(res.body).toHaveProperty('fechaSalida');

      const repo = dataSource.getRepository(Vehiculo);
      const updated = await repo.findOne({ where: { placa: 'ABC-1234' } });
      expect(updated?.estado).toBe('fuera');
    });

    it('CP4.2 Autorizar salida - Vehículo no encontrado', async () => {
      await request(app.getHttpServer())
        .post('/api/gateway/salidas')
        .send({ placa: 'ZZZ-9999' })
        .expect(404);
    });

    it('CP4.3 Autorizar salida - Vehículo sin ingreso activo', async () => {
      await seedVehiculo('ABC-1234', 'fuera', true, 'Auto');

      await request(app.getHttpServer())
        .post('/api/gateway/salidas')
        .send({ placa: 'ABC-1234' })
        .expect(409);
    });

    it('CP4.4 Autorizar salida - Datos inválidos: Placa vacía o ausente', async () => {
      await request(app.getHttpServer())
        .post('/api/gateway/salidas')
        .send({ placa: '' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/gateway/salidas')
        .send({})
        .expect(400);
    });

    it('CP4.5 Autorizar salida - Datos inválidos: Placa con tipo de dato incorrecto (no string)', async () => {
      await request(app.getHttpServer())
        .post('/api/gateway/salidas')
        .send({ placa: 9876 })
        .expect(400);
    });
  });
});
