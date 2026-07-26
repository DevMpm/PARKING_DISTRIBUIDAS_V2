import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { Persona } from '../src/personas/entities/persona.entity';
import { Role } from '../src/roles/entities/role.entity';
import { UserRole } from '../src/roleusers/entities/roleuser.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import * as bcrypt from 'bcrypt';

describe('RoleusersController (Sociable - Testcontainers)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let testUserId: string;
  let testRoleId: string;

  let currentMockUser: any = {
    userId: '123e4567-e89b-12d3-a456-426614174001',
    username: 'admin',
    roles: ['ADMIN'],
    permissions: [
      'ROLEUSERS_CREATE',
      'ROLEUSERS_READ',
      'ROLEUSERS_UPDATE',
      'ROLEUSERS_DELETE',
    ],
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
      permissions: [
        'ROLEUSERS_CREATE',
        'ROLEUSERS_READ',
        'ROLEUSERS_UPDATE',
        'ROLEUSERS_DELETE',
      ],
    };

    if (dataSource) {
      const personaRepo = dataSource.getRepository(Persona);
      const userRepo = dataSource.getRepository(User);
      const roleRepo = dataSource.getRepository(Role);
      const urRepo = dataSource.getRepository(UserRole);

      let persona = await personaRepo.findOne({ where: { dni: '1720000099' } });
      if (!persona) {
        persona = personaRepo.create({
          dni: '1720000099',
          email: 'user.test99@example.com',
          first_name: 'Test',
          last_name: 'User',
          nationality: 'Ecuatoriana',
          phone: '+593991234599',
          activo: true,
        });
        await personaRepo.save(persona);
      }

      let user = await userRepo.findOne({ where: { username: 'testuser99' } });
      if (!user) {
        const passwordHash = await bcrypt.hash('Password123', 10);
        user = userRepo.create({
          id_person: persona.id,
          username: 'testuser99',
          password_hash: passwordHash,
          active: true,
        });
        await userRepo.save(user);
      }
      testUserId = user.id;

      let role = await roleRepo.findOne({ where: { name: 'RECAUDADOR' } });
      if (!role) {
        role = roleRepo.create({
          name: 'RECAUDADOR',
          description: 'Recaudador role',
          active: true,
        });
        await roleRepo.save(role);
      }
      testRoleId = role.id;

      await urRepo.delete({ id_user: testUserId, id_role: testRoleId });
    }
  });

  describe('POST /roleusers (CP1)', () => {
    it('CP1.1 Asignar rol a usuario ok', async () => {
      const dto = {
        id_user: testUserId,
        role_name: 'RECAUDADOR',
      };

      const res = await request(app.getHttpServer())
        .post('/roleusers')
        .send(dto)
        .expect(201);

      expect(res.body).toBeDefined();

      await request(app.getHttpServer())
        .get(`/roleusers/${testUserId}/${testRoleId}`)
        .expect(200);
    });

    it('CP1.2 Asignar rol a usuario duplicado', async () => {
      const dto = {
        id_user: testUserId,
        role_name: 'RECAUDADOR',
      };

      await request(app.getHttpServer())
        .post('/roleusers')
        .send(dto)
        .expect(201);

      await request(app.getHttpServer())
        .post('/roleusers')
        .send(dto)
        .expect(409);
    });

    it('CP1.3.1 Asignar rol - id_user vacío', async () => {
      const dto = {
        id_user: '',
        role_name: 'RECAUDADOR',
      };

      await request(app.getHttpServer())
        .post('/roleusers')
        .send(dto)
        .expect(400);
    });

    it('CP1.3.2 Asignar rol - id_user no es UUID v4', async () => {
      const dto = {
        id_user: 'not-a-uuid',
        role_name: 'RECAUDADOR',
      };

      await request(app.getHttpServer())
        .post('/roleusers')
        .send(dto)
        .expect(400);
    });

    it('CP1.3.3 Asignar rol - role_name vacío', async () => {
      const dto = {
        id_user: testUserId,
        role_name: '',
      };

      await request(app.getHttpServer())
        .post('/roleusers')
        .send(dto)
        .expect(400);
    });

    it('CP1.3.4 Asignar rol - role_name no es string', async () => {
      const dto = {
        id_user: testUserId,
        role_name: 123,
      };

      await request(app.getHttpServer())
        .post('/roleusers')
        .send(dto)
        .expect(400);
    });
  });

  describe('GET /roleusers (CP2)', () => {
    it('CP2.1 Listar asignaciones ok', async () => {
      await request(app.getHttpServer())
        .post('/roleusers')
        .send({ id_user: testUserId, role_name: 'RECAUDADOR' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/roleusers')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('CP2.2 Listar asignaciones sin resultados', async () => {
      const urRepo = dataSource.getRepository(UserRole);
      await urRepo.delete({ id_user: testUserId, id_role: testRoleId });

      const res = await request(app.getHttpServer())
        .get('/roleusers')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /roleusers/user/:id_user (CP3)', () => {
    it('CP3.1 Obtener roles por usuario ok', async () => {
      await request(app.getHttpServer())
        .post('/roleusers')
        .send({ id_user: testUserId, role_name: 'RECAUDADOR' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/roleusers/user/${testUserId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('CP3.2 Obtener roles por usuario sin resultados', async () => {
      const res = await request(app.getHttpServer())
        .get('/roleusers/user/123e4567-e89b-12d3-a456-426614174999')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('CP3.3 Obtener roles por usuario - UUID inválido', async () => {
      await request(app.getHttpServer())
        .get('/roleusers/user/invalid-uuid')
        .expect(400);
    });
  });

  describe('GET /roleusers/role/:role_name (CP4)', () => {
    it('CP4.1 Obtener usuarios por rol ok', async () => {
      await request(app.getHttpServer())
        .post('/roleusers')
        .send({ id_user: testUserId, role_name: 'RECAUDADOR' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/roleusers/role/RECAUDADOR')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('CP4.2 Obtener usuarios por rol not found', async () => {
      await request(app.getHttpServer())
        .get('/roleusers/role/INEXISTENTE')
        .expect(404);
    });
  });

  describe('GET /roleusers/:id_user/:id_role (CP5)', () => {
    it('CP5.1 Obtener asignación específica ok', async () => {
      await request(app.getHttpServer())
        .post('/roleusers')
        .send({ id_user: testUserId, role_name: 'RECAUDADOR' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/roleusers/${testUserId}/${testRoleId}`)
        .expect(200);

      expect(res.body.id_user).toBe(testUserId);
      expect(res.body.id_role).toBe(testRoleId);
    });

    it('CP5.2 Obtener asignación específica not found', async () => {
      const urRepo = dataSource.getRepository(UserRole);
      await urRepo.delete({ id_user: testUserId, id_role: testRoleId });

      await request(app.getHttpServer())
        .get(`/roleusers/${testUserId}/${testRoleId}`)
        .expect(404);
    });

    it('CP5.3 Obtener asignación - UUID inválido', async () => {
      await request(app.getHttpServer())
        .get(`/roleusers/invalid-uuid/${testRoleId}`)
        .expect(400);
    });
  });

  describe('PATCH /roleusers/activate & deactivate (CP6 & CP7)', () => {
    it('CP7.1 Desactivar asignación ok', async () => {
      await request(app.getHttpServer())
        .post('/roleusers')
        .send({ id_user: testUserId, role_name: 'RECAUDADOR' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/roleusers/deactivate/${testUserId}/${testRoleId}`)
        .expect(200);

      expect(res.body.active).toBe(false);
    });

    it('CP6.1 Activar asignación ok', async () => {
      await request(app.getHttpServer())
        .post('/roleusers')
        .send({ id_user: testUserId, role_name: 'RECAUDADOR' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/roleusers/deactivate/${testUserId}/${testRoleId}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/roleusers/activate/${testUserId}/${testRoleId}`)
        .expect(200);

      expect(res.body.active).toBe(true);
    });

    it('CP6.2 Activar asignación not found', async () => {
      await request(app.getHttpServer())
        .patch(`/roleusers/activate/123e4567-e89b-12d3-a456-426614174999/${testRoleId}`)
        .expect(404);
    });
  });

  describe('DELETE /roleusers/:id_user/:id_role (CP8)', () => {
    it('CP8.1 Eliminar asignación ok', async () => {
      await request(app.getHttpServer())
        .post('/roleusers')
        .send({ id_user: testUserId, role_name: 'RECAUDADOR' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/roleusers/${testUserId}/${testRoleId}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/roleusers/${testUserId}/${testRoleId}`)
        .expect(404);
    });

    it('CP8.2 Eliminar asignación not found', async () => {
      await request(app.getHttpServer())
        .delete(`/roleusers/123e4567-e89b-12d3-a456-426614174999/${testRoleId}`)
        .expect(404);
    });
  });
});
