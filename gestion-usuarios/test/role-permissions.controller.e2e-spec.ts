import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Role } from '../src/roles/entities/role.entity';
import { Permission } from '../src/roles/entities/permission.entity';
import { RolePermission } from '../src/roles/entities/role-permission.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';

describe('RolePermissionsController (Sociable - Testcontainers)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let testRoleId: string;
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
      const roleRepo = dataSource.getRepository(Role);
      const permRepo = dataSource.getRepository(Permission);
      const rpRepo = dataSource.getRepository(RolePermission);

      let role = await roleRepo.findOne({ where: { name: 'ROLE_RP_TEST' } });
      if (!role) {
        role = roleRepo.create({ name: 'ROLE_RP_TEST', description: 'Test RP Role', active: true });
        await roleRepo.save(role);
      }
      testRoleId = role.id;

      let perm = await permRepo.findOne({ where: { name: 'PERM_RP_TEST' } });
      if (!perm) {
        perm = permRepo.create({ name: 'PERM_RP_TEST', description: 'Test RP Perm', service: 'test-service', active: true });
        await permRepo.save(perm);
      }
      testPermId = perm.id;

      // Limpiar relaciones previas para este rol y permiso específico
      await rpRepo.delete({ id_role: testRoleId, id_permission: testPermId });
    }
  });

  describe('POST /roles/:roleId/permissions/:permissionId (CP1)', () => {
    it('CP1.1 Asignar permiso a rol ok', async () => {
      const res = await request(app.getHttpServer())
        .post(`/roles/${testRoleId}/permissions/${testPermId}`)
        .expect(201);

      expect(res.body).toBeDefined();

      const check = await request(app.getHttpServer())
        .get(`/roles/${testRoleId}/permissions`)
        .expect(200);

      expect(Array.isArray(check.body)).toBe(true);
      expect(check.body.length).toBeGreaterThan(0);
    });

    it('CP1.2 Asignar permiso a rol duplicado (Ya asignado)', async () => {
      await request(app.getHttpServer())
        .post(`/roles/${testRoleId}/permissions/${testPermId}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/roles/${testRoleId}/permissions/${testPermId}`)
        .expect(409);
    });

    it('CP1.3.1 Asignar permiso - Rol not found', async () => {
      await request(app.getHttpServer())
        .post(`/roles/123e4567-e89b-12d3-a456-426614174999/permissions/${testPermId}`)
        .expect(404);
    });

    it('CP1.3.2 Asignar permiso - Permiso not found', async () => {
      await request(app.getHttpServer())
        .post(`/roles/${testRoleId}/permissions/123e4567-e89b-12d3-a456-426614174999`)
        .expect(404);
    });

    it('CP1.3.3 Asignar permiso - UUID inválido', async () => {
      await request(app.getHttpServer())
        .post(`/roles/invalid-uuid/permissions/${testPermId}`)
        .expect(400);
    });
  });

  describe('DELETE /roles/:roleId/permissions/:permissionId (CP2)', () => {
    it('CP2.1 Remover permiso de rol ok', async () => {
      await request(app.getHttpServer())
        .post(`/roles/${testRoleId}/permissions/${testPermId}`)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/roles/${testRoleId}/permissions/${testPermId}`)
        .expect(200);

      const check = await request(app.getHttpServer())
        .get(`/roles/${testRoleId}/permissions`)
        .expect(200);

      const found = check.body.find((p: any) => p.id === testPermId || p.id_permission === testPermId);
      expect(found).toBeUndefined();
    });

    it('CP2.2 Remover permiso de rol not found (No asignado)', async () => {
      await request(app.getHttpServer())
        .delete(`/roles/${testRoleId}/permissions/${testPermId}`)
        .expect(404);
    });

    it('CP2.3 Remover permiso - UUID inválido', async () => {
      await request(app.getHttpServer())
        .delete(`/roles/${testRoleId}/permissions/invalid-uuid`)
        .expect(400);
    });
  });

  describe('GET /roles/:roleId/permissions (CP3)', () => {
    it('CP3.1 Listar permisos de rol ok', async () => {
      await request(app.getHttpServer())
        .post(`/roles/${testRoleId}/permissions/${testPermId}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/roles/${testRoleId}/permissions`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('CP3.2 Listar permisos de rol sin resultados', async () => {
      await request(app.getHttpServer())
        .delete(`/roles/${testRoleId}/permissions/${testPermId}`)
        .catch(() => {});

      const res = await request(app.getHttpServer())
        .get(`/roles/${testRoleId}/permissions`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('CP3.3 Listar permisos de rol - Rol not found', async () => {
      await request(app.getHttpServer())
        .get('/roles/123e4567-e89b-12d3-a456-426614174999/permissions')
        .expect(404);
    });

    it('CP3.4 Listar permisos de rol - UUID inválido', async () => {
      await request(app.getHttpServer())
        .get('/roles/invalid-uuid/permissions')
        .expect(400);
    });
  });
});
