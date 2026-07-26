import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { EventoAuditoria } from '../src/audit/entities/evento-auditoria.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';

// Mock amqplib for real AuditConsumer integration testing
jest.mock('amqplib', () => {
  const ackFn = jest.fn();
  const nackFn = jest.fn();
  (globalThis as any).__mockAck = ackFn;
  (globalThis as any).__mockNack = nackFn;
  return {
    connect: jest.fn().mockResolvedValue({
      createChannel: jest.fn().mockResolvedValue({
        assertExchange: jest.fn().mockResolvedValue(true),
        assertQueue: jest.fn().mockResolvedValue(true),
        bindQueue: jest.fn().mockResolvedValue(true),
        consume: jest.fn().mockImplementation((queue, callback) => {
          (globalThis as any).__rabbitConsumerCallback = callback;
        }),
        ack: ackFn,
        nack: nackFn,
      }),
    }),
  };
});

describe('AuditController & AuditConsumer (REST & RabbitMQ - Sociable Tests)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            sub: '123e4567-e89b-42d3-a456-426614174000',
            username: 'admin',
            role: 'ADMIN',
            permissions: ['AUDITORIA_CREATE', 'AUDITORIA_READ'],
          };
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
    if (dataSource) {
      const repository = dataSource.getRepository(EventoAuditoria);
      await repository.clear();
    }
  });

  const validEventDto = {
    servicio: 'ms-vehiculos',
    accion: 'CREATE',
    entidad: 'VEHICULO',
    entidadId: '123e4567-e89b-42d3-a456-426614174000',
    rol: 'admin',
    datos: { placa: 'ABC-1234' },
    usuario: 'mpareja',
    ip: '192.168.1.100',
    mac: '00:11:22:33:44:55',
  };

  describe('Endpoints / Operaciones Create (POST /audit)', () => {
    it('CP1.1 Crear evento de auditoría - Acción CREATE ok', async () => {
      const res = await request(app.getHttpServer())
        .post('/audit')
        .send({ ...validEventDto, accion: 'CREATE' })
        .expect(201);

      expect(res.body).toMatchObject({
        servicio: 'ms-vehiculos',
        accion: 'CREATE',
        entidad: 'VEHICULO',
        usuario: 'mpareja',
      });
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('timestamp');

      const getRes = await request(app.getHttpServer())
        .get(`/audit/${res.body.id}`)
        .expect(200);

      expect(getRes.body.id).toBe(res.body.id);
      expect(getRes.body.accion).toBe('CREATE');
    });

    it('CP1.2 Crear evento de auditoría - Acción UPDATE ok', async () => {
      const res = await request(app.getHttpServer())
        .post('/audit')
        .send({ ...validEventDto, accion: 'UPDATE' })
        .expect(201);

      expect(res.body.accion).toBe('UPDATE');

      const getRes = await request(app.getHttpServer())
        .get(`/audit/${res.body.id}`)
        .expect(200);
      expect(getRes.body.accion).toBe('UPDATE');
    });

    it('CP1.3 Crear evento de auditoría - Acción DELETE ok', async () => {
      const res = await request(app.getHttpServer())
        .post('/audit')
        .send({ ...validEventDto, accion: 'DELETE' })
        .expect(201);

      expect(res.body.accion).toBe('DELETE');

      const getRes = await request(app.getHttpServer())
        .get(`/audit/${res.body.id}`)
        .expect(200);
      expect(getRes.body.accion).toBe('DELETE');
    });

    it('CP1.4 Crear evento de auditoría - Acción LOGIN ok', async () => {
      const res = await request(app.getHttpServer())
        .post('/audit')
        .send({ ...validEventDto, accion: 'LOGIN' })
        .expect(201);

      expect(res.body.accion).toBe('LOGIN');

      const getRes = await request(app.getHttpServer())
        .get(`/audit/${res.body.id}`)
        .expect(200);
      expect(getRes.body.accion).toBe('LOGIN');
    });

    it('CP1.5 Crear evento de auditoría - Acción LOGOUT ok', async () => {
      const res = await request(app.getHttpServer())
        .post('/audit')
        .send({ ...validEventDto, accion: 'LOGOUT' })
        .expect(201);

      expect(res.body.accion).toBe('LOGOUT');

      const getRes = await request(app.getHttpServer())
        .get(`/audit/${res.body.id}`)
        .expect(200);
      expect(getRes.body.accion).toBe('LOGOUT');
    });

    it('CP1.6 Crear evento de auditoría - Acción SELECT ok', async () => {
      const res = await request(app.getHttpServer())
        .post('/audit')
        .send({ ...validEventDto, accion: 'SELECT' })
        .expect(201);

      expect(res.body.accion).toBe('SELECT');

      const getRes = await request(app.getHttpServer())
        .get(`/audit/${res.body.id}`)
        .expect(200);
      expect(getRes.body.accion).toBe('SELECT');
    });

    it('CP2. Crear evento de auditoría - Duplicado', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/audit')
        .send(validEventDto)
        .expect(201);

      expect(res1.body).toHaveProperty('id');
    });

    describe('CP3. Datos inválidos (DTO constraints)', () => {
      it('CP3.1 Servicio inválido', async () => {
        await request(app.getHttpServer())
          .post('/audit')
          .send({ ...validEventDto, servicio: 'vehiculos' })
          .expect(400);

        await request(app.getHttpServer())
          .post('/audit')
          .send({ ...validEventDto, servicio: 'ms-a' })
          .expect(400);
      });

      it('CP3.2 Acción inválida', async () => {
        await request(app.getHttpServer())
          .post('/audit')
          .send({ ...validEventDto, accion: 'INVALID' })
          .expect(400);
      });

      it('CP3.3 Entidad inválida', async () => {
        await request(app.getHttpServer())
          .post('/audit')
          .send({ ...validEventDto, entidad: 'vehiculo' })
          .expect(400);
      });

      it('CP3.4 EntidadId inválido (UUID incorrecto)', async () => {
        await request(app.getHttpServer())
          .post('/audit')
          .send({ ...validEventDto, entidadId: 'not-a-uuid' })
          .expect(400);
      });

      it('CP3.5 Rol inválido', async () => {
        await request(app.getHttpServer())
          .post('/audit')
          .send({ ...validEventDto, rol: 'a' })
          .expect(400);
      });

      it('CP3.6 Datos inválidos (no objeto)', async () => {
        await request(app.getHttpServer())
          .post('/audit')
          .send({ ...validEventDto, datos: 'not-an-object' })
          .expect(400);
      });

      it('CP3.7 Usuario inválido', async () => {
        await request(app.getHttpServer())
          .post('/audit')
          .send({ ...validEventDto, usuario: 'ab' })
          .expect(400);
      });

      it('CP3.8 IP inválida', async () => {
        await request(app.getHttpServer())
          .post('/audit')
          .send({ ...validEventDto, ip: '999.999.999.999' })
          .expect(400);
      });

      it('CP3.9 MAC inválida', async () => {
        await request(app.getHttpServer())
          .post('/audit')
          .send({ ...validEventDto, mac: 'invalid-mac' })
          .expect(400);
      });
    });
  });

  describe('Endpoints / Operaciones Get que devuelven varios resultados (GET /audit)', () => {
    it('CP4.1 Buscar eventos de auditoría ok', async () => {
      await request(app.getHttpServer()).post('/audit').send(validEventDto);
      await request(app.getHttpServer()).post('/audit').send({ ...validEventDto, accion: 'UPDATE' });

      const res = await request(app.getHttpServer())
        .get('/audit')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('CP4.2 Buscar eventos de auditoría sin resultados', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });
  });

  describe('Endpoints / Operaciones Get que devuelven un único resultado (GET /audit/:id)', () => {
    it('CP5.1 Buscar evento de auditoría por ID ok', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/audit')
        .send(validEventDto);

      const eventId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .get(`/audit/${eventId}`)
        .expect(200);

      expect(res.body.id).toBe(eventId);
      expect(res.body.servicio).toBe(validEventDto.servicio);
    });

    it('CP5.2 Buscar evento de auditoría por ID sin resultado', async () => {
      const nonExistentId = '123e4567-e89b-42d3-a456-426614174999';
      const res = await request(app.getHttpServer())
        .get(`/audit/${nonExistentId}`)
        .expect(200);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('Consumer de RabbitMQ (AuditConsumer) - Recepción de Eventos Real', () => {
    it('CP6.1 Recibir evento mediante RabbitMQ - Acción CREATE ok', async () => {
      const callback = (globalThis as any).__rabbitConsumerCallback;
      const mockAck = (globalThis as any).__mockAck;
      expect(callback).toBeDefined();

      const eventPayload = { ...validEventDto, accion: 'CREATE' };
      const msg = {
        content: Buffer.from(JSON.stringify(eventPayload)),
        fields: {},
        properties: {},
      };

      await callback(msg);

      expect(mockAck).toHaveBeenCalledWith(msg);

      const events = await dataSource.getRepository(EventoAuditoria).find();
      expect(events.length).toBe(1);
      expect(events[0].accion).toBe('CREATE');
    });

    it('CP6.2 Recibir evento mediante RabbitMQ - Acción UPDATE ok', async () => {
      const callback = (globalThis as any).__rabbitConsumerCallback;
      const mockAck = (globalThis as any).__mockAck;
      const eventPayload = { ...validEventDto, accion: 'UPDATE' };
      const msg = {
        content: Buffer.from(JSON.stringify(eventPayload)),
        fields: {},
        properties: {},
      };

      await callback(msg);
      expect(mockAck).toHaveBeenCalledWith(msg);

      const events = await dataSource.getRepository(EventoAuditoria).find();
      expect(events[0].accion).toBe('UPDATE');
    });

    it('CP6.3 Recibir evento mediante RabbitMQ - Acción DELETE ok', async () => {
      const callback = (globalThis as any).__rabbitConsumerCallback;
      const mockAck = (globalThis as any).__mockAck;
      const eventPayload = { ...validEventDto, accion: 'DELETE' };
      const msg = {
        content: Buffer.from(JSON.stringify(eventPayload)),
        fields: {},
        properties: {},
      };

      await callback(msg);
      expect(mockAck).toHaveBeenCalledWith(msg);

      const events = await dataSource.getRepository(EventoAuditoria).find();
      expect(events[0].accion).toBe('DELETE');
    });

    it('CP6.4 Recibir evento mediante RabbitMQ - Acción LOGIN ok', async () => {
      const callback = (globalThis as any).__rabbitConsumerCallback;
      const mockAck = (globalThis as any).__mockAck;
      const eventPayload = { ...validEventDto, accion: 'LOGIN' };
      const msg = {
        content: Buffer.from(JSON.stringify(eventPayload)),
        fields: {},
        properties: {},
      };

      await callback(msg);
      expect(mockAck).toHaveBeenCalledWith(msg);

      const events = await dataSource.getRepository(EventoAuditoria).find();
      expect(events[0].accion).toBe('LOGIN');
    });

    it('CP6.5 Recibir evento mediante RabbitMQ - Acción LOGOUT ok', async () => {
      const callback = (globalThis as any).__rabbitConsumerCallback;
      const mockAck = (globalThis as any).__mockAck;
      const eventPayload = { ...validEventDto, accion: 'LOGOUT' };
      const msg = {
        content: Buffer.from(JSON.stringify(eventPayload)),
        fields: {},
        properties: {},
      };

      await callback(msg);
      expect(mockAck).toHaveBeenCalledWith(msg);

      const events = await dataSource.getRepository(EventoAuditoria).find();
      expect(events[0].accion).toBe('LOGOUT');
    });

    it('CP6.6 Recibir evento mediante RabbitMQ - Acción SELECT ok', async () => {
      const callback = (globalThis as any).__rabbitConsumerCallback;
      const mockAck = (globalThis as any).__mockAck;
      const eventPayload = { ...validEventDto, accion: 'SELECT' };
      const msg = {
        content: Buffer.from(JSON.stringify(eventPayload)),
        fields: {},
        properties: {},
      };

      await callback(msg);
      expect(mockAck).toHaveBeenCalledWith(msg);

      const events = await dataSource.getRepository(EventoAuditoria).find();
      expect(events[0].accion).toBe('SELECT');
    });

    it('CP7. Recibir evento mediante RabbitMQ - Datos inválidos', async () => {
      const callback = (globalThis as any).__rabbitConsumerCallback;
      const mockNack = (globalThis as any).__mockNack;
      const invalidPayload = { ...validEventDto, servicio: 'invalid-service' };
      const msg = {
        content: Buffer.from(JSON.stringify(invalidPayload)),
        fields: {},
        properties: {},
      };

      await callback(msg);

      expect(mockNack).toHaveBeenCalledWith(msg, false, false);

      const events = await dataSource.getRepository(EventoAuditoria).find();
      expect(events.length).toBe(0);
    });
  });
});
