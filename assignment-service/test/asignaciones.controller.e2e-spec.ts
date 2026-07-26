import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { AsignacionVehiculo } from '../src/asignaciones/entities/asignacion-vehiculo.entity';
import { UsuariosClientService } from '../src/clientes/usuarios-client.service';
import { VehiculosClientService } from '../src/clientes/vehiculos-client.service';
import { EventPublisher } from '../src/audit/event-publisher';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';

describe('AsignacionesController (REST - Sociable Tests)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const TEST_USER_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const OTHER_USER_ID = '123e4567-e89b-12d3-a456-426614174009';
  const TEST_VEHICLE_ID = '550e8400-e29b-41d4-a716-446655440000';
  const OTHER_VEHICLE_ID = '550e8400-e29b-41d4-a716-446655440099';

  const mockUsuariosClientService = {
    existeUsuario: jest.fn().mockImplementation(async (userId) => {
      return userId === TEST_USER_ID || userId === OTHER_USER_ID;
    }),
    obtenerUsuario: jest.fn().mockImplementation(async (userId) => {
      if (userId === TEST_USER_ID || userId === OTHER_USER_ID) {
        return { id: userId, username: 'testuser' };
      }
      throw new Error('Usuario no encontrado');
    }),
  };

  const mockVehiculosClientService = {
    existeVehiculo: jest.fn().mockImplementation(async (vehicleId) => {
      return vehicleId === TEST_VEHICLE_ID || vehicleId === OTHER_VEHICLE_ID;
    }),
    obtenerVehiculo: jest.fn().mockImplementation(async (vehicleId) => {
      if (vehicleId === TEST_VEHICLE_ID || vehicleId === OTHER_VEHICLE_ID) {
        return {
          id: vehicleId,
          placa: vehicleId === TEST_VEHICLE_ID ? 'ABC-1234' : 'XYZ-5678',
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2022,
          tipo: 'Auto',
          clasificacion: 'Gasolina',
          activo: true,
        };
      }
      throw new Error('Vehículo no encontrado');
    }),
  };

  const mockEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  let currentMockUser: any = {
    userId: TEST_USER_ID,
    username: 'admin',
    roles: ['ADMIN'],
    permissions: [
      'ASIGNACIONES_CREATE',
      'ASIGNACIONES_READ',
      'ASIGNACIONES_UPDATE',
      'ASIGNACIONES_DELETE',
    ],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UsuariosClientService)
      .useValue(mockUsuariosClientService)
      .overrideProvider(VehiculosClientService)
      .useValue(mockVehiculosClientService)
      .overrideProvider(EventPublisher)
      .useValue(mockEventPublisher)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = req.headers['x-mock-user']
            ? JSON.parse(req.headers['x-mock-user'])
            : currentMockUser;
          return true;
        },
      })
      .overrideGuard(PermissionsGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    app = moduleFixture.createNestApplication();
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
    currentMockUser = {
      userId: TEST_USER_ID,
      username: 'admin',
      roles: ['ADMIN'],
      permissions: [
        'ASIGNACIONES_CREATE',
        'ASIGNACIONES_READ',
        'ASIGNACIONES_UPDATE',
        'ASIGNACIONES_DELETE',
      ],
    };

    if (dataSource) {
      const repo = dataSource.getRepository(AsignacionVehiculo);
      await repo.clear();
    }
  });

  describe('CP1: Crear Asignación (POST /asignaciones)', () => {
    it('CP1.1 Crear asignación ok', async () => {
      const dto = {
        userId: TEST_USER_ID,
        vehicleId: TEST_VEHICLE_ID,
        notas: 'Vehículo principal',
      };

      const res = await request(app.getHttpServer())
        .post('/asignaciones')
        .send(dto)
        .expect(201);

      expect(res.body).toMatchObject({
        userId: TEST_USER_ID,
        vehicleId: TEST_VEHICLE_ID,
        notas: 'Vehículo principal',
        activa: true,
      });
      expect(res.body).toHaveProperty('fechaAsignacion');
      expect(mockEventPublisher.publish).toHaveBeenCalled();

      // Buscar por ID compuesto para confirmar existencia
      const checkRes = await request(app.getHttpServer())
        .get(`/asignaciones/${TEST_USER_ID}/${TEST_VEHICLE_ID}`)
        .expect(200);
      expect(checkRes.body.vehicleId).toBe(TEST_VEHICLE_ID);
    });

    it('CP1.2 Crear asignación - Ya existe una asignación activa del vehículo con el mismo usuario', async () => {
      const repo = dataSource.getRepository(AsignacionVehiculo);
      await repo.save(
        repo.create({
          userId: TEST_USER_ID,
          vehicleId: TEST_VEHICLE_ID,
          activa: true,
        }),
      );

      const dto = {
        userId: TEST_USER_ID,
        vehicleId: TEST_VEHICLE_ID,
        notas: 'Duplicada',
      };

      await request(app.getHttpServer())
        .post('/asignaciones')
        .send(dto)
        .expect(409);
    });

    it('CP1.3 Crear asignación - Ya existe asignación activa con otro usuario', async () => {
      const repo = dataSource.getRepository(AsignacionVehiculo);
      await repo.save(
        repo.create({
          userId: OTHER_USER_ID,
          vehicleId: TEST_VEHICLE_ID,
          activa: true,
        }),
      );

      const dto = {
        userId: TEST_USER_ID,
        vehicleId: TEST_VEHICLE_ID,
        notas: 'Conflicto otro usuario',
      };

      await request(app.getHttpServer())
        .post('/asignaciones')
        .send(dto)
        .expect(409);
    });

    it('CP1.4 Crear asignación - Ya existe una asignación inactiva con el mismo usuario', async () => {
      const repo = dataSource.getRepository(AsignacionVehiculo);
      await repo.save(
        repo.create({
          userId: TEST_USER_ID,
          vehicleId: TEST_VEHICLE_ID,
          activa: false,
        }),
      );

      const dto = {
        userId: TEST_USER_ID,
        vehicleId: TEST_VEHICLE_ID,
        notas: 'Inactiva previa',
      };

      await request(app.getHttpServer())
        .post('/asignaciones')
        .send(dto)
        .expect(409);
    });

    it('CP1.5 Crear asignación - Usuario o vehículo no existe', async () => {
      const nonExistentUUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d999';

      const dto1 = {
        userId: nonExistentUUID,
        vehicleId: TEST_VEHICLE_ID,
      };

      await request(app.getHttpServer())
        .post('/asignaciones')
        .send(dto1)
        .expect(404);

      const dto2 = {
        userId: TEST_USER_ID,
        vehicleId: nonExistentUUID,
      };

      await request(app.getHttpServer())
        .post('/asignaciones')
        .send(dto2)
        .expect(404);
    });

    it('CP1.6 Crear asignación - userId inválido', async () => {
      const dto = {
        userId: 'invalid-uuid',
        vehicleId: TEST_VEHICLE_ID,
      };

      await request(app.getHttpServer())
        .post('/asignaciones')
        .send(dto)
        .expect(400);
    });

    it('CP1.7 Crear asignación - vehicleId inválido', async () => {
      const dto = {
        userId: TEST_USER_ID,
        vehicleId: 'invalid-uuid',
      };

      await request(app.getHttpServer())
        .post('/asignaciones')
        .send(dto)
        .expect(400);
    });

    it('CP1.8 Crear asignación - Notas muy largas (> 500 caracteres)', async () => {
      const dto = {
        userId: TEST_USER_ID,
        vehicleId: TEST_VEHICLE_ID,
        notas: 'A'.repeat(501),
      };

      await request(app.getHttpServer())
        .post('/asignaciones')
        .send(dto)
        .expect(400);
    });
  });

  describe('CP2: Obtener Asignaciones (Múltiples resultados)', () => {
    it('CP2.1 Obtener todas las asignaciones ok', async () => {
      const repo = dataSource.getRepository(AsignacionVehiculo);
      await repo.save([
        repo.create({ userId: TEST_USER_ID, vehicleId: TEST_VEHICLE_ID, activa: true }),
        repo.create({ userId: OTHER_USER_ID, vehicleId: OTHER_VEHICLE_ID, activa: true }),
      ]);

      const res = await request(app.getHttpServer())
        .get('/asignaciones')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('CP2.2 Obtener flota de vehículos por propietario ok', async () => {
      const repo = dataSource.getRepository(AsignacionVehiculo);
      await repo.save(
        repo.create({ userId: TEST_USER_ID, vehicleId: TEST_VEHICLE_ID, activa: true }),
      );

      const res = await request(app.getHttpServer())
        .get(`/asignaciones/propietario/${TEST_USER_ID}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].userId).toBe(TEST_USER_ID);
      expect(res.body[0].vehiculo).toBeDefined();
    });

    it('CP2.3 Obtener flota de vehículos por propietario sin resultados', async () => {
      const res = await request(app.getHttpServer())
        .get(`/asignaciones/propietario/${TEST_USER_ID}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('CP2.4 Obtener flota de vehículos por propietario - userId inválido', async () => {
      await request(app.getHttpServer())
        .get('/asignaciones/propietario/invalid-uuid')
        .expect(400);
    });
  });

  describe('CP3: Obtener Asignación (Único resultado)', () => {
    it('CP3.1 Buscar asignación activa por vehículo ok', async () => {
      const repo = dataSource.getRepository(AsignacionVehiculo);
      await repo.save(
        repo.create({ userId: TEST_USER_ID, vehicleId: TEST_VEHICLE_ID, activa: true }),
      );

      const res = await request(app.getHttpServer())
        .get(`/asignaciones/vehiculo/${TEST_VEHICLE_ID}/activo`)
        .expect(200);

      expect(res.body.vehicleId).toBe(TEST_VEHICLE_ID);
      expect(res.body.activa).toBe(true);
    });

    it('CP3.2 Buscar asignación activa por vehículo - No encontrada', async () => {
      await request(app.getHttpServer())
        .get(`/asignaciones/vehiculo/${TEST_VEHICLE_ID}/activo`)
        .expect(404);
    });

    it('CP3.3 Buscar asignación activa por vehículo - vehicleId inválido', async () => {
      await request(app.getHttpServer())
        .get('/asignaciones/vehiculo/invalid-uuid/activo')
        .expect(400);
    });

    it('CP3.4 Buscar asignación específica por clave compuesta ok', async () => {
      const repo = dataSource.getRepository(AsignacionVehiculo);
      await repo.save(
        repo.create({ userId: TEST_USER_ID, vehicleId: TEST_VEHICLE_ID, activa: true }),
      );

      const res = await request(app.getHttpServer())
        .get(`/asignaciones/${TEST_USER_ID}/${TEST_VEHICLE_ID}`)
        .expect(200);

      expect(res.body.userId).toBe(TEST_USER_ID);
      expect(res.body.vehicleId).toBe(TEST_VEHICLE_ID);
    });

    it('CP3.5 Buscar asignación específica por clave compuesta - No encontrada', async () => {
      await request(app.getHttpServer())
        .get(`/asignaciones/${TEST_USER_ID}/${TEST_VEHICLE_ID}`)
        .expect(404);
    });

    it('CP3.6 Buscar asignación específica por clave compuesta - Parámetros inválidos', async () => {
      await request(app.getHttpServer())
        .get(`/asignaciones/invalid-uuid/${TEST_VEHICLE_ID}`)
        .expect(400);
    });
  });

  describe('CP4: Actualizar Asignación (UPDATE, PATCH)', () => {
    it('CP4.1 Actualizar asignación ok', async () => {
      const repo = dataSource.getRepository(AsignacionVehiculo);
      await repo.save(
        repo.create({ userId: TEST_USER_ID, vehicleId: TEST_VEHICLE_ID, activa: true, notas: 'Original' }),
      );

      const updateDto = { notas: 'Actualizado' };

      const res = await request(app.getHttpServer())
        .patch(`/asignaciones/${TEST_USER_ID}/${TEST_VEHICLE_ID}`)
        .send(updateDto)
        .expect(200);

      expect(res.body.notas).toBe('Actualizado');
      expect(mockEventPublisher.publish).toHaveBeenCalled();

      // Confirmar cambio mediante búsqueda por ID
      const checkRes = await request(app.getHttpServer())
        .get(`/asignaciones/${TEST_USER_ID}/${TEST_VEHICLE_ID}`)
        .expect(200);
      expect(checkRes.body.notas).toBe('Actualizado');
    });

    it('CP4.2 Actualizar asignación - Not Found', async () => {
      const updateDto = { notas: 'Actualizado' };

      await request(app.getHttpServer())
        .patch(`/asignaciones/${TEST_USER_ID}/${TEST_VEHICLE_ID}`)
        .send(updateDto)
        .expect(404);
    });

    it('CP4.3 Actualizar asignación - Campo activa inválido (No booleano)', async () => {
      const repo = dataSource.getRepository(AsignacionVehiculo);
      await repo.save(
        repo.create({ userId: TEST_USER_ID, vehicleId: TEST_VEHICLE_ID, activa: true }),
      );

      const updateDto = { activa: 'no-es-booleano' };

      await request(app.getHttpServer())
        .patch(`/asignaciones/${TEST_USER_ID}/${TEST_VEHICLE_ID}`)
        .send(updateDto)
        .expect(400);
    });

    it('CP4.4 Actualizar asignación - Notas muy largas (> 500 caracteres)', async () => {
      const repo = dataSource.getRepository(AsignacionVehiculo);
      await repo.save(
        repo.create({ userId: TEST_USER_ID, vehicleId: TEST_VEHICLE_ID, activa: true }),
      );

      const updateDto = { notas: 'A'.repeat(501) };

      await request(app.getHttpServer())
        .patch(`/asignaciones/${TEST_USER_ID}/${TEST_VEHICLE_ID}`)
        .send(updateDto)
        .expect(400);
    });

    it('CP4.5 Actualizar asignación - Parámetros inválidos (UUID incorrecto)', async () => {
      const updateDto = { notas: 'Actualizado' };

      await request(app.getHttpServer())
        .patch(`/asignaciones/invalid-uuid/${TEST_VEHICLE_ID}`)
        .send(updateDto)
        .expect(400);
    });
  });

  describe('CP5: Eliminar Asignación (DELETE - Baja Lógica)', () => {
    it('CP5.1 Eliminar asignación ok (Baja lógica)', async () => {
      const repo = dataSource.getRepository(AsignacionVehiculo);
      await repo.save(
        repo.create({ userId: TEST_USER_ID, vehicleId: TEST_VEHICLE_ID, activa: true }),
      );

      await request(app.getHttpServer())
        .delete(`/asignaciones/${TEST_USER_ID}/${TEST_VEHICLE_ID}`)
        .expect(200);

      expect(mockEventPublisher.publish).toHaveBeenCalled();

      // Confirmar baja lógica (activa = false)
      const checkRes = await request(app.getHttpServer())
        .get(`/asignaciones/${TEST_USER_ID}/${TEST_VEHICLE_ID}`)
        .expect(200);
      expect(checkRes.body.activa).toBe(false);
    });

    it('CP5.2 Eliminar asignación - Not Found', async () => {
      await request(app.getHttpServer())
        .delete(`/asignaciones/${TEST_USER_ID}/${TEST_VEHICLE_ID}`)
        .expect(404);
    });

    it('CP5.3 Eliminar asignación - Conflicto (Ya estaba inactiva)', async () => {
      const repo = dataSource.getRepository(AsignacionVehiculo);
      await repo.save(
        repo.create({ userId: TEST_USER_ID, vehicleId: TEST_VEHICLE_ID, activa: false }),
      );

      await request(app.getHttpServer())
        .delete(`/asignaciones/${TEST_USER_ID}/${TEST_VEHICLE_ID}`)
        .expect(409);
    });

    it('CP5.4 Eliminar asignación - Parámetros inválidos (UUID incorrecto)', async () => {
      await request(app.getHttpServer())
        .delete(`/asignaciones/invalid-uuid/${TEST_VEHICLE_ID}`)
        .expect(400);
    });
  });
});
