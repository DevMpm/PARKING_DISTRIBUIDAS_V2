import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

export default async function globalSetup(): Promise<void> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  )
    .withDatabase('gestion_usuarios_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  process.env.TEST_DB_HOST = container.getHost();
  process.env.TEST_DB_PORT = String(container.getMappedPort(5432));
  process.env.TEST_DB_USER = container.getUsername();
  process.env.TEST_DB_PASSWORD = container.getPassword();
  process.env.TEST_DB_NAME = container.getDatabase();

  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getMappedPort(5432));
  process.env.DB_USUARIO = container.getUsername();
  process.env.DB_CONTRASENA = container.getPassword();
  process.env.DB_NOMBRE = container.getDatabase();
  process.env.RABBITMQ_HOST = 'localhost';
  process.env.RABBITMQ_PORT = '5672';
  process.env.RABBITMQ_USER = 'guest';
  process.env.RABBITMQ_PASSWORD = 'guest';
  process.env.JWT_PUBLIC_KEY = Buffer.from('test-public-key').toString('base64');
  process.env.JWT_PRIVATE_KEY = Buffer.from('test-private-key').toString('base64');
  process.env.JWT_SECRET = 'test-secret';
  process.env.ROOT_USER_NAME = 'Root';
  process.env.ROOT_USER_LASTNAME = 'Admin';
  process.env.ROOT_USER_DNI = '1720000000';

  (globalThis as any).__PG_CONTAINER__ = container;

  // eslint-disable-next-line no-console
  console.log(
    `[testcontainers] Postgres de pruebas arriba en ${process.env.TEST_DB_HOST}:${process.env.TEST_DB_PORT}`,
  );
}
