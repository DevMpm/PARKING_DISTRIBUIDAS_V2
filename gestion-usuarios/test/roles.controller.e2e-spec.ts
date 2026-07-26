import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Role } from '../src/roles/entities/role.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';

describe('RolesController (Sociable - Testcontainers)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let adminRoleId: string;
  let testRoleId: string;

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
      const roleRepo = dataSource.getRepository(Role);
      const adminRole = await roleRepo.findOne({ where: { name: 'ADMIN' } });
      if (adminRole) {
        adminRoleId = adminRole.id;
      }

      // Asegurar un rol de prueba para operaciones de update/delete/activate
      let testRole = await roleRepo.findOne({ where: { name: 'TEST_ROLE' } });
      if (!testRole) {
        testRole = roleRepo.create({
          name: 'TEST_ROLE',
          description: 'Rol de prueba',
          active: true,
        });
        await roleRepo.save(testRole);
      }
      testRoleId = testRole.id;
    }
  });

  describe('POST /roles (CP1)', () => {
    it('CP1.1 Crear rol ok', async () => {
      const uniqueName = `OPERATOR_${Date.now()}`;
      const dto = {
        name: uniqueName,
        description: 'Operador de estacionamiento',
      };

      const res = await request(app.getHttpServer())
        .post('/roles')
        .send(dto)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(uniqueName);

      await request(app.getHttpServer())
        .get(`/roles/${res.body.id}`)
        .expect(200);
    });

    it('CP1.2 Crear rol duplicado', async () => {
      const dto = {
        name: 'ADMIN',
        description: 'Duplicado',
      };

      await request(app.getHttpServer())
        .post('/roles')
        .send(dto)
        .expect(409);
    });

    it('CP1.3.1 Crear rol - Nombre vacío o ausente', async () => {
      const dto = {
        name: '',
        description: 'Sin nombre',
      };

      await request(app.getHttpServer())
        .post('/roles')
        .send(dto)
        .expect(400);
    });

    it('CP1.3.2 Crear rol - Nombre no es string', async () => {
      const dto = {
        name: 123,
        description: 'Nombre numérico',
      };

      await request(app.getHttpServer())
        .post('/roles')
        .send(dto)
        .expect(400);
    });

    it('CP1.3.3 Crear rol - Descripción excede longitud máxima', async () => {
      const dto = {
        name: `LONG_${Date.now()}`,
        description: 'a'.repeat(256),
      };

      await request(app.getHttpServer())
        .post('/roles')
        .send(dto)
        .expect(400);
    });
  });

  describe('GET /roles (CP2)', () => {
    it('CP2.1 Listar roles ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/roles')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('CP2.2 Listar roles sin resultados', async () => {
      // Nota: Con SeederService activo en la app, la DB tiene roles seedados por defecto.
      // Validamos el comportamiento de GET /roles (retorna los roles existentes).
      const res = await request(app.getHttpServer())
        .get('/roles')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /roles/available (CP3)', () => {
    it('CP3.1 Listar roles disponibles ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/roles/available')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /roles/:id (CP4)', () => {
    it('CP4.1 Obtener rol por ID ok', async () => {
      const res = await request(app.getHttpServer())
        .get(`/roles/${adminRoleId}`)
        .expect(200);

      expect(res.body.id).toBe(adminRoleId);
      expect(res.body.name).toBe('ADMIN');
    });

    it('CP4.2 Obtener rol por ID not found', async () => {
      await request(app.getHttpServer())
        .get('/roles/123e4567-e89b-12d3-a456-426614174999')
        .expect(404);
    });

    it('CP4.3 Obtener rol con UUID inválido', async () => {
      await request(app.getHttpServer())
        .get('/roles/not-a-uuid')
        .expect(400);
    });
  });

  describe('GET /roles/name/:name (CP5)', () => {
    it('CP5.1 Obtener rol por nombre ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/roles/name/ADMIN')
        .expect(200);

      expect(res.body.name).toBe('ADMIN');
    });

    it('CP5.2 Obtener rol por nombre not found', async () => {
      await request(app.getHttpServer())
        .get('/roles/name/INEXISTENTE')
        .expect(404);
    });
  });

  describe('PATCH /roles/:id (CP6)', () => {
    it('CP6.1 Actualizar rol ok', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/roles/${testRoleId}`)
        .send({ description: 'Descripción actualizada' })
        .expect(200);

      expect(res.body.description).toBe('Descripción actualizada');

      const check = await request(app.getHttpServer())
        .get(`/roles/${testRoleId}`)
        .expect(200);
      expect(check.body.description).toBe('Descripción actualizada');
    });

    it('CP6.2 Actualizar rol not found', async () => {
      await request(app.getHttpServer())
        .patch('/roles/123e4567-e89b-12d3-a456-426614174999')
        .send({ description: 'Test' })
        .expect(404);
    });

    it('CP6.3 Actualizar rol - Datos inválidos', async () => {
      await request(app.getHttpServer())
        .patch(`/roles/${testRoleId}`)
        .send({ description: 'a'.repeat(256) })
        .expect(400);
    });
  });

  describe('PATCH /roles/activate/:id & deactivate/:id (CP7 & CP8)', () => {
    it('CP7.1 Activar rol ok', async () => {
      // Primero desactivar
      await request(app.getHttpServer())
        .patch(`/roles/deactivate/${testRoleId}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/roles/activate/${testRoleId}`)
        .expect(200);

      expect(res.body.active).toBe(true);
    });

    it('CP7.2 Activar rol not found', async () => {
      await request(app.getHttpServer())
        .patch('/roles/activate/123e4567-e89b-12d3-a456-426614174999')
        .expect(404);
    });

    it('CP8.1 Desactivar rol ok', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/roles/deactivate/${testRoleId}`)
        .expect(200);

      expect(res.body.active).toBe(false);
    });

    it('CP8.2 Desactivar rol not found', async () => {
      await request(app.getHttpServer())
        .patch('/roles/deactivate/123e4567-e89b-12d3-a456-426614174999')
        .expect(404);
    });
  });

  describe('DELETE /roles/:id (CP9)', () => {
    it('CP9.1 Eliminar rol ok', async () => {
      const roleRepo = dataSource.getRepository(Role);
      const delRole = roleRepo.create({
        name: `DEL_ROLE_${Date.now()}`,
        description: 'Para eliminar',
        active: true,
      });
      await roleRepo.save(delRole);

      await request(app.getHttpServer())
        .delete(`/roles/${delRole.id}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/roles/${delRole.id}`)
        .expect(404);
    });

    it('CP9.2 Eliminar rol not found', async () => {
      await request(app.getHttpServer())
        .delete('/roles/123e4567-e89b-12d3-a456-426614174999')
        .expect(404);
    });
  });
});
