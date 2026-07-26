import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Persona } from '../src/personas/entities/persona.entity';
import { User } from '../src/users/entities/user.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import * as bcrypt from 'bcrypt';

describe('PersonasController (Sociable - Testcontainers)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const PERSONA_UUID_1 = '123e4567-e89b-12d3-a456-426614174000';
  const PERSONA_UUID_2 = '123e4567-e89b-12d3-a456-426614174002';

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
            : { userId: '123', username: 'admin', roles: ['ADMIN'], permissions: ['USUARIOS_READ', 'USUARIOS_UPDATE', 'USUARIOS_DELETE'] };
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
    if (dataSource) {
      try {
        await dataSource.getRepository(User).clear();
        await dataSource.getRepository(Persona).clear();
      } catch {}

      const personaRepo = dataSource.getRepository(Persona);
      const persona = personaRepo.create({
        id: PERSONA_UUID_1,
        dni: '1720000015',
        email: 'juan.perez@example.com',
        first_name: 'Juan',
        last_name: 'Pérez',
        nationality: 'Ecuatoriana',
        phone: '+593991234567',
        activo: true,
      });
      await personaRepo.save(persona);

      const duplicatePersona = personaRepo.create({
        id: PERSONA_UUID_2,
        dni: '1720000007',
        email: 'other@example.com',
        first_name: 'Otro',
        last_name: 'Persona',
        nationality: 'Ecuatoriana',
        phone: '+593991234560',
        activo: true,
      });
      await personaRepo.save(duplicatePersona);
    }
  });

  describe('POST /personas (CP1)', () => {
    it('CP1.1 Crear persona ok', async () => {
      const validDto = {
        address: 'Av. 10 de Agosto',
        dni: '1720000023',
        email: 'juan.nuevo@example.com',
        firstName: 'Juan',
        lastName: 'Pérez',
        nationality: 'Ecuatoriana',
        phone: '+593991234568',
      };

      const res = await request(app.getHttpServer())
        .post('/personas')
        .send(validDto)
        .expect(201);

      expect(res.body).toHaveProperty('persona');
      expect(res.body.persona.dni).toBe(validDto.dni);
    });

    it('CP1.2 Crear persona duplicada (Conflict)', async () => {
      const duplicateDto = {
        address: 'Av. 10 de Agosto',
        dni: '1720000007',
        email: 'juan.perez@example.com',
        firstName: 'Juan',
        lastName: 'Pérez',
        nationality: 'Ecuatoriana',
        phone: '+593991234567',
      };

      await request(app.getHttpServer())
        .post('/personas')
        .send(duplicateDto)
        .expect(409);
    });

    it('CP1.3.1 DNI vacío o ausente -> 400', async () => {
      await request(app.getHttpServer())
        .post('/personas')
        .send({ email: 'test@example.com', firstName: 'Juan', lastName: 'Pérez', nationality: 'Ecuatoriana', phone: '+593991234567' })
        .expect(400);
    });

    it('CP1.3.2 DNI longitud menor (<10) -> 400', async () => {
      await request(app.getHttpServer())
        .post('/personas')
        .send({ dni: '171234567', email: 'test@example.com', firstName: 'Juan', lastName: 'Pérez', nationality: 'Ecuatoriana', phone: '+593991234567' })
        .expect(400);
    });

    it('CP1.3.6 Email vacío o ausente -> 400', async () => {
      await request(app.getHttpServer())
        .post('/personas')
        .send({ dni: '1720000015', firstName: 'Juan', lastName: 'Pérez', nationality: 'Ecuatoriana', phone: '+593991234567' })
        .expect(400);
    });

    it('CP1.3.7 Email formato inválido -> 400', async () => {
      await request(app.getHttpServer())
        .post('/personas')
        .send({ dni: '1720000015', email: 'juan.perez', firstName: 'Juan', lastName: 'Pérez', nationality: 'Ecuatoriana', phone: '+593991234567' })
        .expect(400);
    });

    it('CP1.3.9 Primer nombre vacío -> 400', async () => {
      await request(app.getHttpServer())
        .post('/personas')
        .send({ dni: '1720000015', email: 'juan@example.com', firstName: '', lastName: 'Pérez', nationality: 'Ecuatoriana', phone: '+593991234567' })
        .expect(400);
    });

    it('CP1.3.10 Primer nombre muy corto (<2) -> 400', async () => {
      await request(app.getHttpServer())
        .post('/personas')
        .send({ dni: '1720000015', email: 'juan@example.com', firstName: 'J', lastName: 'Pérez', nationality: 'Ecuatoriana', phone: '+593991234567' })
        .expect(400);
    });

    it('CP1.3.14 Apellido vacío -> 400', async () => {
      await request(app.getHttpServer())
        .post('/personas')
        .send({ dni: '1720000015', email: 'juan@example.com', firstName: 'Juan', lastName: '', nationality: 'Ecuatoriana', phone: '+593991234567' })
        .expect(400);
    });

    it('CP1.3.19 Nacionalidad vacía -> 400', async () => {
      await request(app.getHttpServer())
        .post('/personas')
        .send({ dni: '1720000015', email: 'juan@example.com', firstName: 'Juan', lastName: 'Pérez', nationality: '', phone: '+593991234567' })
        .expect(400);
    });

    it('CP1.3.23 Teléfono vacío -> 400', async () => {
      await request(app.getHttpServer())
        .post('/personas')
        .send({ dni: '1720000015', email: 'juan@example.com', firstName: 'Juan', lastName: 'Pérez', nationality: 'Ecuatoriana', phone: '' })
        .expect(400);
    });
  });

  describe('GET /personas (CP2)', () => {
    it('CP2.1 Listar personas ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/personas')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /personas/:id (CP3)', () => {
    it('CP3.1 Obtener persona por ID ok', async () => {
      const res = await request(app.getHttpServer())
        .get(`/personas/${PERSONA_UUID_1}`)
        .expect(200);

      expect(res.body.id).toBe(PERSONA_UUID_1);
    });

    it('CP3.2 Obtener persona por ID not found', async () => {
      await request(app.getHttpServer())
        .get('/personas/f47ac10b-58cc-4372-a567-0e02b2c3d479')
        .expect(404);
    });
  });

  describe('GET /personas/exists/:id (CP4)', () => {
    it('CP4.1 Verificar si persona existe (Existe)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/personas/exists/${PERSONA_UUID_1}`)
        .expect(200);

      expect(res.body).toEqual({ exists: true });
    });

    it('CP4.2 Verificar si persona existe (No existe)', async () => {
      const res = await request(app.getHttpServer())
        .get('/personas/exists/f47ac10b-58cc-4372-a567-0e02b2c3d479')
        .expect(200);

      expect(res.body).toEqual({ exists: false });
    });
  });

  describe('GET /personas/dni/:dni (CP5)', () => {
    it('CP5.1 Obtener persona por DNI ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/personas/dni/1720000015')
        .expect(200);

      expect(res.body.dni).toBe('1720000015');
    });

    it('CP5.2 Obtener persona por DNI not found', async () => {
      await request(app.getHttpServer())
        .get('/personas/dni/9999999999')
        .expect(404);
    });
  });

  describe('PATCH /personas/:id (CP6)', () => {
    it('CP6.1 Actualizar persona ok', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/personas/${PERSONA_UUID_1}`)
        .send({ email: 'juan.updated@example.com' })
        .expect(200);

      expect(res.body.email).toBe('juan.updated@example.com');
    });

    it('CP6.2 Actualizar persona not found', async () => {
      await request(app.getHttpServer())
        .patch('/personas/f47ac10b-58cc-4372-a567-0e02b2c3d479')
        .send({ email: 'test@example.com' })
        .expect(404);
    });

    it('CP6.3.1 Actualizar persona - Email inválido', async () => {
      await request(app.getHttpServer())
        .patch(`/personas/${PERSONA_UUID_1}`)
        .send({ email: 'invalid-email' })
        .expect(400);
    });
  });

  describe('Activar y Desactivar Personas (CP7 & CP8)', () => {
    it('CP7.1 Activar persona ok', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/personas/activate/${PERSONA_UUID_1}`)
        .expect(200);

      expect(res.body.activo).toBe(true);
    });

    it('CP7.2 Activar persona not found', async () => {
      await request(app.getHttpServer())
        .patch('/personas/activate/f47ac10b-58cc-4372-a567-0e02b2c3d479')
        .expect(404);
    });

    it('CP8.1 Desactivar persona ok', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/personas/deactivate/${PERSONA_UUID_1}`)
        .expect(200);

      expect(res.body.activo).toBe(false);
    });

    it('CP8.2 Desactivar persona not found', async () => {
      await request(app.getHttpServer())
        .patch('/personas/deactivate/f47ac10b-58cc-4372-a567-0e02b2c3d479')
        .expect(404);
    });
  });
});
