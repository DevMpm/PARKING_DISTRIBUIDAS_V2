import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { Persona } from '../src/personas/entities/persona.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import * as bcrypt from 'bcrypt';

describe('UsersController (Sociable - Testcontainers)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174001';
  const TEST_PERSONA_ID = '123e4567-e89b-12d3-a456-426614174000';
  const OTHER_USER_ID = '123e4567-e89b-12d3-a456-426614174009';

  let currentMockUser: any = {
    userId: TEST_USER_ID,
    username: 'jperez',
    roles: ['ADMIN'],
    permissions: ['USUARIOS_READ', 'USUARIOS_UPDATE', 'USUARIOS_DELETE'],
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
      userId: TEST_USER_ID,
      username: 'jperez',
      roles: ['ADMIN'],
      permissions: ['USUARIOS_READ', 'USUARIOS_UPDATE', 'USUARIOS_DELETE'],
    };

    if (dataSource) {
      try {
        await dataSource.getRepository(User).clear();
        await dataSource.getRepository(Persona).clear();
      } catch {}

      const personaRepo = dataSource.getRepository(Persona);
      const userRepo = dataSource.getRepository(User);

      const persona = personaRepo.create({
        id: TEST_PERSONA_ID,
        dni: '1720000015',
        email: 'juan.perez@example.com',
        first_name: 'Juan',
        last_name: 'Pérez',
        nationality: 'Ecuatoriana',
        phone: '+593991234567',
        activo: true,
      });
      await personaRepo.save(persona);

      const passwordHash = await bcrypt.hash('Password123', 10);
      const user = userRepo.create({
        id: TEST_USER_ID,
        id_person: persona.id,
        username: 'jperez',
        password_hash: passwordHash,
        active: true,
      });
      await userRepo.save(user);
    }
  });

  describe('GET /users (CP9)', () => {
    it('CP9.1 Listar usuarios ok (Admin/Root)', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('CP9.2 Listar usuarios sin permisos (Forbidden / Standard user)', async () => {
      currentMockUser = {
        userId: OTHER_USER_ID,
        username: 'standarduser',
        roles: ['USER'],
        permissions: ['USUARIOS_READ'],
      };

      await request(app.getHttpServer())
        .get('/users')
        .set('x-mock-user', JSON.stringify(currentMockUser))
        .expect(403);
    });
  });

  describe('GET /users/:id (CP10)', () => {
    it('CP10.1 Obtener usuario por ID ok', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${TEST_USER_ID}`)
        .expect(200);

      expect(res.body.id).toBe(TEST_USER_ID);
    });

    it('CP10.2 Obtener usuario por ID sin permisos (Forbidden - otro usuario)', async () => {
      currentMockUser = {
        userId: OTHER_USER_ID,
        username: 'otheruser',
        roles: ['USER'],
        permissions: ['USUARIOS_READ'],
      };

      await request(app.getHttpServer())
        .get(`/users/${TEST_USER_ID}`)
        .set('x-mock-user', JSON.stringify(currentMockUser))
        .expect(403);
    });

    it('CP10.3 Obtener usuario por ID not found', async () => {
      await request(app.getHttpServer())
        .get('/users/f47ac10b-58cc-4372-a567-0e02b2c3d479')
        .expect(404);
    });
  });

  describe('GET /users/username/:username (CP11)', () => {
    it('CP11.1 Obtener usuario por username ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/username/jperez')
        .expect(200);

      expect(res.body.username).toBe('jperez');
    });

    it('CP11.2 Obtener usuario por username sin permisos (Forbidden)', async () => {
      currentMockUser = {
        userId: OTHER_USER_ID,
        username: 'otheruser',
        roles: ['USER'],
        permissions: ['USUARIOS_READ'],
      };

      await request(app.getHttpServer())
        .get('/users/username/jperez')
        .set('x-mock-user', JSON.stringify(currentMockUser))
        .expect(403);
    });

    it('CP11.3 Obtener usuario por username not found', async () => {
      await request(app.getHttpServer())
        .get('/users/username/nonexistent')
        .expect(404);
    });
  });

  describe('PATCH /users/:id (CP12)', () => {
    it('CP12.1 Actualizar usuario ok', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/${TEST_USER_ID}`)
        .send({ username: 'jperezupdate', password: 'Password123' })
        .expect(200);

      expect(res.body.username).toBe('jperezupdate');
    });

    it('CP12.2 Actualizar usuario sin permisos (Forbidden)', async () => {
      currentMockUser = {
        userId: OTHER_USER_ID,
        username: 'otheruser',
        roles: ['USER'],
        permissions: ['USUARIOS_UPDATE'],
      };

      await request(app.getHttpServer())
        .patch(`/users/${TEST_USER_ID}`)
        .set('x-mock-user', JSON.stringify(currentMockUser))
        .send({ username: 'hacked' })
        .expect(403);
    });

    it('CP12.3 Actualizar usuario not found', async () => {
      await request(app.getHttpServer())
        .patch('/users/f47ac10b-58cc-4372-a567-0e02b2c3d479')
        .send({ username: 'test' })
        .expect(404);
    });

    it('CP12.4.2 Actualizar usuario - Password muy corta (<8)', async () => {
      await request(app.getHttpServer())
        .patch(`/users/${TEST_USER_ID}`)
        .send({ password: '123' })
        .expect(400);
    });
  });

  describe('Activar y Desactivar Usuarios (CP13 & CP14)', () => {
    it('CP13.1 Activar usuario ok', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/activate/${TEST_USER_ID}`)
        .expect(200);

      expect(res.body.active).toBe(true);
    });

    it('CP13.2 Activar usuario not found', async () => {
      await request(app.getHttpServer())
        .patch('/users/activate/f47ac10b-58cc-4372-a567-0e02b2c3d479')
        .expect(404);
    });

    it('CP14.1 Desactivar usuario ok', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/deactivate/${TEST_USER_ID}`)
        .expect(200);

      expect(res.body.active).toBe(false);
    });

    it('CP14.2 Desactivar usuario not found', async () => {
      await request(app.getHttpServer())
        .patch('/users/deactivate/f47ac10b-58cc-4372-a567-0e02b2c3d479')
        .expect(404);
    });
  });
});
