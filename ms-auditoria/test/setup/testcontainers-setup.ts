import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

export default async function globalSetup(): Promise<void> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  )
    .withDatabase('ms_auditoria_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getMappedPort(5432));
  process.env.DB_USER = container.getUsername();
  process.env.DB_USUARIO = container.getUsername();
  process.env.DB_PASSWORD = container.getPassword();
  process.env.DB_NAME = container.getDatabase();
  process.env.RABBITMQ_HOST = 'localhost';
  process.env.RABBITMQ_PORT = '5672';
  process.env.RABBITMQ_USER = 'guest';
  process.env.RABBITMQ_PASSWORD = 'guest';
  process.env.RABBITMQ_QUEUE = 'audit_queue';
  process.env.RABBITMQ_EXCHANGE = 'audit_exchange';
  process.env.RABBITMQ_ROUTING_KEY = 'audit.event';

  (globalThis as any).__PG_CONTAINER__ = container;

  // eslint-disable-next-line no-console
  console.log(
    `[testcontainers] Postgres de ms-auditoria arriba en ${process.env.DB_HOST}:${process.env.DB_PORT}`,
  );
}
