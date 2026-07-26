import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

export default async function globalSetup(): Promise<void> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  )
    .withDatabase('assignment_service_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getMappedPort(5432));
  process.env.DB_USUARIO = container.getUsername();
  process.env.DB_CONTRASENA = container.getPassword();
  process.env.DB_NOMBRE = container.getDatabase();
  process.env.RABBITMQ_HOST = 'localhost';
  process.env.RABBITMQ_PORT = '5672';
  process.env.RABBITMQ_USER = 'guest';
  process.env.RABBITMQ_PASSWORD = 'guest';

  (globalThis as any).__PG_CONTAINER__ = container;

  // eslint-disable-next-line no-console
  console.log(
    `[testcontainers] Postgres de asignaciones arriba en ${process.env.DB_HOST}:${process.env.DB_PORT}`,
  );
}
