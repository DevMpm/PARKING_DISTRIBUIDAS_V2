import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Permission } from '../src/roles/entities/permission.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';

describe('PermissionsController (Sociable - Testcontainers)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let testPermId: string;

  let currentMockUser: any = {
    userId: '123e4567-e89b-12d3-a456-426614174001',
    username: 'admin',
    roles: ['ADMIN'],
    permissions: ['ROLES_CREATE', 'ROLES_READ', 'ROLES_UPDATE', 'ROLES_DELETE'],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    currentMockUser = {
      userId: '123e4567-e89b-12d3-a456-426614174001',
      username: 'admin',
      roles: ['ADMIN'],
      permissions: ['ROLES_CREATE', 'ROLES_READ', 'ROLES_UPDATE', 'ROLES_DELETE'],
    };

    if (dataSource) {
      const permRepo = dataSource.getRepository(Permission);
      let perm = await permRepo.findOne({ where: { name: 'TEST_PERM_EDIT' } });
      if (!perm) {
        perm = permRepo.create({
          name: 'TEST_PERM_EDIT',
          description: 'Permiso editable de prueba',
          service: 'test-service',
          active: true,
        });
        await permRepo.save(perm);
      }
      testPermId = perm.id;
    }
  });

  describe('POST /permissions (CP1)', () => {
    it('CP1.1 Crear permiso ok', async () => {
      const uniquePerm = `ZONAS_CUSTOM_${Date.now()}`;
      const dto = {
        name: uniquePerm,
        description: 'Permite crear zonas custom',
        service: 'zonas-service',
      };

      const res = await request(app.getHttpServer())
        .post('/permissions')
        .send(dto)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(uniquePerm);

      await request(app.getHttpServer())
        .get(`/permissions/${res.body.id}`)
        .expect(200);
    });

    it('CP1.2 Crear permiso duplicado', async () => {
      const dto = {
        name: 'ZONAS_READ',
        description: 'Duplicado',
      };

      await request(app.getHttpServer())
        .post('/permissions')
        .send(dto)
        .expect(409);
    });

    it('CP1.3.1 Crear permiso - Nombre vacío', async () => {
      const dto = {
        name: '',
        description: 'Vacío',
      };

      await request(app.getHttpServer())
        .post('/permissions')
        .send(dto)
        .expect(400);
    });

    it('CP1.3.2 Crear permiso - Nombre excede 100 caracteres', async () => {
      const dto = {
        name: 'A'.repeat(101),
        description: 'Largo',
      };

      await request(app.getHttpServer())
        .post('/permissions')
        .send(dto)
        .expect(400);
    });

    it('CP1.3.3 Crear permiso - Service excede 100 caracteres', async () => {
      const dto = {
        name: `VALID_${Date.now()}`,
        service: 'A'.repeat(101),
      };

      await request(app.getHttpServer())
        .post('/permissions')
        .send(dto)
        .expect(400);
    });
  });

  describe('GET /permissions (CP2)', () => {
    it('CP2.1 Listar permisos ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/permissions')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('CP2.2 Listar permisos sin resultados', async () => {
      const res = await request(app.getHttpServer())
        .get('/permissions')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /permissions/:id (CP3)', () => {
    it('CP3.1 Obtener permiso por ID ok', async () => {
      const res = await request(app.getHttpServer())
        .get(`/permissions/${testPermId}`)
        .expect(200);

      expect(res.body.id).toBe(testPermId);
      expect(res.body.name).toBe('TEST_PERM_EDIT');
    });

    it('CP3.2 Obtener permiso por ID not found', async () => {
      await request(app.getHttpServer())
        .get('/permissions/123e4567-e89b-12d3-a456-426614174999')
        .expect(404);
    });

    it('CP3.3 Obtener permiso con UUID inválido', async () => {
      await request(app.getHttpServer())
        .get('/permissions/not-a-uuid')
        .expect(400);
    });
  });

  describe('PATCH /permissions/:id (CP4)', () => {
    it('CP4.1 Actualizar permiso ok', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/permissions/${testPermId}`)
        .send({ description: 'Descripción modificada' })
        .expect(200);

      expect(res.body.description).toBe('Descripción modificada');
    });

    it('CP4.2 Actualizar permiso not found', async () => {
      await request(app.getHttpServer())
        .patch('/permissions/123e4567-e89b-12d3-a456-426614174999')
        .send({ description: 'Test' })
        .expect(404);
    });

    it('CP4.3 Actualizar permiso - Datos inválidos', async () => {
      await request(app.getHttpServer())
        .patch(`/permissions/${testPermId}`)
        .send({ name: 'A'.repeat(101) })
        .expect(400);
    });
  });

  describe('PATCH /permissions/:id/activate & deactivate (CP5 & CP6)', () => {
    it('CP5.1 Activar permiso ok', async () => {
      await request(app.getHttpServer())
        .patch(`/permissions/${testPermId}/deactivate`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/permissions/${testPermId}/activate`)
        .expect(200);

      expect(res.body.active).toBe(true);
    });

    it('CP5.2 Activar permiso not found', async () => {
      await request(app.getHttpServer())
        .patch('/permissions/123e4567-e89b-12d3-a456-426614174999/activate')
        .expect(404);
    });

    it('CP6.1 Desactivar permiso ok', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/permissions/${testPermId}/deactivate`)
        .expect(200);

      expect(res.body.active).toBe(false);
    });

    it('CP6.2 Desactivar permiso not found', async () => {
      await request(app.getHttpServer())
        .patch('/permissions/123e4567-e89b-12d3-a456-426614174999/deactivate')
        .expect(404);
    });
  });
});
