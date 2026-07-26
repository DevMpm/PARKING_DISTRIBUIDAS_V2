import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { Vehiculo } from './entities/vehiculo.entity';
import { PersonasClientService } from './personas-client.service';
import { EventPublisher } from './event-publisher';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { PermissionsCacheService } from 'src/auth/permissions-cache.service';
import { UpdateVehiculoPipe } from './dto/update-vehiculo.dto';

describe('VehiculosController (REST - CP Vehiculos Sociable)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const mockPersonasClientService = {
    existePersona: jest.fn().mockResolvedValue(true),
  };

  const mockEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const mockPermissionsCacheService = {
    getPermissions: jest.fn().mockResolvedValue([
      'VEHICULOS_CREATE',
      'VEHICULOS_READ',
      'VEHICULOS_UPDATE',
      'VEHICULOS_DELETE',
    ]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PersonasClientService)
      .useValue(mockPersonasClientService)
      .overrideProvider(EventPublisher)
      .useValue(mockEventPublisher)
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

  describe('Crear Vehículo (POST /api/vehiculos)', () => {
    it('CP1.1 Crear vehículo tipo Auto ok -> 201', async () => {
      const dto = {
        tipo: 'Auto',
        idPropietario: '123e4567-e89b-12d3-a456-426614174000',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/vehiculos')
        .send(dto)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.placa).toEqual(dto.datos.placa);
      expect(res.body.marca).toEqual(dto.datos.marca);
    });

    it('CP1.2 Crear vehículo tipo Motocicleta ok -> 201', async () => {
      const dto = {
        tipo: 'Motocicleta',
        datos: {
          placa: 'ABC-123D',
          marca: 'Honda',
          modelo: 'CBR',
          color: 'Negro',
          anio: 2023,
          clasificacion: 'Gasolina',
          tipoMoto: 'Deportiva',
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/vehiculos')
        .send(dto)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.placa).toEqual(dto.datos.placa);
    });

    it('CP1.3 Crear vehículo tipo Camioneta ok -> 201', async () => {
      const dto = {
        tipo: 'Camioneta',
        datos: {
          placa: 'ABC-1234',
          marca: 'Ford',
          modelo: 'Ranger',
          color: 'Blanco',
          anio: 2021,
          clasificacion: 'Diesel',
          cabina: 'doble',
          capacidadCarga: 800,
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/vehiculos')
        .send(dto)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.placa).toEqual(dto.datos.placa);
    });

    it('CP2. Crear vehículo duplicado -> 409', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };

      await request(app.getHttpServer())
        .post('/api/vehiculos')
        .send(dto)
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/vehiculos')
        .send(dto)
        .expect(409);
    });

    it('CP3.1 Placa base inválida -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'INVALIDA',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.2 Marca vacía o ausente -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: '',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.3 Marca muy corta (< 2) -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'A',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.4 Marca muy larga (> 30) -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'A'.repeat(31),
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.5 Marca con caracteres no permitidos -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota123',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.6 Modelo vacío o ausente -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: '',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.7 Modelo muy corto (< 3) -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'AB',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.8 Modelo muy largo (> 107) -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'A'.repeat(108),
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.9 Color vacío o inválido -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Ro',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.10 Año menor al permitido (< 1885) -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 1884,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.11 Año futuro mayor al actual -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2035,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.12 Clasificación inválida -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Nuclear',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.13 Auto - numeroPuertas < 2 -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 1,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.14 Auto - numeroPuertas > 5 -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 6,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.15 Auto - capacidadMaletero < 150 -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 100,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.16 Auto - capacidadMaletero > 800 -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 900,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.17 Motocicleta - placa inválida -> 400', async () => {
      const dto = {
        tipo: 'Motocicleta',
        datos: {
          placa: 'ABC-1234',
          marca: 'Honda',
          modelo: 'CBR',
          color: 'Negro',
          anio: 2023,
          clasificacion: 'Gasolina',
          tipoMoto: 'Deportiva',
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.18 Motocicleta - tipoMoto inválido -> 400', async () => {
      const dto = {
        tipo: 'Motocicleta',
        datos: {
          placa: 'ABC-123D',
          marca: 'Honda',
          modelo: 'CBR',
          color: 'Negro',
          anio: 2023,
          clasificacion: 'Gasolina',
          tipoMoto: 'Chopper',
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.19 Camioneta - cabina inválida -> 400', async () => {
      const dto = {
        tipo: 'Camioneta',
        datos: {
          placa: 'ABC-1234',
          marca: 'Ford',
          modelo: 'Ranger',
          color: 'Blanco',
          anio: 2021,
          clasificacion: 'Diesel',
          cabina: 'extrahumana',
          capacidadCarga: 800,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.20 Camioneta - capacidadCarga < 450 -> 400', async () => {
      const dto = {
        tipo: 'Camioneta',
        datos: {
          placa: 'ABC-1234',
          marca: 'Ford',
          modelo: 'Ranger',
          color: 'Blanco',
          anio: 2021,
          clasificacion: 'Diesel',
          cabina: 'doble',
          capacidadCarga: 300,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });

    it('CP3.21 Camioneta - capacidadCarga > 1360 -> 400', async () => {
      const dto = {
        tipo: 'Camioneta',
        datos: {
          placa: 'ABC-1234',
          marca: 'Ford',
          modelo: 'Ranger',
          color: 'Blanco',
          anio: 2021,
          clasificacion: 'Diesel',
          cabina: 'doble',
          capacidadCarga: 1500,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(400);
    });
  });

  describe('Obtener Vehículos (GET /api/vehiculos)', () => {
    it('CP4.1 Obtener todos los vehículos ok -> 200', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/vehiculos')
        .expect(200);

      expect(res.body.length).toEqual(1);
      expect(res.body[0].placa).toEqual('ABC-1234');
    });

    it('CP4.2 Obtener vehículos por propietario ok -> 200', async () => {
      const propietarioId = '123e4567-e89b-12d3-a456-426614174000';
      const dto = {
        tipo: 'Auto',
        idPropietario: propietarioId,
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/vehiculos/propietario/${propietarioId}`)
        .expect(200);

      expect(res.body.length).toEqual(1);
      expect(res.body[0].idPropietario).toEqual(propietarioId);
    });

    it('CP4.3 Obtener vehículos por propietario sin resultados -> 200 (array vacío)', async () => {
      const propietarioId = '123e4567-e89b-12d3-a456-426614174000';
      const res = await request(app.getHttpServer())
        .get(`/api/vehiculos/propietario/${propietarioId}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('Obtener Vehículo (GET /api/vehiculos/:id y /api/vehiculos/placa/:placa)', () => {
    it('CP5.1 Buscar vehículo por ID ok -> 200', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      const createRes = await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);
      const id = createRes.body.id;

      const res = await request(app.getHttpServer())
        .get(`/api/vehiculos/${id}`)
        .expect(200);

      expect(res.body.id).toEqual(id);
      expect(res.body.placa).toEqual('ABC-1234');
    });

    it('CP5.2 Buscar vehículo por ID no existente -> 404', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      await request(app.getHttpServer())
        .get(`/api/vehiculos/${id}`)
        .expect(404);
    });

    it('CP5.3 Buscar vehículo por placa ok -> 200', async () => {
      const placa = 'ABC-1234';
      const dto = {
        tipo: 'Auto',
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
      await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/vehiculos/placa/${placa}`)
        .expect(200);

      expect(res.body.placa).toEqual(placa);
    });

    it('CP5.4 Buscar vehículo por placa no existente -> 404', async () => {
      const placa = 'ZZZ-9999';
      await request(app.getHttpServer())
        .get(`/api/vehiculos/placa/${placa}`)
        .expect(404);
    });
  });

  describe('Actualizar Vehículo (PATCH /api/vehiculos/:id)', () => {
    it('CP6.1 Actualizar vehículo Auto ok -> 200', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      const createRes = await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);
      const id = createRes.body.id;

      const updateDto = { numeroPuertas: 2, capacidadMaletero: 500 };
      const res = await request(app.getHttpServer())
        .patch(`/api/vehiculos/${id}`)
        .send(updateDto)
        .expect(200);

      expect(res.body.numeroPuertas).toEqual(2);
      expect(res.body.capacidadMaletero).toEqual(500);
    });

    it('CP6.2 Actualizar vehículo Motocicleta ok -> 200', async () => {
      const dto = {
        tipo: 'Motocicleta',
        datos: {
          placa: 'ABC-123D',
          marca: 'Honda',
          modelo: 'CBR',
          color: 'Negro',
          anio: 2023,
          clasificacion: 'Gasolina',
          tipoMoto: 'Deportiva',
        },
      };
      const createRes = await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);
      const id = createRes.body.id;

      const updateDto = { tipoMoto: 'Scooter' };
      const res = await request(app.getHttpServer())
        .patch(`/api/vehiculos/${id}`)
        .send(updateDto)
        .expect(200);

      expect(res.body.tipoMoto).toEqual('Scooter');
    });

    it('CP6.3 Actualizar vehículo Camioneta ok -> 200', async () => {
      const dto = {
        tipo: 'Camioneta',
        datos: {
          placa: 'ABC-1234',
          marca: 'Ford',
          modelo: 'Ranger',
          color: 'Blanco',
          anio: 2021,
          clasificacion: 'Diesel',
          cabina: 'doble',
          capacidadCarga: 800,
        },
      };
      const createRes = await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);
      const id = createRes.body.id;

      const updateDto = { cabina: 'simple', capacidadCarga: 900 };
      const res = await request(app.getHttpServer())
        .patch(`/api/vehiculos/${id}`)
        .send(updateDto)
        .expect(200);

      expect(res.body.cabina).toEqual('simple');
      expect(res.body.capacidadCarga).toEqual(900);
    });

    it('CP6.4 Actualizar vehículo - Not Found -> 404', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      await request(app.getHttpServer())
        .patch(`/api/vehiculos/${id}`)
        .send({ numeroPuertas: 4 })
        .expect(404);
    });

    it('CP6.5 Actualizar vehículo - Intento de modificar placa -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      const createRes = await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);
      const id = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/vehiculos/${id}`)
        .send({ placa: 'XYZ-9999' })
        .expect(400);
    });

    it('CP6.6 Actualizar vehículo - Intento de modificar marca, modelo o año -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      const createRes = await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);
      const id = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/vehiculos/${id}`)
        .send({ marca: 'Honda' })
        .expect(400);
    });

    it('CP6.7 Actualizar Auto - número de puertas inválido -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      const createRes = await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);
      const id = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/vehiculos/${id}`)
        .send({ numeroPuertas: 1 })
        .expect(400);
    });

    it('CP6.8 Actualizar Auto - capacidad de maletero inválida -> 400', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      const createRes = await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);
      const id = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/vehiculos/${id}`)
        .send({ capacidadMaletero: 50 })
        .expect(400);
    });

    it('CP6.9 Actualizar Motocicleta - tipo de moto inválido -> 400', async () => {
      const dto = {
        tipo: 'Motocicleta',
        datos: {
          placa: 'ABC-123D',
          marca: 'Honda',
          modelo: 'CBR',
          color: 'Negro',
          anio: 2023,
          clasificacion: 'Gasolina',
          tipoMoto: 'Deportiva',
        },
      };
      const createRes = await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);
      const id = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/vehiculos/${id}`)
        .send({ tipoMoto: 'Invalido' })
        .expect(400);
    });

    it('CP6.10 Actualizar Camioneta - cabina inválida -> 400', async () => {
      const dto = {
        tipo: 'Camioneta',
        datos: {
          placa: 'ABC-1234',
          marca: 'Ford',
          modelo: 'Ranger',
          color: 'Blanco',
          anio: 2021,
          clasificacion: 'Diesel',
          cabina: 'doble',
          capacidadCarga: 800,
        },
      };
      const createRes = await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);
      const id = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/vehiculos/${id}`)
        .send({ cabina: 'invalida' })
        .expect(400);
    });

    it('CP6.11 Actualizar Camioneta - capacidad de carga inválida -> 400', async () => {
      const dto = {
        tipo: 'Camioneta',
        datos: {
          placa: 'ABC-1234',
          marca: 'Ford',
          modelo: 'Ranger',
          color: 'Blanco',
          anio: 2021,
          clasificacion: 'Diesel',
          cabina: 'doble',
          capacidadCarga: 800,
        },
      };
      const createRes = await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);
      const id = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/vehiculos/${id}`)
        .send({ capacidadCarga: 2000 })
        .expect(400);
    });
  });

  describe('Eliminar y Reactivar Vehículo (DELETE /api/vehiculos/:id, PATCH /api/vehiculos/:id/reactivar)', () => {
    it('CP7.1 Eliminar vehículo ok (Baja lógica) -> 200', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      const createRes = await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);
      const id = createRes.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/api/vehiculos/${id}`)
        .expect(200);

      expect(res.body.activo).toEqual(false);
    });

    it('CP7.2 Eliminar vehículo - Not Found -> 404', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      await request(app.getHttpServer())
        .delete(`/api/vehiculos/${id}`)
        .expect(404);
    });

    it('CP8.1 Reactivar vehículo ok -> 200', async () => {
      const dto = {
        tipo: 'Auto',
        datos: {
          placa: 'ABC-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      };
      const createRes = await request(app.getHttpServer()).post('/api/vehiculos').send(dto).expect(201);
      const id = createRes.body.id;

      await request(app.getHttpServer()).delete(`/api/vehiculos/${id}`).expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/api/vehiculos/${id}/reactivar`)
        .send({})
        .expect(200);

      expect(res.body.activo).toEqual(true);
    });

    it('CP8.2 Reactivar vehículo - Not Found -> 404', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      await request(app.getHttpServer())
        .patch(`/api/vehiculos/${id}/reactivar`)
        .send({})
        .expect(404);
    });
  });
});
